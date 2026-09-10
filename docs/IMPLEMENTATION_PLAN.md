# Implementation Plan — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Started | 2026-09-08 |
| Status | Complete through Phase 12, plus the Phase 14 essentials. Phases 11 and 13 deferred by choice |

Tick boxes as work completes. Phases 1–8 build the application; phases 9–14 are the actual point of the project.

**Progress**

- [x] Phase 0 — Documentation
- [x] Phase 1 — Repository and tooling
- [x] Phase 2 — Backend foundation
- [x] Phase 3 — Data model and seeding
- [x] Phase 4 — Authentication
- [x] Phase 5 — RBAC and user management
- [x] Phase 6 — Frontend foundation
- [x] Phase 7 — Frontend screens
- [x] Phase 8 — Hardening and production build
- [x] Phase 9 — Server provisioning
- [x] Phase 10 — nginx reverse proxy
- [ ] Phase 11 — Domain and HTTPS — **deferred**, no domain; the site runs over plain HTTP
- [x] Phase 12 — CD
- [ ] Phase 13 — Docker (optional) — **declined**; the pm2 path is understood and working
- [x] Phase 14 — Observability and backup — essentials done: log rotation and external uptime monitoring. Restore rehearsal and resource alerts deferred with reasons

---

## Phase 0 — Documentation ✅

- [x] Choose project name, stack, and hosting approach
- [x] Write `README.md`
- [x] Write `docs/SRS.md`
- [x] Write `docs/FRD.md`
- [x] Write `docs/ARCHITECTURE.md`
- [x] Write `docs/API_SPEC.md`
- [x] Write `docs/IMPLEMENTATION_PLAN.md`
- [x] Create `docs/DEPLOYMENT.md` skeleton

---

## Phase 1 — Repository and Tooling ✅

**Goal:** an initialised repository with both workspaces scaffolded and a verified Atlas connection.

- [x] `git init` at the project root
- [x] Write root `.gitignore` — `node_modules`, `.env`, `dist`, `*.log`, `.DS_Store`
- [x] Create the Atlas M0 cluster
- [x] Create the Atlas database user and record the password
- [x] Allow `0.0.0.0/0` in Atlas Network Access, to be narrowed in Phase 9
- [x] Paste the connection string into `backend/.env`
- [x] Scaffold `backend/` — dependencies installed, folder tree created
- [x] Scaffold `frontend/` — Vite + React, dependencies installed
- [x] Write `backend/.env.example` and `frontend/.env.example`
- [x] Generate `JWT_SECRET` into `backend/.env`
- [x] First commit
- [x] Add the GitHub remote — `Himanshu1091/Deploylab`
- [x] `.github/workflows/ci.yml` — frontend build plus a backend smoke test against a MongoDB service container
- [x] Branch-and-PR workflow adopted; `main` stays protected from direct pushes

**Installed versions:** Express 5.2, Mongoose 9.9, Zod 4.5, React 19.2, Vite 6.4, Node 24.11.

**Done when:** both `npm install` runs succeed and `git status` is clean apart from intended files.

---

## Phase 2 — Backend Foundation ✅

**Goal:** Express boots, connects to Atlas, and answers a health check.

- [x] `src/config/env.js` — validate required variables, exit with a clear message when one is missing
- [x] `src/config/db.js` — Mongoose connection with retry and backoff
- [x] `src/app.js` — helmet, cookie-parser, JSON body parser, morgan, route mounting
- [x] `src/server.js` — connect, listen, handle `SIGTERM` and `SIGINT`
- [x] `src/utils/ApiError.js`
- [x] ~~`src/utils/asyncHandler.js`~~ — **not needed.** Express 5 forwards rejected promises from async handlers to the error middleware automatically. The wrapper was an Express 4 workaround.
- [x] `src/middleware/errorHandler.js` — single error response formatter, including Mongoose `11000`, `CastError`, and JWT error translation
- [x] `GET /api/health` returning `200` connected / `503` disconnected
- [x] `nodemon` dev script
- [x] Express binds to `127.0.0.1` in production, `0.0.0.0` in development
- [x] `app.set('trust proxy', 1)` for correct client IPs behind nginx

**Done when:** `npm run dev` prints a listening message, `/api/health` returns `db: "connected"`, and `Ctrl+C` shuts down cleanly rather than dying mid-request.

**Verified:**

- Env validation refuses to boot with a missing `MONGODB_URI`, naming the variable
- Boots against Atlas — `[db] connected - database "Deploylab"`
- `GET /api/health` returns `200 {"status":"ok","db":"connected",…}`

---

## Phase 3 — Data Model and Seeding ✅

**Goal:** the `users` collection exists with three test accounts.

- [x] `src/models/User.js` — full schema per ARCHITECTURE §6
- [x] `passwordHash` marked `select: false`
- [x] Write-only `password` virtual, hashed with bcrypt cost 12 on `pre('validate')` — **not** `pre('save')`, see note below
- [x] Instance method `comparePassword`
- [x] Static `findByEmail`, with an opt-in `withPassword` select
- [x] Indexes on `email` (unique), `managerId`, `role`
- [x] `toJSON` transform — expose `id`, strip `_id`, `__v`, and `passwordHash`
- [x] `scripts/seed.js` creating one admin, one manager, one employee, with the employee assigned to the manager
- [x] `npm run seed` script, plus `npm run seed -- --reset`

