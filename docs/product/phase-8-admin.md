# Phase 8 admin application

Staff app at `apps/admin` (`http://localhost:3001`). Seeded accounts: `admin@playaround.local`, `operations@playaround.local`, `support@playaround.local` with `PlayAroundAdmin1`. First sign-in enrols TOTP.

| Area | SUPPORT | OPERATIONS | SUPER_ADMIN |
| --- | :-: | :-: | :-: |
| Users, sessions, payments, disputes, reports | view | view | view |
| Confirm / waive / refund payments; resolve disputes | ✅ | | ✅ |
| Remove participant; action reports; hide reviews | ✅ | ✅ | ✅ |
| Suspend users; cancel sessions | | ✅ | ✅ |
| Venue arrangements; venues; sports | | ✅ | ✅ |
| Settings; staff roles; audit log | | | ✅ |

Every mutation requires a reason and writes `admin_audit_logs`. Clients hide nav the role cannot use; the API is the enforcement point.
