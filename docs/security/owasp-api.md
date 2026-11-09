# OWASP API security checklist (MVP)

Local checklist for the Express API. Items that need a production host (L-08) or a verified domain (L-07) stay open.

| Control | Status | Notes |
| --- | --- | --- |
| Broken object-level authorization | Covered in tests | `test/payments.test.ts` who-may-change; `test/security.idor.test.ts` session patch/cancel/remove/refund/remind |
| Broken authentication | Covered in tests | Auth rotation, reuse, TOTP lockout (`test/auth.test.ts`) |
| Broken object property authorization | Partial | Patch bodies are Zod-whitelisted; do not bind unknown fields |
| Unrestricted resource consumption | Implemented | Helmet, CORS, rate limits (disabled in tests) |
| Broken function-level authorization | Covered | Admin RBAC matrix (`test/admin.rbac.test.ts`) |
| Unrestricted access to sensitive business flows | Partial | Idempotency on create/join/payment mutations |
| Server-side request forgery | N/A for MVP | No user-supplied fetch URLs |
| Security misconfiguration | Local only | Default JWT/TOTP keys in `.env.example` are **dev-only**; production must set new secrets |
| Improper inventory management | Implemented | OpenAPI at `/docs` |
| Unsafe consumption of APIs | N/A | No third-party payment API in MVP |

Run `pnpm secrets:scan` and `pnpm audit` before any deploy. Do not commit `.env`.
