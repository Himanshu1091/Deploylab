# Implementation Plan — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Started | 2026-09-08 |
| Current phase | Phase 9 |

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