**Done when:** seeding produces exactly three users in Atlas, re-running it does not duplicate them, and no document leaks a plaintext password.

**Verified — 20 checks, all passing**

| Area | Result |
|---|---|
| `toJSON` hides `passwordHash`, exposes `id`, drops `_id` and `__v` | pass |
| Default query omits the hash; `select('+passwordHash')` returns it | pass |
| Stored value is a real bcrypt cost-12 hash (`$2b$12$…`), not plaintext | pass |
| `comparePassword` accepts the right password, rejects a wrong one, returns false when the hash was not selected | pass |
| `findByEmail` is case-insensitive | pass |
| Duplicate email rejected by the database with `11000` | pass |
| Password shorter than 8 characters rejected with a readable message | pass |
| Role outside the enum rejected | pass |
| Seeded employee is linked to the seeded manager | pass |
| All three indexes present in MongoDB | pass |
| Re-running the seed skips all three and leaves the count at 3 | pass |

**Seed accounts** — passwords live in `backend/.env` under `SEED_*`.

| Role | Email | Name |
|---|---|---|
| admin | `admin@deploylab.local` | Aarti Deshpande |
| manager | `manager@deploylab.local` | Rahul Verma |
| employee | `employee@deploylab.local` | Priya Sharma — reports to Rahul |

---

## Phase 4 — Authentication ✅

**Goal:** register, log in, restore session, log out.

- [x] `src/validators/auth.schema.js` — Zod schemas for register and login
- [x] `src/middleware/validate.js` — generic schema validation middleware
- [x] `src/config/cookie.js` — cookie name and attributes in one place
- [x] `src/utils/serializeUser.js` — the single shape a user leaves the API in
- [x] `src/services/auth.service.js` — register, login, token signing
- [x] `src/controllers/auth.controller.js` — cookie setting and clearing
- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] `src/middleware/requireAuth.js` — verify JWT, load the user, reject when inactive
- [x] Cookie flags correct per environment — `secure` only in production
- [x] Cookie lifetime derived from the token's own `exp`, so the two cannot drift
- [x] Constant-time-ish login: a dummy bcrypt compare runs when no account matches

**Verified end to end against a running server — 42 checks, all passing**

| Group | Covered |
|---|---|
| Registration | `201` with a `Set-Cookie`; cookie is `HttpOnly`, `SameSite=Lax`, not `Secure` in dev, `Max-Age` 86399; response omits `passwordHash`; self-registration always yields `employee` |
| Input validation | Duplicate email `409 EMAIL_EXISTS`; short password `400` with a readable message; malformed email `400`; empty credentials `400` |
| Privilege escalation | `role: "admin"` in the register body is stripped, account is still `employee` |
| Login | Wrong password and unknown email both return `401` with a byte-identical message and code; correct credentials `200`; email match is case-insensitive |
| Session | `/me` without a cookie `401` and leaks no data; with a cookie returns the right user without `passwordHash`; tampered and malformed tokens `401` |
| Logout | Clears the cookie with matching attributes; idempotent without a session |
| Roles | All three seeded accounts log in and carry the right role; employee `/me` populates `manager.name` and exposes `managerId` as a string |
| Deactivation | Login `403 ACCOUNT_DISABLED`; an already-issued token stops working immediately, returning `401` |

---

## Phase 5 — RBAC and User Management ✅

**Goal:** every endpoint from API_SPEC exists and enforces its role.

- [x] `src/middleware/requireRole.js` — factory accepting one or more roles
- [x] `src/validators/user.schema.js` — Zod schemas for body, params, and query
- [x] `src/services/user.service.js` — list, stats, change role, change status, assign manager, team
- [x] `PATCH /api/users/me`
- [x] `GET /api/users` with pagination, role filter, and search
- [x] `GET /api/users/stats`
- [x] `PATCH /api/users/:id/role` including the self-change guard
- [x] `PATCH /api/users/:id/status` including the self-deactivation guard
- [x] `PATCH /api/users/:id/manager` including the self-manager and role guards
- [x] `GET /api/users/team`
- [x] Route ordering checked — `/users/me`, `/users/stats`, and `/users/team` are declared before `/users/:id/*`
- [x] Search terms escaped before compiling into a RegExp

**Verified end to end — 63 checks, all passing**

