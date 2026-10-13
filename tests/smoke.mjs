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
const existing = (await req('GET', '/admin/listings', { token: A })).data;
const used = new Set(existing.map(l => `${l.trimId}:${l.mode}`));
const freeTrim = (mode, skip) => trims.find(t => !used.has(`${t.id}:${mode}`) && t.id !== skip);
const stockTrim = freeTrim('IN_STOCK');
const listing = (await req('POST', '/admin/listings', { token: A, body: { trimId: stockTrim.id, mode: 'IN_STOCK', publicPrice: 1000, totalQuantity: 2 } })).data;
const dupListing = await req('POST', '/admin/listings', { token: A, body: { trimId: stockTrim.id, mode: 'IN_STOCK', publicPrice: 1000, totalQuantity: 1 } });
check('second listing for the same trim + mode -> 409', dupListing.status === 409, dupListing.status);
const results = await Promise.all(Array.from({ length: 6 }, () =>
  req('POST', '/admin/orders', { token: A, body: { buyerId: buyers[0].id, listingId: listing.id, quantity: 1, finalPrice: 1000 } })));
const created = results.filter(r => r.status === 201);
const after = (await req('GET', `/admin/listings/${listing.id}`, { token: A })).data;
check('concurrent orders cannot oversell (2 of 6 succeed)', created.length === 2 && after.reservedQuantity === 2 && after.status === 'OUT_OF_STOCK',
  `created=${created.length} reserved=${after.reservedQuantity} status=${after.status}`);

// --- order state machine (forward only; an in-stock car skips the shipping steps)
const oid = created[0].data.id;
const setStatus = (id, status) => req('PATCH', `/admin/orders/${id}/status`, { token: A, body: { status } });
const skip = await setStatus(oid, 'DELIVERED');
check('CREATED -> DELIVERED (skipping steps) is refused with 409', skip.status === 409, skip.status);
const confirmed = await setStatus(oid, 'CONFIRMED');
const back = await setStatus(oid, 'CREATED');
check('going back (CONFIRMED -> CREATED) is refused with 409', confirmed.status === 200 && back.status === 409, `${confirmed.status}/${back.status}`);
const shipStock = await setStatus(oid, 'IN_TRANSIT');
check('in-stock order cannot go IN_TRANSIT', shipStock.status === 409, shipStock.status);
const ready = await setStatus(oid, 'READY');
const del = await setStatus(oid, 'DELIVERED');
const cancelAfter = await setStatus(oid, 'CANCELLED');
const l2 = (await req('GET', `/admin/listings/${listing.id}`, { token: A })).data;
check('CONFIRMED -> READY -> DELIVERED works, then CANCELLED is refused', ready.status === 200 && del.status === 200 && cancelAfter.status === 409,
  `${ready.status}/${del.status}/${cancelAfter.status}`);
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

// --- rentals (whole days, both ends included: 10 -> 13 is 4 days)
const cars = (await req('GET', '/rentals/cars/public')).data;
check('public cars hide supplierId', cars.length > 0 && !('supplierId' in cars[0]));
const carId = cars[0].id;
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const [d10, d13, d14, d16, d20] = [10, 13, 14, 16, 20].map(n => day(400 + n));
const body = { carId, clientName: 'Test', clientPhone: '0550', startDate: d10, endDate: d13 };
const rentals = await Promise.all([1, 2, 3].map(() => req('POST', '/rentals', { token: A, body })));
check('concurrent double booking: exactly one succeeds, others 409',
  rentals.filter(r => r.status === 201).length === 1 && rentals.filter(r => r.status === 409).length === 2,
  rentals.map(r => r.status).join(','));
