# Implementation Plan — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Started | 2026-09-08 |
| Current phase | Phase 5 |

Tick boxes as work completes. Phases 1–8 build the application; phases 9–14 are the actual point of the project.

**Progress**

- [x] Phase 0 — Documentation
- [x] Phase 1 — Repository and tooling
- [x] Phase 2 — Backend foundation
- [x] Phase 3 — Data model and seeding
- [x] Phase 4 — Authentication
- [ ] Phase 5 — RBAC and user management
- [ ] Phase 6 — Frontend foundation
- [ ] Phase 7 — Frontend screens
- [ ] Phase 8 — Hardening and production build
- [ ] Phase 9 — Server provisioning
- [ ] Phase 10 — nginx reverse proxy
- [ ] Phase 11 — Domain and HTTPS
- [ ] Phase 12 — CI/CD
- [ ] Phase 13 — Docker (optional)
- [ ] Phase 14 — Observability and backup (optional)

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

## Phase 5 — RBAC and User Management

**Goal:** every endpoint from API_SPEC exists and enforces its role.

- [ ] `src/middleware/requireRole.js` — factory accepting one or more roles
- [ ] `src/services/user.service.js` — list, stats, change role, change status, assign manager, team
- [ ] `PATCH /api/users/me`
- [ ] `GET /api/users` with pagination, role filter, and search
- [ ] `GET /api/users/stats`
- [ ] `PATCH /api/users/:id/role` including the self-change guard
- [ ] `PATCH /api/users/:id/status` including the self-deactivation guard
- [ ] `PATCH /api/users/:id/manager` including the self-manager and role guards
- [ ] `GET /api/users/team`
- [ ] Route ordering checked — `/users/team` and `/users/stats` must be declared before `/users/:id`, or Express will match `team` as an id

**Verify**

- [ ] Employee calling `GET /api/users` receives `403`
- [ ] Manager calling `GET /api/users` receives `403`
- [ ] Admin changing their own role receives `400`
- [ ] Manager's `/team` returns only their own reports
- [ ] A manager with no reports receives `200` with an empty array, not `404`

---

## Phase 6 — Frontend Foundation

**Goal:** the app shell renders, the session survives a refresh, and route guards work.

- [ ] Vite proxy configured — `/api` to `http://localhost:5000`
- [ ] React Router installed and the route table written
- [ ] `src/api/client.js` — Axios instance with `withCredentials: true`
- [ ] 401 response interceptor, with the startup `/me` call excluded
- [ ] `src/context/AuthContext.jsx` — user, loading, login, register, logout, refresh
- [ ] Initial `/me` call on mount, with a full-page loading state
- [ ] `ProtectedRoute`, `GuestRoute`, `RoleRoute` components
- [ ] `AppShell` with header and role-aware navigation
- [ ] Base UI components — Button, Input, Badge, Spinner, Toast, Modal, Table
- [ ] Base styling and layout

**Done when:** refreshing while logged in restores the session with no flash of the login screen, and a logged-out user hitting `/dashboard` lands on `/login`.

---

## Phase 7 — Frontend Screens

**Goal:** every screen in the FRD is built and behaves correctly.

- [ ] `Login.jsx` — validation, error states, redirect to the originally requested route
- [ ] `Register.jsx` — validation including password confirmation
- [ ] `Dashboard.jsx` — role-branching content
- [ ] `Profile.jsx` — view and inline name editing
- [ ] `AdminUsers.jsx` — table, filter, pagination
- [ ] Role dropdown with a confirmation dialog and optimistic revert on failure
- [ ] Status toggle with a confirmation dialog on deactivation
- [ ] Manager assignment dropdown
- [ ] Own-row controls disabled with an explanatory tooltip
- [ ] `Team.jsx` — read-only table with an empty state
- [ ] `NotFound.jsx`
- [ ] Loading, empty, and error states on every data-fetching screen
- [ ] Responsive down to 360 px

**Run the FRD §9 acceptance scenarios**

- [ ] AT-01 through AT-13 all pass

---

## Phase 8 — Hardening and Production Build

**Goal:** the production build runs from a single Node process, exactly as it will on the server.

- [ ] `express-rate-limit` on auth routes and globally
- [ ] `app.set('trust proxy', 1)` for correct client IPs behind nginx
- [ ] Helmet configured, with CSP tuned so the built bundle loads
- [ ] Production error handler — no stack traces in responses
- [ ] Every environment variable documented in both `.env.example` files
- [ ] `frontend` build script produces `frontend/dist`
- [ ] Express serves `frontend/dist` statically when `NODE_ENV=production`
- [ ] SPA fallback in Express — any non-`/api` path returns `index.html`
- [ ] `npm run build` at the root builds the client
- [ ] Bundle size checked against NFR-02 (300 KB gzipped)