| Group | Covered |
|---|---|
| Role enforcement | `GET /users`: no session `401`, employee `403`, manager `403`, admin `200`. `GET /users/team`: employee `403`, admin `403`, manager `200`. Employee cannot change a role. A `403` body carries no data. |
| Route ordering | `/users/stats` and `/users/team` resolve correctly rather than being captured as `:id` |
| Listing | Users returned without `passwordHash`; defaults page 1 / limit 20; `limit` honoured; `pages` computed; role filter; search by name and by email; `page=0`, `limit=500`, and an unknown role all rejected `400` |
| Regex safety | A search of `.+` returns zero results — metacharacters are escaped, not compiled |
| Stats | `total`, `active + inactive === total`, and every role key present even at zero |
| Self-protection | Admin cannot change own role (`SELF_ROLE_CHANGE`) or deactivate own account (`SELF_STATUS_CHANGE`); database confirms nothing changed |
| Role changes | Promotion works; invalid role `400`; unknown id `404 USER_NOT_FOUND`; malformed ObjectId `400` |
| Manager assignment | Self-assignment `SELF_MANAGER`; assigning a non-manager `NOT_A_MANAGER`; valid assignment populates `manager.name`; the manager's team then contains the user; `null` unassigns |
| Own profile | Rename works; `role`, `isActive`, and `email` sent to `/users/me` are discarded and confirmed unchanged in the database; short name `400` |
| Deactivation | Admin deactivates; the target's live session returns `401` on the next call; reactivation works; non-boolean `isActive` rejected |
| Empty team | A manager with no reports gets `200` with an empty array and `count: 0`, not `404` |

---

## Phase 6 — Frontend Foundation ✅

**Goal:** the app shell renders, the session survives a refresh, and route guards work.

- [x] Vite proxy configured — `/api` to `http://localhost:5000`
- [x] React Router installed and the route table written
- [x] `src/api/client.js` — Axios instance with `withCredentials: true`
- [x] `src/api/auth.api.js` and `src/api/users.api.js` — every endpoint wrapped
- [x] 401 response interceptor, with the startup `/me` call excluded via `skipAuthRedirect`
- [x] Axios errors normalised to `{ status, code, message }`, so no component reaches through `error.response.data`
- [x] `src/context/AuthContext.jsx` — user, loading, sessionExpired, login, register, logout, refresh
- [x] Initial `/me` call on mount, with a full-page loading state
- [x] `ProtectedRoute`, `GuestRoute`, `RoleRoute` components
- [x] `AppShell` with header and role-aware navigation
- [x] Base UI components — Button, Input, Badge, Spinner, Toast, loading/empty/error states
- [x] Design tokens and full stylesheet, responsive to 360 px
- [x] Login screen, brought forward from Phase 7 so the guards are testable
- [x] Modal and Table — added in Phase 7, where the admin screen first needs them

**Done when:** refreshing while logged in restores the session with no flash of the login screen, and a logged-out user hitting `/dashboard` lands on `/login`.

**Verified so far**

| Check | Result |
|---|---|
| Production build succeeds | pass — 97.06 KB gzipped, against a 300 KB budget |
| Deep links (`/login`, `/dashboard`, `/admin/users`, unknown paths) serve `index.html` | pass |
| `/api/health` reaches Express through the Vite proxy | pass — `db: connected` |

Interactive checks — refresh persistence, guard redirects, session expiry — are done by hand in the browser.

---

## Phase 7 — Frontend Screens ✅

**Goal:** every screen in the FRD is built and behaves correctly.

- [x] `Login.jsx` — validation, error states, redirect to the originally requested route *(done in Phase 6)*
- [x] `Register.jsx` — validation on blur, including password confirmation
- [x] `Dashboard.jsx` — role-branching content with stat cards
- [x] `Profile.jsx` — view and inline name editing
- [x] `AdminUsers.jsx` — table, role filter, debounced search, pagination
- [x] Role dropdown with a confirmation dialog and automatic revert on failure
- [x] Status toggle — confirmation on deactivation, immediate on reactivation
- [x] Manager assignment dropdown, no confirmation since it is easily reversed
- [x] Own-row role and status controls disabled with an explanatory tooltip
- [x] `Team.jsx` — read-only table with an empty state
- [x] `NotFound.jsx`
- [x] Loading, empty, and error states on every data-fetching screen
- [x] `Modal.jsx` — Escape to close, backdrop click, focus moved into the dialog
- [x] `TableScroll` — wide tables scroll inside their own container, not the page
- [x] Responsive down to 360 px

**Verified — 19 contract checks, all passing**

The screens were checked against a running API by replaying the exact request
shapes each one sends, which catches drift the backend's own tests cannot see:

| Screen | Confirmed |
|---|---|
| Register | Registration payload accepted, returns `201` |
| Profile | `PATCH /users/me` accepted; response carries `createdAt` for "Member since" |
| AdminUsers | Initial list call; rows carry every field the table renders; pagination carries `page`, `limit`, `total`, `pages`; role filter; search; manager dropdown loads without a `page` param; role, status, and manager mutations all accepted |
| AdminUsers | An empty `role` string is rejected `400`, confirming the filter must be omitted rather than sent blank |
| AdminUsers | An empty `managerId` string is rejected `400`, confirming "— None —" must be converted to `null` |
| Dashboard | Stats response carries every field the cards read, including all three role keys; manager card reads `count` |
| Team | Team rows carry every rendered field |

**Run the FRD §9 acceptance scenarios by hand**

- [ ] AT-01 through AT-13 all pass

---

## Phase 8 — Hardening and Production Build ✅

**Goal:** the production build runs from a single Node process, exactly as it will on the server.

