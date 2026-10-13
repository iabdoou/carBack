# Trust Auto / JNL Cars — API

NestJS 10, Prisma 5, PostgreSQL. Serves the vehicle import flow (suppliers → offers → listings → orders → tracking) and car rentals. Frontend: [carFront](https://github.com/iabdoou/carFront).

## Local development

```bash
cp .env.example .env        # fill DATABASE_URL, DIRECT_URL, JWT_SECRET
npm ci
npx prisma migrate deploy
SEED_PASSWORD=choose-one npm run seed   # demo data, WIPES the database
npm run dev                 # http://localhost:8001, Swagger at /api/docs
```

## Production (Render)

`render.yaml` is a Blueprint: build `npm ci --include=dev && npm run build`, start `npm run start:prod` (applies pending migrations, then starts). Health check: `GET /api/v1/health`.

Environment variables (see `.env.example`):

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` (enables secure cookies, disables Swagger) |
| `DATABASE_URL` | Supabase transaction pooler, port 6543, `?pgbouncer=true`. `connection_limit=5&pool_timeout=20` are added unless the URL sets them |
| `DIRECT_URL` | Supabase session pooler / direct connection (used by migrations) |
| `JWT_SECRET` | 32+ random chars. The app refuses to start with a weak or previously leaked value |
| `CORS_ORIGIN` | The frontend URL(s), comma-separated |
| `COOKIE_SAMESITE` | `lax` when the frontend proxies `/api` (recommended); `none` for direct cross-site calls |
| `TRUST_PROXY` | `2` behind Netlify proxy + Render, `1` when called directly |
| `ENABLE_SWAGGER` | Optional, `true` to expose `/api/docs` in production |

### First admin

There is no public registration. Create or reset the admin from a Render shell:

```bash
ADMIN_EMAIL=you@company.dz ADMIN_PASSWORD='a long passphrase' npm run admin:create
```

`npm run seed` refuses to run when `NODE_ENV=production`; never use it on real data.

## Business rules

- **Orders** only move forward: `CREATED -> CONFIRMED -> IN_TRANSIT -> ARRIVED -> READY -> DELIVERED`; a listing in stock goes `CONFIRMED -> READY`. Any non-final order can be `CANCELLED`; `DELIVERED` and `CANCELLED` are final (409 otherwise).
- **Listings**: one per trim and mode. Approving more offers adds to its stock.
- **Rentals** book calendar days (`YYYY-MM-DD`), both ends included: 13 -> 15 is 3 days, and day 15 is taken. A full timestamp is read as the Algerian date it falls on. Active rentals can be edited, completed or cancelled (`PATCH /rentals/:id`); a car with rental history cannot be deleted (set it to `MAINTENANCE`).
- **Emails** are stored lower-case; login is case-insensitive.
- **Login rate limits**: 10 attempts / 15 min per IP + email, and 30 / 15 min per IP across all emails.

## Tests

`tests/smoke.mjs` exercises auth, ownership checks, stock and booking concurrency, the order state machine and rate limiting against a running, freshly seeded API. CI runs it against Postgres on every push (`.github/workflows/ci.yml`).

```bash
SEED_PASSWORD=choose-one node tests/smoke.mjs http://localhost:8001
```
