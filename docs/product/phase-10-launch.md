# Phase 10 testing and launch

In-repo work for coverage, E2E, load, and security. **Production go-live is blocked** on unresolved launch items. This phase does not invent a host, domain, legal copy, or store account.

## Done locally

| Item | How |
| --- | --- |
| Service coverage | `pnpm --filter @playaround/api test:coverage` — Vitest v8 on `src/modules/**/*.service.ts`, 80% lines/functions/statements |
| Playwright | `RUN_E2E=1 pnpm test:e2e` with API/web/admin already on `:4000` / `:3000` / `:3001`. Core: landing, discover, login, unpublished legal, admin sign-in, API health |
| Maestro | `apps/mobile/maestro/discover.yaml` — `maestro test apps/mobile/maestro/discover.yaml` against a running Expo build (`app.playaround.mobile`) |
| k6 | `k6 run infrastructure/load/discovery.js`, `join.js`, `jobs-soak.js` (`API_URL`, optional `RATE` / `DURATION` / `VUS`) |
| IDOR | Payments who-may-change plus session `:id` mutations |
| Secret scan | `pnpm secrets:scan` |
| Dependency audit | `pnpm audit` |
| Legal routes | `/terms`, `/privacy`, `/organiser-agreement` state **not published** (L-05) |

## Blocked (do not fake)

| Item | Why |
| --- | --- |
| L-05 legal documents | DEC-038 — no drafted terms/privacy/organiser agreement |
| L-07 domain | `playaround.app` is recommended only |
| L-08 hosting | AWS `me-central-1` is recommended only; no production PostgreSQL/PITR/Sentry/uptime |
| L-09 stores | No App Store / Play developer accounts; no EAS submit |
| Coordinated launch | DEC-003 needs the above |

## Rollback (when a host exists)

1. Keep the previous API image and the last successful `prisma migrate` revision.
2. Point DNS back to the previous web/admin deployments.
3. Do not run new migrations during a rollback.
4. Jobs: set `JOBS_ENABLED=false` on a bad release if reminders mis-fire.

Until L-08 is chosen, rollback is a local `git`/`pnpm` revert of the release commit — Git is still not initialised in this workspace.