- [x] `express-rate-limit` on auth routes and globally
- [x] Login limiter counts failures only, so signing in on several devices does not lock you out
- [x] Health exempt from the global limiter
- [x] `app.set('trust proxy', 1)` for correct client IPs behind nginx
- [x] Helmet configured, with an explicit CSP tuned so the built bundle loads
- [x] `upgrade-insecure-requests` deliberately omitted until TLS exists in Phase 11
- [x] Production error handler — no stack traces in responses
- [x] Every environment variable documented in both `.env.example` files
- [x] `frontend` build script produces `frontend/dist`
- [x] Express serves `frontend/dist` statically when `NODE_ENV=production`
- [x] Hashed assets cached one year; `index.html` never cached
- [x] SPA fallback in Express — any non-`/api` path with no file extension returns `index.html`
- [x] Root `package.json` with `build`, `start`, `seed`, and `install:all`
- [x] Bundle size checked against NFR-02 — 100.6 KB gzipped, well inside the 300 KB budget

**Done when:** with `NODE_ENV=production`, a single `node src/server.js` serves the whole application on port 5000, deep links survive a refresh, and login works over plain HTTP locally.

This phase is the rehearsal. Anything broken here will be far harder to diagnose over SSH.

**Verified against a production-mode server — 32 checks, all passing**

| Group | Covered |
|---|---|
| Serving | `/` returns the built page with the React root and a hashed bundle; the hashed asset is served with `max-age=31536000`; `index.html` returns `no-cache` |
| SPA fallback | `/login`, `/dashboard`, `/admin/users`, `/team`, and an arbitrary deep path all return `index.html` |
| Fallback limits | A missing asset returns `404` and not HTML; a missing root file `404`s; an unknown `/api` route still returns the JSON `ROUTE_NOT_FOUND` envelope |
| Headers | CSP present with `default-src 'self'` and `frame-ancestors 'none'`; no `upgrade-insecure-requests`; `nosniff`; `X-Frame-Options`; `X-Powered-By` removed |
| Production cookie | Login succeeds; cookie carries `Secure` alongside `HttpOnly` and `SameSite=Lax` |
| Error shape | A validation failure carries no `stack` field in production |
| Rate limiting | Login returns `429` after 10 failures; a correct password is blocked too once the limit is hit; the `429` uses the standard envelope and sets `RateLimit` headers; health stays reachable |

---

## Phase 9 — Server Provisioning ✅

**Goal:** the application runs on a real server, reachable by IP.

**Host: AWS EC2**, Ubuntu 24.04 LTS, micro instance. Full step-by-step commands
live in [DEPLOYMENT.md](DEPLOYMENT.md); this is the checklist.

- [x] `ecosystem.config.cjs` — pm2 process definition
- [x] Runbook written covering every step below

**Billing safety — before launching anything**

- [x] AWS account created — on the credits-based free plan, $100 expiring 2027-03-09
- [x] MFA on the root account; an IAM user for daily work
- [x] Budget alert configured - `deploylab-monthly`, $20/month, email at 80% actual
- [ ] Free tier usage alerts enabled
- [x] Free tier terms checked — this is the credits model, not the old 12-month tier, so the risk is burning the balance rather than a surprise invoice

**Instance**

- [x] **Set the region before creating anything** — `ap-south-1` (Mumbai), matching the Atlas cluster. EC2 resources are regional and cannot be moved
- [x] ed25519 key pair created and permissions fixed locally
- [x] Security group: 22 from **your IP only**, 80 and 443 open, 5000 closed
- [x] Launch Ubuntu 24.04 LTS
- [x] Elastic IP allocated and associated - 3.110.17.203
- [x] SSH in as `ubuntu` and confirm access

**Server preparation**

- [x] `apt update && apt upgrade`
- [x] **Add 2 GB swap** — do this before building anything
- [x] Create the `deploy` user with sudo rights and a copy of the SSH key
- [x] Verify SSH as `deploy` in a second terminal **before** hardening
- [x] Disable root SSH login and password authentication, checking `sshd_config.d/` too
- [x] `sudo sshd -t` before reloading
- [x] `ufw` allowing OpenSSH, 80, 443

**Application**

- [x] Install Node.js 22 LTS via NodeSource
- [x] Install git and pm2
- [x] Clone the repository
- [x] Create `backend/.env` on the server with a **freshly generated** `JWT_SECRET`
- [x] `chmod 600 backend/.env`
- [x] `npm ci` in both workspaces
- [x] Build the frontend
- [ ] Narrow the Atlas allowlist to the Elastic IP — add the new rule before removing `0.0.0.0/0`
- [x] `pm2 start ecosystem.config.cjs`
- [x] Seed the accounts
- [x] `pm2 save` and `pm2 startup`, running the exact command pm2 prints

**Done when:** on the server, `curl localhost:5000/api/health` returns
`db: "connected"` and `curl localhost:5000/` returns `200`; the same port is
**unreachable** from your own machine; and all of it still holds after
`sudo reboot`.

Note the correction: an earlier draft of this plan expected
`http://<server-ip>:5000/api/health` to answer from outside. It cannot — Phase 8
binds Express to `127.0.0.1` in production, and the security group leaves 5000
shut. Verification is over SSH until nginx exists in Phase 10, and the port
timing out from outside is itself one of the checks.