**Done when:** with `NODE_ENV=production`, a single `node src/server.js` serves the whole application on port 5000, deep links survive a refresh, and login works over plain HTTP locally.

This phase is the rehearsal. Anything broken here will be far harder to diagnose over SSH.

---

## Phase 9 — Server Provisioning

**Goal:** the application runs on a real server, reachable by IP.

- [ ] Choose the host — EC2 `t3.micro` or an equivalent VPS
- [ ] Launch Ubuntu 24.04 LTS
- [ ] Create and store the SSH key pair
- [ ] Security group / firewall: allow 22, 80, 443 only
- [ ] SSH in and confirm access
- [ ] `apt update && apt upgrade`
- [ ] Create a non-root deploy user with sudo rights
- [ ] Disable root SSH login and password authentication
- [ ] Install Node.js 22 LTS via NodeSource
- [ ] Install git
- [ ] Install pm2 globally
- [ ] Clone the repository
- [ ] Create `backend/.env` on the server — never committed, never copied from a chat window
- [ ] `npm ci` in both workspaces
- [ ] Build the client
- [ ] Start under pm2, named `deploylab`
- [ ] `pm2 save` and `pm2 startup` for boot persistence
- [ ] Narrow the Atlas IP allowlist to the server's public IP
- [ ] Attach a static IP — Elastic IP on AWS — so the allowlist entry stays valid across reboots

**Done when:** `http://<server-ip>:5000/api/health` responds, the app survives `sudo reboot`, and `pm2 logs deploylab` shows clean startup.

**Expected snags:** Atlas rejecting the connection because the allowlist was narrowed to the wrong IP; a build running out of memory on 1 GB RAM — add swap if so.

---

## Phase 10 — nginx Reverse Proxy

**Goal:** the app is served on port 80 with nginx in front.

- [ ] Install nginx
- [ ] Write the site config in `/etc/nginx/sites-available/deploylab`
- [ ] `location /` → `try_files $uri $uri/ /index.html` against `frontend/dist`
- [ ] `location /api` → `proxy_pass http://127.0.0.1:5000`
- [ ] Forward `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `Host`
- [ ] Enable gzip
- [ ] Cache hashed assets for one year; never cache `index.html`
- [ ] Symlink into `sites-enabled`, remove the default site
- [ ] `nginx -t`, then reload
- [ ] Bind Express to `127.0.0.1` only
- [ ] Close port 5000 in the firewall
- [ ] Decide: nginx serves static files directly (preferred) or proxies everything to Express

**Done when:** `http://<server-ip>` loads the app, deep links refresh correctly, `/api/health` responds through the proxy, and port 5000 is unreachable from outside.

**Expected snags:** a 502 because Express is not running or is bound to the wrong interface; a 403 because nginx cannot traverse the home directory to reach `dist` — check permissions on every parent directory.

---

## Phase 11 — Domain and HTTPS

**Goal:** a real domain served over HTTPS with automatic renewal.

- [ ] Obtain a domain, or use a free subdomain
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

## Phase 12 — CD

**Goal:** merging to `main` deploys automatically.

CI already exists from Phase 1 — `.github/workflows/ci.yml` builds the client and smoke-tests the server on every pull request. This phase adds the *deploy* half, in a separate workflow that runs only after CI passes on `main`.

- [x] Create the GitHub repository and push
- [ ] Generate a deploy SSH key pair; the public key goes in the server's `authorized_keys`
- [ ] Add GitHub Actions secrets — `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
- [ ] Write `.github/workflows/deploy.yml`
- [ ] Workflow steps: checkout, SSH in, `git pull`, `npm ci`, build frontend, `pm2 reload deploylab`
- [ ] Post-deploy smoke test — curl `/api/health` and fail the job on a non-200
- [ ] Trigger a deployment with a trivial commit and watch it run
- [ ] Verify zero-downtime by curling in a loop during a reload
- [ ] Document the rollback procedure — `git checkout <sha>`, rebuild, reload

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

- [ ] `pm2-logrotate` installed and configured
- [ ] Uptime monitoring on `/api/health` — UptimeRobot or similar
- [ ] `pm2 monit` reviewed under load
- [ ] Atlas automated backup confirmed
- [ ] A `mongodump` restore rehearsed at least once
- [ ] Disk and memory alerts configured
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
