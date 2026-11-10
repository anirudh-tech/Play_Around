# PlayAround

UAE-first sports session platform. Players discover nearby games; organisers publish sessions with or without a confirmed venue. The MVP uses **offline payments only** (DEC-012): players pay organisers directly. PlayAround does not collect, hold or transfer money. Online payments (Stripe preferred) are future work.

| App | Stack | Local URL |
| --- | --- | --- |
| `apps/mobile` | Expo SDK 58, React Native, Expo Router, NativeWind | Metro `http://localhost:8081` |
| `apps/web` | Next.js 16, Tailwind CSS v4, shadcn-style UI | `http://localhost:3000` |
| `apps/admin` | Next.js 16 (same UI stack) | `http://localhost:3001` |
| `apps/api` | Node.js 26, Express 5, Prisma 7, PostgreSQL 16 | `http://localhost:4000` · docs `/docs` |

Shared packages: `packages/contracts`, `packages/api-client`, `packages/design-tokens`, `packages/config`.

## Current status

**Phase 10 – Testing and launch tooling: implemented locally, awaiting production gate.** Coverage on API services, Playwright/Maestro/k6, IDOR tests, secret scan. Legal routes are unpublished (L-05). Hosting, domain, stores (L-07–L-09) are not invented. Node.js 26.13.0. Local PostgreSQL 16 via Colima. Git is not initialised yet.

## Prerequisites

1. [nvm](https://github.com/nvm-sh/nvm) (or equivalent) and Node.js **26.13.0** (`nvm install` from `.nvmrc`).
2. pnpm **12.18.0** (`npm install -g pnpm@12.18.0` after `nvm use`).
3. Colima + Docker CLI + Docker Compose plugin (PostgreSQL 16 + Mailpit: `pnpm db:up`).

```sh
cd playaround
nvm use          # 26.13.0
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev
```

Start PostgreSQL before or after the apps:

```sh
pnpm db:up        # Postgres :5433, Mailpit UI :8025
pnpm db:migrate
pnpm db:seed
```

`/api/v1/health/ready` should then report `database: up`. Without Postgres the API still boots and readiness reports `database: down`.

Inspect tables in Cursor **Database Client** with a **new** PostgreSQL connection: host `127.0.0.1`, port `5433`, user/password/database `playaround`, **SSL off**. Local Docker maps **5433** because macOS often already has Postgres on 5432.

Auth locally: `POST /api/v1/auth/register` then check Mailpit at http://localhost:8025 for the verification code. On Render, set `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_USER`, `MAIL_PASSWORD` (Gmail App Password), and `MAIL_FROM` to that address so signup codes go to the user’s inbox. Staff seed (after `pnpm db:seed`): `admin@playaround.local` / `PlayAroundAdmin1` — first admin login returns TOTP enrolment. Google/Apple stay unconfigured until client IDs are set. SMS OTPs are logged, not sent (O-13).

Sessions: verified phone to publish, verified email to join. `EXISTING_BOOKING` is joinable immediately; `LOOKING_FOR_PLAYERS` needs a staff venue option, organiser approval, then `venue-booking`. Mutations that create or join a session need an `Idempotency-Key` header. Payments stay offline records only.

Discover nearby: `GET /api/v1/sessions/nearby?lat=&lng=` (auth required). Default radius 5 km, `autoExpand=true`. Pending LFP sessions appear with `joinable: false` unless `joinableOnly=true`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | API, web, admin and Expo together |
| `pnpm dev:api` / `dev:web` / `dev:admin` / `dev:mobile` | One app |
| `pnpm lint` / `typecheck` / `test` / `build` | Turborepo tasks |
| `pnpm test:coverage` | API service coverage (80% threshold) |
| `pnpm test:e2e` | Playwright (apps must be running) |
| `pnpm secrets:scan` / `pnpm audit` | Credential patterns / prod dependency audit |
| `pnpm db:up` / `db:down` | PostgreSQL 16 + Mailpit |
| `pnpm db:migrate` / `db:seed` | Prisma migrate and seed |
| `pnpm --filter @playaround/api db:seed:discovery` | Optional 100k-session load seed for nearby p95 |

## Documents

Canonical list: [docs/README.md](docs/README.md). Start with the [roadmap](docs/roadmap.md) and [decision log](docs/decisions/decision-log.md).