**Verified on the server, 2026-09-09**

| Check | Result |
|---|---|
| `curl localhost:5000/api/health` | `{"status":"ok","db":"connected",...}` |
| `curl localhost:5000/` | `200`, serves the built page |
| SPA deep link `/admin/users` | `200` |
| Missing asset `/assets/nope.js` | `404` — the Phase 8 fallback fix holding in production |
| `ss -tlnp` | port 5000 bound to `127.0.0.1` only; 22 the sole externally reachable port |
| Reboot | pm2 resurrected the app, swap and ufw both persisted, health green again |
| Build | Produced the same bundle hash as the local build, so the build is reproducible |

**Notes from doing it**

- The repository is private, so an anonymous HTTPS clone fails. A read-only deploy key on the server is the fix, and Phase 12 reuses it.
- Swap earned its place: the build touched 19 MiB of it on a 1 GB box.
- The `00-` prefix on the SSH hardening drop-in matters. OpenSSH takes the first value it finds for a keyword and reads `sshd_config.d/` in lexical order, so a `99-` file would have lost to the image's own `60-cloudimg-settings.conf`.
- The `deploy` user was given passwordless sudo. It is created with no password, so without that it could not use sudo at all — and this mirrors how the stock `ubuntu` user on the image is already configured.

**Expected snags:** the Vite build being killed with no error message, which is
the OOM killer and means swap was skipped; Atlas rejecting the connection after
the allowlist was narrowed to a mistyped address; `UNPROTECTED PRIVATE KEY FILE`
from Windows file permissions on the `.pem`; `Permission denied (publickey)` from
using the wrong username, since Ubuntu AMIs use `ubuntu` rather than `ec2-user`.

---

## Phase 10 — nginx Reverse Proxy ✅

**Goal:** the app is served on port 80 with nginx in front.

- [x] Install nginx
- [x] Write the site config in `/etc/nginx/sites-available/deploylab`
- [x] `location /` → `try_files $uri $uri/ /index.html` against `frontend/dist`
- [x] `location /api` → `proxy_pass http://127.0.0.1:5000`
- [x] Forward `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `Host`
- [x] Enable gzip
- [x] Cache hashed assets for one year; never cache `index.html`
- [x] Symlink into `sites-enabled`, remove the default site
- [x] `nginx -t`, then reload
- [x] Bind Express to `127.0.0.1` only
- [x] Close port 5000 in the firewall
- [x] Decide: nginx serves static files directly (preferred) or proxies everything to Express

**Done when:** `http://<server-ip>` loads the app, deep links refresh correctly, `/api/health` responds through the proxy, and port 5000 is unreachable from outside.

**Verified from the public internet, 2026-09-09** — at `13.201.93.125`, the
auto-assigned address in use at the time. The site moved to the Elastic IP
`3.110.17.203` later the same day.

| Check | Result |
|---|---|
| `/`, `/login`, `/admin/users` | `200`, `Cache-Control: no-cache` |
| `/api/health` | `200`, `db: connected` |
| Hashed bundle | `200`, gzip, `max-age=31536000, immutable` |
| `/assets/nope.js` and `/favicon.ico` | `404`, not the HTML fallback |
| Port 5000 from outside | times out |
| Client IP seen by Express | the real address, not `127.0.0.1` |

**Notes from doing it**

- nginx returned the predicted 403: workers run as `www-data` and `/home/deploy` is `0750`, so the path could not be traversed. Adding `www-data` to the `deploy` group is narrower than `chmod 755` on a home directory. It needs a restart rather than a reload, since supplementary groups are applied when workers spawn.
- The `/api` location uses `^~` so it outranks the regex location that 404s file-looking paths. Without it, a request for `/api/x.json` would be captured by the regex and never reach the proxy.
- The missing-asset rule from Phase 8 had to be rebuilt in nginx. nginx now serves static files directly, so Express never sees those requests and its own guard no longer applies.
- **Login does not work yet.** `NODE_ENV=production` marks the cookie `Secure` and browsers discard those over plain HTTP. Expected; Phase 11 resolves it.

**Expected snags:** a 502 because Express is not running or is bound to the wrong interface; a 403 because nginx cannot traverse the home directory to reach `dist` — check permissions on every parent directory.

---

## Phase 11 — Domain and HTTPS

**Goal:** a real domain served over HTTPS with automatic renewal.

- [ ] Use a free subdomain — DuckDNS, or an IP-based one like `sslip.io`. No domain is being bought for this project
- [ ] `A` record pointing at the server IP
- [ ] Wait for DNS propagation, verify with `dig`
- [ ] Update `server_name` in the nginx config
- [ ] Install certbot with the nginx plugin
- [ ] Issue the certificate
- [ ] Confirm the HTTP-to-HTTPS redirect
- [ ] Set `NODE_ENV=production` so the cookie carries `secure`
- [ ] Restart pm2 and re-test login end to end
- [ ] Verify automatic renewal with `certbot renew --dry-run`
- [ ] Optionally add HSTS
- [ ] Score the domain on SSL Labs

