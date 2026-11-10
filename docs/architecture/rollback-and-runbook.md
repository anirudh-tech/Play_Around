# Rollback and operations runbook

## Local

```sh
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Health: `GET http://localhost:4000/health` and `GET http://localhost:4000/api/v1/health/ready`.

## Production (blocked on L-07 / L-08)

When a host and domain are approved:

- API: Node 26.13.0, `NODE_ENV=production`, unique `JWT_SECRET` and `TOTP_ENCRYPTION_KEY`, `COOKIE_SECURE=true`, `CORS_ORIGINS` limited to the verified web and admin origins.
- Database: managed PostgreSQL with point-in-time recovery; `pnpm --filter @playaround/api db:deploy`.
- Optional `SENTRY_DSN` is not wired until a project exists.
- Web `:3000` and admin `:3001` (or the chosen public URLs) ship together with mobile store binaries (DEC-003).

Do not deploy with the values in `.env.example`.
