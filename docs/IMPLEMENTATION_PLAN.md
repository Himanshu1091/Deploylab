# Implementation Plan — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Started | 2026-09-08 |
| Current phase | Phase 3 |

Tick boxes as work completes. Phases 1–8 build the application; phases 9–14 are the actual point of the project.

**Progress**

- [x] Phase 0 — Documentation
- [x] Phase 1 — Repository and tooling
- [x] Phase 2 — Backend foundation
- [ ] Phase 3 — Data model and seeding
- [ ] Phase 4 — Authentication
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
- [ ] Create the Atlas M0 cluster (region `ap-south-1`) — *manual step*
- [ ] Create the Atlas database user and record the password — *manual step*
- [ ] Allow `0.0.0.0/0` in Atlas Network Access, to be narrowed in Phase 9 — *manual step*
- [ ] Paste the connection string into `server/.env` — *manual step*
- [x] Scaffold `server/` — dependencies installed, folder tree created
- [x] Scaffold `client/` — Vite + React, dependencies installed
- [x] Write `server/.env.example` and `client/.env.example`
- [x] Generate `JWT_SECRET` into `server/.env`
- [x] First commit
- [x] Add the GitHub remote — `Himanshu1091/Deploylab`
- [x] `.github/workflows/ci.yml` — client build plus a server smoke test against a MongoDB service container
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

**Verified so far:** env validation correctly refuses to boot with an empty `MONGODB_URI`. The connected path is pending the Atlas string.

---

## Phase 3 — Data Model and Seeding

**Goal:** the `users` collection exists with three test accounts.

- [ ] `src/models/User.js` — full schema per ARCHITECTURE §6
- [ ] `passwordHash` marked `select: false`
- [ ] Pre-save hook hashing the password with bcrypt cost 12
- [ ] Instance method `comparePassword`
- [ ] Indexes on `email` (unique), `managerId`, `role`
- [ ] `toJSON` transform — expose `id`, strip `_id`, `__v`, and `passwordHash`
- [ ] `scripts/seed.js` creating one admin, one manager, one employee, with the employee assigned to the manager
- [ ] `npm run seed` script

**Done when:** seeding produces exactly three users in Atlas, re-running it does not duplicate them, and no document leaks a plaintext password.

---

## Phase 4 — Authentication

**Goal:** register, log in, restore session, log out.

- [ ] `src/validators/auth.schema.js` — Zod schemas for register and login
- [ ] `src/middleware/validate.js` — generic schema validation middleware
- [ ] `src/services/auth.service.js` — register, login, token signing
- [ ] `src/controllers/auth.controller.js` — cookie setting and clearing
- [ ] `POST /api/auth/register`
- [ ] `POST /api/auth/login`
- [ ] `POST /api/auth/logout`
- [ ] `GET /api/auth/me`
- [ ] `src/middleware/requireAuth.js` — verify JWT, load the user, reject when inactive
- [ ] Cookie flags correct per environment — `secure` only in production

**Verify with a REST client**

- [ ] Register returns `201` and a `Set-Cookie` header
- [ ] Duplicate email returns `409`
- [ ] Wrong password returns `401`
- [ ] Unknown email returns `401` with the *same* message as a wrong password
- [ ] `/me` without a cookie returns `401`
- [ ] `/me` with a cookie returns the user, and no `passwordHash`
- [ ] Logout clears the cookie
- [ ] A deactivated user is refused at login with `403`

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
- [ ] `client` build script produces `client/dist`
- [ ] Express serves `client/dist` statically when `NODE_ENV=production`
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
- [ ] Create `server/.env` on the server — never committed, never copied from a chat window
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
- [ ] `location /` → `try_files $uri $uri/ /index.html` against `client/dist`
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
- [ ] Workflow steps: checkout, SSH in, `git pull`, `npm ci`, build client, `pm2 reload deploylab`
- [ ] Post-deploy smoke test — curl `/api/health` and fail the job on a non-200
- [ ] Trigger a deployment with a trivial commit and watch it run
- [ ] Verify zero-downtime by curling in a loop during a reload
- [ ] Document the rollback procedure — `git checkout <sha>`, rebuild, reload

**Done when:** a push to `main` reaches production with no manual step, and a failed health check fails the workflow loudly.

**Expected snags:** the SSH key format rejected — use `ed25519` and paste the whole key including header and footer lines; `pm2` not found because a non-interactive shell does not load the same `PATH` — use an absolute path or source the profile explicitly.

---

## Phase 13 — Docker (optional)

**Goal:** the same application, containerised.

- [ ] `server/Dockerfile` — multi-stage, non-root user
- [ ] `client/Dockerfile` — build stage plus an nginx serve stage
- [ ] `.dockerignore` files
- [ ] `docker-compose.yml` wiring client, server, and a local mongo service
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
| 2026-09-08 | 2 | Dropped `asyncHandler` — Express 5 forwards async rejections natively. Plan and architecture updated. |
| 2026-09-08 | 2 | Client baseline bundle: 80.86 KB gzipped, against a 300 KB budget. Plenty of headroom. |
| 2026-09-08 | 1 | Blocked on the Atlas connection string before the DB path can be verified. |
| 2026-09-08 | 1 | CI pulled forward from Phase 12. Running the build and a real boot check on every PR from day one is cheaper than retrofitting it once the code is large. Phase 12 now covers deployment only. |
| 2026-09-08 | 1 | Remote repo was empty, so `main` was seeded with a bare initial commit to give pull requests a base branch. |
