// End-to-end smoke test against a running API seeded with `npm run seed`.
// Usage: SEED_PASSWORD=... node tests/smoke.mjs http://localhost:8001


const BASE = process.argv[2] + '/api/v1';
const PW = process.env.SEED_PASSWORD;
if (!process.argv[2] || !PW) {
  console.error('Usage: SEED_PASSWORD=... node tests/smoke.mjs <baseUrl>');
  process.exit(2);
}
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`);
};

async function req(method, path, { token, body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') };
}
const login = (email, password = PW) => req('POST', '/auth/login', { body: { email, password } });

// --- auth
const bad = await login('admin@trustauto.dz', 'wrong-password');
check('wrong password -> 401', bad.status === 401, bad.status);
const unknown = await login('nobody@x.dz', 'whatever1');
check('unknown email -> 401 (same message)', unknown.status === 401 && unknown.data?.message === bad.data?.message);

const adm = await login('ADMIN@trustauto.dz');
check('admin login (case-insensitive email) -> 200', adm.status === 200, JSON.stringify(adm.data));
const A = adm.data.accessToken;
const c = adm.setCookie || '';
check('refresh cookie HttpOnly + narrow path + SameSite=Lax',
  /HttpOnly/i.test(c) && /Path=\/api\/v1\/auth/i.test(c) && /SameSite=Lax/i.test(c), c);
const cookie = c.split(';')[0];

const r1 = await req('POST', '/auth/refresh', { cookie });
check('refresh -> 200 with user + token', r1.status === 200 && r1.data?.user?.role === 'ADMIN' && !!r1.data?.accessToken, r1.status);
const reuse = await req('POST', '/auth/refresh', { cookie });
check('reusing a rotated refresh token -> 401', reuse.status === 401, reuse.status);

// --- validation / errors
const badStatus = await req('GET', '/admin/orders?status=FOO', { token: A });
check('invalid enum filter -> 400', badStatus.status === 400, badStatus.status);
const weak = await req('POST', '/admin/users/buyer', { token: A, body: { name: 'x', email: 'weak@x.dz', password: '123' } });
check('weak password rejected -> 400', weak.status === 400, weak.status);

// --- buyer IDOR on tracking
const b1 = (await login('ahmed@client.dz')).data.accessToken;
const b2 = (await login('karim@client.dz')).data.accessToken;
const b1orders = (await req('GET', '/buyer/orders', { token: b1 })).data;
const foreign = await req('GET', `/buyer/orders/${b1orders[0].id}/tracking`, { token: b2 });
check('buyer cannot read another buyer\'s tracking -> 403', foreign.status === 403, foreign.status);

// --- oversell race: listing with exactly 2 sellable units, 6 concurrent orders of 1
const trims = (await req('GET', '/admin/trims', { token: A })).data;
const buyers = (await req('GET', '/admin/users/buyers', { token: A })).data;
const listing = (await req('POST', '/admin/listings', { token: A, body: { trimId: trims[0].id, mode: 'IN_STOCK', publicPrice: 1000, totalQuantity: 2 } })).data;
const results = await Promise.all(Array.from({ length: 6 }, () =>
  req('POST', '/admin/orders', { token: A, body: { buyerId: buyers[0].id, listingId: listing.id, quantity: 1, finalPrice: 1000 } })));
const created = results.filter(r => r.status === 201);
const after = (await req('GET', `/admin/listings/${listing.id}`, { token: A })).data;
check('concurrent orders cannot oversell (2 of 6 succeed)', created.length === 2 && after.reservedQuantity === 2 && after.status === 'OUT_OF_STOCK',
  `created=${created.length} reserved=${after.reservedQuantity} status=${after.status}`);

// --- order state machine
const oid = created[0].data.id;
const del = await req('PATCH', `/admin/orders/${oid}/status`, { token: A, body: { status: 'DELIVERED' } });
const cancelAfter = await req('PATCH', `/admin/orders/${oid}/status`, { token: A, body: { status: 'CANCELLED' } });
const l2 = (await req('GET', `/admin/listings/${listing.id}`, { token: A })).data;
check('DELIVERED then CANCELLED is refused', del.status === 200 && cancelAfter.status === 400, `${del.status}/${cancelAfter.status}`);
check('stock correct after delivery (total 1, reserved 1)', l2.totalQuantity === 1 && l2.reservedQuantity === 1, `${l2.totalQuantity}/${l2.reservedQuantity}`);
const cancel2 = await req('PATCH', `/admin/orders/${created[1].data.id}/status`, { token: A, body: { status: 'CANCELLED' } });
const l3 = (await req('GET', `/admin/listings/${listing.id}`, { token: A })).data;
check('cancel releases stock and listing is ACTIVE again', cancel2.status === 200 && l3.reservedQuantity === 0 && l3.status === 'ACTIVE', `${l3.reservedQuantity}/${l3.status}`);

// --- inactive listing preserved by stock changes
await req('PUT', `/admin/listings/${listing.id}`, { token: A, body: { status: 'INACTIVE' } });
await req('POST', `/admin/listings/${listing.id}/adjust-stock`, { token: A, body: { quantity: 3, reason: 'test' } });
const l4 = (await req('GET', `/admin/listings/${listing.id}`, { token: A })).data;
check('adjust-stock keeps a deliberate INACTIVE', l4.status === 'INACTIVE' && l4.totalQuantity === 4, `${l4.status}/${l4.totalQuantity}`);

// --- delete with dependants -> 409 not 500
const delBuyer = await req('DELETE', `/admin/users/buyers/${buyers[0].id}`, { token: A });
check('deleting a buyer with orders -> 409', delBuyer.status === 409, `${delBuyer.status} ${JSON.stringify(delBuyer.data)}`);

// --- rentals
const cars = (await req('GET', '/rentals/cars/public')).data;
check('public cars hide supplierId', cars.length > 0 && !('supplierId' in cars[0]));
const carId = cars[0].id;
const start = new Date(Date.now() + 400 * 86400000), end = new Date(start.getTime() + 3 * 86400000);
const body = { carId, clientName: 'Test', clientPhone: '0550', startDate: start.toISOString(), endDate: end.toISOString() };
const rentals = await Promise.all([1, 2, 3].map(() => req('POST', '/rentals', { token: A, body })));
check('concurrent double booking: exactly one succeeds, others 409',
  rentals.filter(r => r.status === 201).length === 1 && rentals.filter(r => r.status === 409).length === 2,
  rentals.map(r => r.status).join(','));
check('rental total computed server-side when omitted', rentals.find(r => r.status === 201)?.data.totalPrice === 3 * cars[0].pricePerDay);
const reversed = await req('POST', '/rentals/check-availability', { body: { carId, startDate: end.toISOString(), endDate: start.toISOString() } });
check('reversed date range -> 400', reversed.status === 400, reversed.status);
const taken = await req('POST', '/rentals/check-availability', { body: { carId, startDate: start.toISOString(), endDate: end.toISOString() } });
check('availability returns valid=false with message', taken.status === 200 && taken.data.valid === false && !!taken.data.error, JSON.stringify(taken.data));

// --- public vehicles
const opts = await req('GET', '/vehicles/filters/options');
check('filter options endpoint', opts.status === 200 && opts.data.brands.length > 0, opts.status);
const byBrand = await req('GET', `/vehicles?brand=${encodeURIComponent(opts.data.brands[0])}`);
check('vehicles?brand= works (was a 500)', byBrand.status === 200 && byBrand.data.every(v => v.trim.vehicleModel.brand === opts.data.brands[0]), byBrand.status);
const notUuid = await req('GET', '/vehicles/not-a-uuid');
check('vehicle id must be a UUID -> 400', notUuid.status === 400, notUuid.status);

// --- password change revokes sessions
const sup = await login('supplier@trustauto.dz');
const supCookie = sup.setCookie.split(';')[0];
const sups = (await req('GET', '/admin/users/suppliers', { token: A })).data;
check('supplier list counts offers', typeof sups[0]._count?.supplierOffers === 'number');
const newPw = PW + '-new';
await req('PUT', `/admin/users/suppliers/${sups[0].id}`, { token: A, body: { password: newPw } });
const supRefresh = await req('POST', '/auth/refresh', { cookie: supCookie });
check('password change revokes existing sessions', supRefresh.status === 401, supRefresh.status);
await req('PUT', `/admin/users/suppliers/${sups[0].id}`, { token: A, body: { password: PW } });

// --- login rate limit (last: it blocks this IP+email)
let last;
const probe = `throttle-probe-${Date.now()}@example.dz`;
for (let i = 0; i < 12; i++) last = await login(probe, 'bad-password-' + i);
check('login brute force throttled -> 429', last.status === 429, last.status);
const other = await login('ahmed@client.dz');
check('throttle is per account: other users can still log in', other.status === 200, other.status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