**Done when:** `https://yourdomain.com` loads with a valid certificate, HTTP redirects, and login works with a `secure` cookie.

**Expected snag:** login breaking the moment `NODE_ENV=production` is set, because a `secure` cookie is silently dropped over plain HTTP. Order matters — TLS first, then the flag.

---

## Phase 12 — CD ✅

**Goal:** merging to `main` deploys automatically.

CI already exists from Phase 1 — `.github/workflows/ci.yml` builds the client and smoke-tests the server on every pull request. This phase adds the *deploy* half, in a separate workflow that runs only after CI passes on `main`.

- [x] Create the GitHub repository and push
- [x] Generate a deploy SSH key pair; the public key goes in the server's `authorized_keys`
- [ ] Add GitHub Actions secrets — `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
- [x] Write `.github/workflows/deploy.yml`
- [x] Workflow steps: checkout, SSH in, `git pull`, `npm ci`, build frontend, `pm2 reload deploylab`
- [x] Post-deploy smoke test — curl `/api/health` and fail the job on a non-200
- [ ] Trigger a deployment with a trivial commit and watch it run
- [ ] Verify zero-downtime by curling in a loop during a reload
- [x] Document the rollback procedure — `git checkout <sha>`, rebuild, reload

**Design decisions**

- Triggered by `workflow_run` on CI completing, not by the push. A push-triggered deploy races the test run and can ship a commit CI is about to fail. The job guards on `conclusion == 'success'`, because `workflow_run` fires on failure too.
- `concurrency` with `cancel-in-progress: false`. Two deploys must not touch the server at once, and cancelling one mid-flight could leave a half-built tree, so the second waits.
- `SSH_KNOWN_HOSTS` is pinned. Without it the runner accepts whatever host answers at that address, which is the weakness host key verification exists to close.
- The smoke test polls `/api/health` for up to twenty seconds rather than sleeping a fixed amount. The app needs a moment to reconnect to the database after a reload.
- No automatic rollback. Reverting on the server would leave the repository and the running code disagreeing, and the next deploy would silently undo it. `git revert` on main is the supported path.
- Port 22 is opened to `0.0.0.0/0`, because GitHub runners have dynamic addresses from a large pool. The key is the actual control - passwords and root login are already disabled. The IP allowlist locked the owner out twice in one day while never being what kept attackers out.

**Done when:** a push to `main` reaches production with no manual step, and a failed health check fails the workflow loudly.

**Expected snags:** the SSH key format rejected — use `ed25519` and paste the whole key including header and footer lines; `pm2` not found because a non-interactive shell does not load the same `PATH` — use an absolute path or source the profile explicitly.

---

## Phase 13 — Docker (optional)

**Goal:** the same application, containerised.

- [ ] `backend/Dockerfile` — multi-stage, non-root user
- [ ] `frontend/Dockerfile` — build stage plus an nginx serve stage
- [ ] `.dockerignore` files
- [ ] `docker-compose.yml` wiring frontend, backend, and a local mongo service
- [ ] Named volume for mongo data
- [ ] Environment variables passed through compose
- [ ] Run the whole stack locally with `docker compose up`
- [ ] Migrate from Atlas to the containerised mongo and compare
- [ ] Deploy compose to the server
- [ ] Compare image sizes and startup times against the pm2 setup

---

## Phase 14 — Observability and Backup (optional)

- [x] `pm2-logrotate` installed and configured - 10M, daily, 7 compressed generations
- [x] Uptime monitoring on `/api/health` - UptimeRobot keyword monitor, 5-minute interval, email alert
- [ ] `pm2 monit` reviewed under load
- [x] Atlas backup situation confirmed - **M0 has none.** Continuous backup starts at M10. Documented as an accepted risk for disposable data
- [ ] A `mongodump` restore rehearsed at least once - deferred, nothing here is worth restoring
- [ ] Disk and memory alerts configured - deferred; logs now rotate and the disk sits at 34%
- [ ] `DEPLOYMENT.md` completed as a from-scratch runbook
- [ ] A full rebuild rehearsed on a fresh instance using only the runbook

---

## Notes and Blockers

Record dated entries here as work proceeds. The mistakes are the actual curriculum — write them down while the fix is fresh.

| Date | Phase | Note |
|---|---|---|
| 2026-09-08 | 0 | Documentation complete. Host choice deferred to Phase 9. |
| 2026-09-08 | 3 | Mongoose 9 does not pass `next` to an `async` hook function. The first seed run died on `next is not a function`. Async hooks signal failure by throwing or, for validation, by calling `this.invalidate(path, message)`. |
| 2026-09-08 | 3 | Hashing moved from `pre('save')` to `pre('validate')`. Mongoose validates before save hooks run, so a save hook fires after `required` has already been checked, which would force the field to hold plaintext just to pass validation. |
| 2026-09-08 | 3 | Uniqueness is enforced by the database index (error `11000`), not only by an application-level existence check. Two simultaneous registrations of the same email would both pass a `findOne` check; only the index actually stops the second write. |
| 2026-09-08 | 2 | Dropped `asyncHandler` — Express 5 forwards async rejections natively. Plan and architecture updated. |
| 2026-09-08 | 2 | Client baseline bundle: 80.86 KB gzipped, against a 300 KB budget. Plenty of headroom. |
| 2026-09-08 | 2 | Atlas connected. First failure was a key-name mismatch: `.env` had `MONGO_URI`, the schema expects `MONGODB_URI`. Zod named the exact variable, which is precisely why validation runs at startup. |
| 2026-09-08 | 2 | Database name in the connection string is `Deploylab`, capitalised. MongoDB database names are case-sensitive, so this must match everywhere — including the CI service-container URI and the production `.env`. Lowercase would be more conventional; left as-is for now. |
| 2026-09-08 | 2 | Log lines use ASCII hyphens, not em dashes. Windows consoles mangle them into `â€"`. |
| 2026-09-08 | 1 | CI pulled forward from Phase 12. Running the build and a real boot check on every PR from day one is cheaper than retrofitting it once the code is large. Phase 12 now covers deployment only. |
| 2026-09-08 | 1 | Remote repo was empty, so `main` was seeded with a bare initial commit to give pull requests a base branch. |
| 2026-09-08 | 1 | Renamed `client/` → `frontend/` and `server/` → `backend/`. "Server" was doing double duty as both a directory name and the deployment host, which will only get more confusing from Phase 9 onward. |
| 2026-09-08 | 1 | Windows gotcha: PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM. Vite rejected `package.json` as invalid JSON because of it. Use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)` when writing JSON or `.env` files on Windows. |
| 2026-09-09 | 4 | Express 5 made `req.query` a getter with no setter, so validation middleware cannot overwrite it. Parsed query params go to `req.validatedQuery` instead. Matters from Phase 5, where the user list takes query parameters. |
| 2026-09-09 | 4 | Login runs a bcrypt compare against a throwaway hash when no account matches. Skipping the hash for a missing account returns in a fraction of the time, and that timing difference re-opens exactly the account enumeration the identical error message exists to close. |
| 2026-09-09 | 4 | Cookie `maxAge` is read back off the signed token's own `exp` claim rather than parsed separately from `JWT_EXPIRES_IN`. One source of truth, so cookie and token cannot expire at different times. |
| 2026-09-09 | 4 | Zod 4 exposes `z.email()` at the top level; `z.string().email()` is the deprecated v3 form. |
| 2026-09-09 | 4 | PowerShell 5.1 re-splits a here-string containing double quotes when passing it to a native exe, so `git commit -m` received the message as separate pathspecs. Use `git commit -F <file>` for any message with quotes. |
| 2026-09-09 | 5 | Search terms are escaped before being compiled into a RegExp. Unescaped user input in a regex changes what the query matches (a `.` matching anything) and opens a denial-of-service path through catastrophic backtracking on input like `a+++++++b`. |
| 2026-09-09 | 5 | `PATCH /users/me` relies on Zod's default behaviour of stripping unknown keys, so a client posting back a whole user object cannot alter its own role or status. Verified by sending `role: admin` and confirming the database was unchanged. |
| 2026-09-09 | 5 | `getStats` seeds every role key at zero before merging the aggregation result. An aggregation only returns groups that exist, so a role with no members would otherwise be missing from the response and force the client to guard every read. |
| 2026-09-09 | 6 | `AuthProvider` must sit inside `BrowserRouter`. It calls `useNavigate` to redirect on session expiry, and that hook only exists beneath a router. |
| 2026-09-09 | 6 | The startup `/me` call passes `skipAuthRedirect`, so the shared 401 interceptor ignores it. Without that flag a guest's perfectly normal 401 triggers a redirect to `/login` from `/login`, which is a loop. |
| 2026-09-09 | 6 | `logout` clears client state in a `finally` block, so a failed network call cannot strand the user in a half-logged-out state with no way forward. |
| 2026-09-09 | 6 | Login was brought forward from Phase 7. The Phase 6 acceptance criteria are about guard behaviour, which cannot be exercised without a way to actually log in. |
| 2026-09-09 | 6 | Vite's dev server returns `index.html` for unknown paths automatically. nginx does not - Phase 10 must configure `try_files $uri $uri/ /index.html` explicitly, or every route except `/` will 404 on refresh in production. |
| 2026-09-09 | 6 | A cleanup command that stopped every node process on the machine, rather than only the PIDs it started, killed unrelated dev servers. Scope process cleanup to recorded PIDs. |
| 2026-09-09 | 7 | Row updates are applied to state only after the request succeeds. Because every control reads its value from state, a failed change snaps the dropdown or toggle back on its own -- there is no separate rollback path that could be written wrong. |
| 2026-09-09 | 7 | The role filter must be omitted rather than sent as an empty string, and the manager dropdown's blank option must be converted to `null`. Both are rejected 400 otherwise; confirmed by asserting the rejection rather than assuming it. |
| 2026-09-09 | 7 | Reactivating an account happens immediately, deactivating asks first. Confirmation prompts are for actions people regret, and one on every toggle just trains them to click through. |
| 2026-09-09 | 7 | Search is debounced 300ms. Without it every keystroke is a database query. |
| 2026-09-09 | 7 | React 19 passes `ref` as an ordinary prop to function components, so `Modal` can focus the confirm button through `Button` without `forwardRef`. |
| 2026-09-09 | 7 | Editing this file with a shell append invalidates the editing tool's cached copy, and later edits fail with `String not found` even when the text is plainly there. Re-read the file after any out-of-band write. |
| 2026-09-09 | 8 | Express 5 upgraded path-to-regexp and `app.get('*')` is no longer valid syntax - it throws at startup. The SPA fallback is written as middleware instead, which is clearer anyway. |
| 2026-09-09 | 8 | First run of the production check caught a real bug: a missing asset fell through to `index.html` with a 200. A stale page requesting a deleted bundle would then get HTML where JavaScript was expected, surfacing as `Unexpected token '<'`. Paths with a file extension now skip the fallback and 404 properly. |
| 2026-09-09 | 8 | The login limiter counts failures only. A successful login is evidence the password is already known, so counting it would lock out someone signing in across several devices while doing nothing extra against an attacker. Once the limit is reached the endpoint closes for that IP regardless - lifting it on a correct password would remove the block at exactly the moment an attacker guessed right. |
| 2026-09-09 | 8 | `upgrade-insecure-requests` is left out of the CSP until Phase 11. It rewrites requests to https, which makes a production build untestable locally over plain HTTP. |
| 2026-09-09 | 8 | Rate limit counters are in memory: they reset on restart and are per-process. Fine for one instance; pm2 cluster mode would need a shared store. |
| 2026-09-09 | 8 | `index.html` must never be cached while hashed assets are cached hard. Caching the entry point leaves browsers loading an old page that points at assets the last deploy deleted. |
| 2026-09-09 | 9 | The repository is private, so cloning over anonymous HTTPS fails with `could not read Username`. A read-only deploy key scoped to the one repo beats a personal access token: nothing to renew, and the server can pull but never push. |
| 2026-09-09 | 9 | Swap was used during the build on the 1 GB instance. Without it the OOM killer would have terminated the build with no error message. |
| 2026-09-09 | 9 | Production and development currently share one Atlas database. A local seed or delete now reaches production data. Acceptable while learning; a separate database name is the fix. |
| 2026-09-09 | 9 | Health returned an empty body when queried immediately after reboot, because Mongoose had not finished connecting. Not a fault - reporting that state is what the endpoint is for. |
| 2026-09-09 | 10 | nginx 403 on a readable file: workers run as `www-data` and `/home/deploy` is 0750, so the path cannot be traversed. Fixed by adding `www-data` to the `deploy` group, which is narrower than opening the home directory to every local account. Requires restart, not reload. |
| 2026-09-09 | 10 | The `/api` location needs `^~`. nginx checks regex locations before remaining prefix locations, so without it the file-extension rule would capture `/api/x.json` and 404 instead of proxying. |
| 2026-09-09 | 10 | Moving static serving to nginx silently dropped the Phase 8 missing-asset guard, because Express no longer sees those requests. The rule had to be written again in nginx. Worth remembering whenever responsibility moves between layers. |
| 2026-09-09 | 9 | Associating an Elastic IP to a running instance also changes the server's outbound address, which severed every open Atlas connection. Health reported 503 with db: disconnected for about thirty seconds, then recovered on its own - Mongoose reconnects, and the health endpoint is what made the moment legible rather than mysterious. |
| 2026-09-10 | 12 | The home IP rotated overnight and SSH stopped working, while the site stayed up on port 80. Second lockout in a day from the same allowlist. It never kept an attacker out - key-only auth does that - so port 22 was opened and the rule dropped. |
| 2026-09-10 | 12 | First deploy failed on `Host key verification failed`. The key matched the server exactly, so the fault was in the copy into the secret box: invisible, and slow to debug at a minute per run. Moved the host key into the workflow file, where it is reviewable in a diff and cannot be mis-pasted. A host public key is not secret. |
| 2026-09-10 | 12 | Deploy fired on the merge that introduced the workflow, contrary to my expectation that workflow_run needs the file present on main beforehand. |
| 2026-09-10 | 12 | Branch protection deliberately skipped - solo project. Lower risk than it sounds, because the deploy job gates on the CI conclusion: a red build cannot reach the server even if the merge goes through. |
| 2026-09-10 | 14 | pm2 logs were unbounded. A full disk breaks apt, nginx and pm2 simultaneously, so this was worth doing before it mattered rather than after. |
| 2026-09-10 | 14 | Monitoring is external on purpose. A check running on the server cannot report the server being down, which is the failure that matters most. |
| 2026-09-10 | 14 | Keyword monitoring on `\"db\":\"connected\"` rather than a plain status check. Health already returns 503 when the database is unreachable, so a status check would work, but keyword matching also catches a 200 that reports something wrong - it checks the answer, not just that something answered. |
| 2026-09-10 | 14 | Atlas M0 has no automated backups; continuous backup begins at M10. Accepted here because the data is disposable, and written down so it stays a decision rather than an assumption. |
