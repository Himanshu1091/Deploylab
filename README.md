# Deploylab

A deliberately small MERN application whose real purpose is **learning end-to-end deployment**.

The app itself is an RBAC dashboard shell: users log in, and what they see depends on their role. There is no deep business logic on purpose — the interesting problems live in the deployment pipeline, not the feature set.

## Why this exists

Most tutorials teach you to build an app and stop at `npm run dev`. This repo goes the other way: build the smallest credible app that still has the things that break in production (auth cookies, environment variables, build artifacts, a database over the network, a reverse proxy), then deploy it properly and document every step.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + React Router + Axios |
| Backend | Node 24 + Express 5 |
| Database | MongoDB Atlas (M0 free tier) via Mongoose |
| Auth | JWT in an httpOnly cookie |
| Process manager | pm2 |
| Reverse proxy | nginx |
| CI/CD | GitHub Actions |

## Roles

| Role | Can see |
|---|---|
| `admin` | All users, can change any user's role and activation status |
| `manager` | Own profile plus a read-only list of their direct reports |
| `employee` | Own profile only |

## Repo layout

```
deploylab/
├── frontend/        React app (Vite)
├── backend/         Express API
├── docs/            SRS, FRD, architecture, plan, API spec, deploy runbook
└── README.md
```

## Documentation

| Document | What it covers |
|---|---|
| [SRS.md](docs/SRS.md) | Scope, functional and non-functional requirements, constraints |
| [FRD.md](docs/FRD.md) | Screen-by-screen behaviour, validation rules, acceptance criteria |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System topology, data model, auth flow, dev vs prod differences |
| [API_SPEC.md](docs/API_SPEC.md) | Every endpoint, request/response shapes, status codes |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phase-by-phase checklist from empty folder to live HTTPS site |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | The runbook — filled in as each deployment phase is completed |

## Getting started

**1. Create the Atlas cluster** (one-time, manual)

M0 free tier, region `ap-south-1`. Create a database user, allow `0.0.0.0/0` under Network Access for now, then copy the connection string from Connect → Drivers.

**2. Configure the backend**

`backend/.env` already exists with a generated `JWT_SECRET`. Paste the Atlas string into `MONGODB_URI`, remembering to substitute the real password and to add `/deploylab` before the query string:

```
mongodb+srv://user:realpassword@cluster0.xxxxx.mongodb.net/deploylab?retryWrites=true&w=majority
```

**3. Run both workspaces** — two terminals

```bash
cd backend  && npm run dev   # http://localhost:5000
cd frontend && npm run dev   # http://localhost:5173
```

Open `http://localhost:5173`. The boot page reports API and database status; both green means the plumbing is sound.

**4. Seed test accounts**

```bash
cd backend && npm run seed          # idempotent — safe to re-run
cd backend && npm run seed -- --reset   # wipe users first, then recreate
```

Creates one account per role. Passwords come from `SEED_*` in `backend/.env`.

| Role | Email |
|---|---|
| admin | `admin@deploylab.local` |
| manager | `manager@deploylab.local` |
| employee | `employee@deploylab.local` |

## Running the production build locally

This is exactly how the app runs on the server: one Node process serving both the API and the built frontend.

```bash
npm run build                      # builds frontend/dist
cd backend && NODE_ENV=production npm start
```

Open `http://localhost:5000`. On Windows PowerShell, set the variable separately:

```powershell
$env:NODE_ENV = 'production'; npm start
```

Note that `NODE_ENV=production` makes the session cookie `Secure`, which browsers drop over plain HTTP. Logging in through a browser therefore fails locally until TLS exists — expected, and the reason Phase 11 comes before switching production on for real.

## Status

Phases 0–8 complete. The application is feature-complete for v1.0, hardened, and verified running as a single production process serving both the API and the built frontend.

**Running live on AWS EC2 at http://13.201.93.125** — nginx serving the built frontend and proxying the API to Node under pm2. Login needs TLS first (the session cookie is ``Secure``), which is Phase 11.

Target is **AWS EC2**, Ubuntu 24.04 — see [DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full runbook, starting from an empty AWS account.

Sign in with any seeded account to see the role-appropriate experience.

**Live endpoints**

| Method | Path | Role |
|---|---|---|
| GET | `/api/health` | — |
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | any |
| PATCH | `/api/users/me` | any |
| GET | `/api/users` | admin |
| GET | `/api/users/stats` | admin |
| PATCH | `/api/users/:id/role` | admin |
| PATCH | `/api/users/:id/status` | admin |
| PATCH | `/api/users/:id/manager` | admin |
| GET | `/api/users/team` | manager |

See [API_SPEC.md](docs/API_SPEC.md) for request and response shapes.