const booked = rentals.find(r => r.status === 201)?.data;
check('rental price counts both ends (4 days)', booked?.totalPrice === 4 * cars[0].pricePerDay, booked?.totalPrice);
check('rental dates stored as calendar days', booked?.startDate.startsWith(d10) && booked?.endDate.startsWith(d13), `${booked?.startDate} ${booked?.endDate}`);
const reversed = await req('POST', '/rentals/check-availability', { body: { carId, startDate: d13, endDate: d10 } });
check('reversed date range -> 400', reversed.status === 400, reversed.status);
const taken = await req('POST', '/rentals/check-availability', { body: { carId, startDate: d13, endDate: d16 } });
check('the last rented day is still booked (valid=false)', taken.status === 200 && taken.data.valid === false && !!taken.data.error, JSON.stringify(taken.data));
const nextDay = await req('POST', '/rentals/check-availability', { body: { carId, startDate: d14, endDate: d16 } });
check('the day after the return is free', nextDay.data?.valid === true, JSON.stringify(nextDay.data));
// A browser in Algeria sends local midnight = 23:00 UTC the day before; it must map to the intended day
const localMidnight = new Date(`${d14}T00:00:00+01:00`).toISOString();
const tz = await req('POST', '/rentals/check-availability', { body: { carId, startDate: localMidnight, endDate: localMidnight } });
check('local-midnight timestamp is read as the Algerian day (free day 14, not booked day 13)', tz.data?.valid === true, `${localMidnight} ${JSON.stringify(tz.data)}`);
const second = (await req('POST', '/rentals', { token: A, body: { ...body, startDate: d16, endDate: d20 } })).data;
const setRental = (id, b) => req('PATCH', `/rentals/${id}`, { token: A, body: b });
const moveOnto = await setRental(booked.id, { endDate: d16 });
check('editing dates onto another booking -> 409', moveOnto.status === 409, moveOnto.status);
const extend = await setRental(booked.id, { endDate: d14 });
check('editing dates re-prices the rental (5 days)', extend.status === 200 && extend.data.totalPrice === 5 * cars[0].pricePerDay, `${extend.status} ${extend.data?.totalPrice}`);
const cancelled = await setRental(booked.id, { status: 'CANCELLED' });
const reopen = await setRental(booked.id, { status: 'ACTIVE' });
const freed = await req('POST', '/rentals/check-availability', { body: { carId, startDate: d10, endDate: d13 } });
check('cancel frees the dates and is final', cancelled.status === 200 && reopen.status === 409 && freed.data?.valid === true,
  `${cancelled.status}/${reopen.status}/${JSON.stringify(freed.data)}`);
const done = await setRental(second.id, { status: 'COMPLETED' });
check('rental can be completed', done.status === 200 && done.data.status === 'COMPLETED', done.status);
const delCar = await req('DELETE', `/rentals/cars/${carId}`, { token: A });
check('deleting a car with rental history -> 409', delCar.status === 409, delCar.status);

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

// --- two offers for a new trim + mode approved at the same time add to one listing
const S = (await login('supplier@trustauto.dz')).data.accessToken;
const offerTrim = freeTrim('ON_ORDER');
const offer = () => req('POST', '/supplier/offers', { token: S, body: { trimId: offerTrim.id, mode: 'ON_ORDER', proposedPrice: 500, quantity: 2 } });
const offers = [(await offer()).data, (await offer()).data];
const approvals = await Promise.all(offers.map(o => req('POST', `/admin/offers/${o.id}/approve`, { token: A, body: { publicPrice: 900 } })));
const offerListings = (await req('GET', '/admin/listings', { token: A })).data.filter(l => l.trimId === offerTrim.id && l.mode === 'ON_ORDER');
check('concurrent offer approvals add to one listing', approvals.every(r => r.status < 300)
  && offerListings.length === 1 && offerListings[0].totalQuantity === 4,
  `${approvals.map(r => r.status)} listings=${offerListings.length} qty=${offerListings[0]?.totalQuantity}`);

// --- emails are case-insensitive and stored lower-case
const mixed = `Case-${Date.now()}@Example.DZ`;
const nb = await req('POST', '/admin/users/buyer', { token: A, body: { name: 'Case Test', email: `  ${mixed} `, password: PW } });
const nbDup = await req('POST', '/admin/users/buyer', { token: A, body: { name: 'Case Test 2', email: mixed.toLowerCase(), password: PW } });
const nbLogin = await login(mixed.toUpperCase());
check('email stored lower-case; same email in other case -> 409; login in any case',
  nb.data?.email === mixed.toLowerCase() && nbDup.status === 409 && nbLogin.status === 200,
  `${nb.data?.email} ${nbDup.status} ${nbLogin.status}`);

// --- login rate limit (last: it blocks this IP+email)
let last;
const probe = `throttle-probe-${Date.now()}@example.dz`;
for (let i = 0; i < 12; i++) last = await login(probe, 'bad-password-' + i);
check('login brute force throttled -> 429', last.status === 429, last.status);
const other = await login('ahmed@client.dz');
check('throttle is per account: other users can still log in', other.status === 200, other.status);

// --- per-IP login limit (very last: it blocks every login from this IP for 15 min)
let sprayBlockedAt = null;
for (let i = 0; i < 40 && sprayBlockedAt === null; i++) {
  const r = await login(`spray-${Date.now()}-${i}@example.dz`, 'whatever-' + i);
  if (r.status === 429) sprayBlockedAt = i;
}
check('password spraying across many accounts is throttled per IP -> 429', sprayBlockedAt !== null, sprayBlockedAt);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
