# Software Requirements Specification — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-09-08 |
| Status | Approved for build |
| Author | Himanshu |

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for **Deploylab**, a role-based access control (RBAC) dashboard application built on the MERN stack.

The application's functional scope is intentionally minimal. Its primary purpose is to serve as a realistic but small deployment target, so that the full production lifecycle — provisioning, process management, reverse proxying, TLS, and continuous deployment — can be learned and documented without the feature set becoming a distraction.

### 1.2 Scope

Deploylab provides:

- Account registration and email/password authentication
- Session management via a signed JWT stored in an httpOnly cookie
- Three authorisation roles (`admin`, `manager`, `employee`) with distinct post-login dashboards
- Administrative user management (list users, change role, activate/deactivate)
- A manager view of direct reports
- A health endpoint for infrastructure monitoring

Deploylab explicitly does **not** provide: payments, file uploads, real-time features, notifications, search, reporting, or multi-tenancy.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| RBAC | Role-Based Access Control — permissions attach to roles, roles attach to users |
| JWT | JSON Web Token, the signed credential proving a user's identity |
| httpOnly cookie | A cookie unreadable by JavaScript, which mitigates token theft via XSS |
| Same-origin deployment | Frontend and API served from one hostname, removing the need for CORS |
| M0 | MongoDB Atlas's free shared-cluster tier |
| pm2 | A Node.js process manager providing restarts, clustering, and log handling |

### 1.4 References

- [FRD.md](FRD.md) — detailed functional behaviour
- [ARCHITECTURE.md](ARCHITECTURE.md) — technical design
- [API_SPEC.md](API_SPEC.md) — interface contract

---

## 2. Overall Description

### 2.1 Product perspective

Deploylab is a standalone, self-contained web application. It depends on exactly one external service: a MongoDB Atlas cluster. It integrates with no third-party APIs, which keeps the deployment surface small and the failure modes easy to reason about.

### 2.2 User classes

| Class | Technical skill | Frequency of use | Privileges |
|---|---|---|---|
| Employee | Low | Occasional | Read own profile, edit own name |
| Manager | Low | Occasional | Employee privileges plus read-only access to direct reports |
| Admin | Medium | Occasional | Full user management across the system |

### 2.3 Operating environment

**Client:** Any evergreen browser (Chrome, Edge, Firefox, Safari — latest two versions). Desktop and mobile viewports.

**Server:** Ubuntu 22.04 LTS or 24.04 LTS, Node.js 22+ LTS, nginx 1.24+, single virtual machine (AWS EC2 `t3.micro` or an equivalent VPS).

**Database:** MongoDB Atlas M0, region `ap-south-1` (Mumbai).

### 2.4 Design and implementation constraints

| ID | Constraint | Rationale |
|---|---|---|
| C-01 | Frontend and backend must be served same-origin in production | Removes CORS and cookie-domain complexity; matches common real-world nginx deployments |
| C-02 | The JWT must live in an httpOnly cookie, never in `localStorage` | `localStorage` tokens are readable by any injected script |
| C-03 | No secret may be committed to the repository | Secrets belong in `.env` files and CI secret stores |
| C-04 | The application must run on a single 1 GB RAM instance | Free-tier budget |
| C-05 | The database must remain within Atlas M0 limits (512 MB storage, 500 connections) | Free-tier budget |
| C-06 | Monorepo, one Git repository | One `git pull` per deploy; simpler CI |

### 2.5 Assumptions and dependencies

- MongoDB Atlas remains available and its free tier unchanged.
- A domain name will be available before the TLS phase; until then the app is reachable by IP over plain HTTP.
- Only one application instance runs at a time; horizontal scaling is out of scope.
- The initial `admin` account is created by a seed script, not through the UI.

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The system shall allow a visitor to register with name, email, and password. | Must |
| FR-02 | The system shall reject registration when the email already exists, returning `409 Conflict`. | Must |
| FR-03 | The system shall store passwords only as bcrypt hashes with a cost factor of at least 10. | Must |
| FR-04 | The system shall assign the role `employee` to every self-registered account. | Must |
| FR-05 | The system shall allow a registered user to log in with email and password. | Must |
| FR-06 | On successful login the system shall issue a signed JWT in an httpOnly cookie. | Must |
| FR-07 | The system shall return an identical, non-specific error for a wrong email and a wrong password, to avoid disclosing which accounts exist. | Must |
| FR-08 | The system shall refuse login for a deactivated account, returning `403 Forbidden`. | Must |
| FR-09 | The system shall expose an endpoint returning the currently authenticated user's profile. | Must |
| FR-10 | The system shall allow a user to log out, clearing the session cookie. | Must |
| FR-11 | The JWT shall expire after a configurable period, defaulting to 24 hours. | Must |
| FR-12 | The system shall rate-limit login attempts per IP address. | Should |

### 3.2 Authorisation

| ID | Requirement | Priority |
|---|---|---|
| FR-13 | The system shall reject unauthenticated requests to protected endpoints with `401 Unauthorized`. | Must |
| FR-14 | The system shall reject authenticated requests lacking the required role with `403 Forbidden`. | Must |
| FR-15 | Role checks shall be enforced on the server; client-side route guards are a usability aid only and shall not be relied upon for security. | Must |
| FR-16 | The system shall route each user to a role-appropriate dashboard after login. | Must |

### 3.3 Profile

| ID | Requirement | Priority |
|---|---|---|
| FR-17 | Any authenticated user shall be able to view their own profile: name, email, role, and join date. | Must |
| FR-18 | Any authenticated user shall be able to update their own name. | Should |
| FR-19 | No user shall be able to change their own role. | Must |

### 3.4 Admin user management

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | An admin shall be able to list all users with name, email, role, status, and join date. | Must |
| FR-21 | The user list shall be paginated, defaulting to 20 records per page. | Should |
| FR-22 | An admin shall be able to filter the user list by role. | Could |
| FR-23 | An admin shall be able to change any user's role to `admin`, `manager`, or `employee`. | Must |
| FR-24 | An admin shall not be able to change their own role, preventing accidental self-demotion and system lockout. | Must |
| FR-25 | An admin shall be able to deactivate and reactivate any account other than their own. | Must |
| FR-26 | An admin shall be able to assign a manager to an employee. | Should |

### 3.5 Manager view

| ID | Requirement | Priority |
|---|---|---|
| FR-27 | A manager shall be able to list users assigned to them as direct reports. | Must |
| FR-28 | The manager view shall be strictly read-only. | Must |
| FR-29 | A manager with no assigned reports shall see an explanatory empty state, not an error. | Should |

### 3.6 Operations

| ID | Requirement | Priority |
|---|---|---|
| FR-30 | The system shall expose an unauthenticated `GET /api/health` endpoint reporting service and database status. | Must |
| FR-31 | The system shall provide a seed script creating one user per role for testing. | Must |
| FR-32 | The system shall log every request with method, path, status, and duration. | Should |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|---|---|
| NFR-01 | API responses shall complete within 500 ms at the 95th percentile under a load of 10 concurrent users. |
| NFR-02 | The production JavaScript bundle shall not exceed 300 KB gzipped. |
| NFR-03 | First Contentful Paint shall occur within 2 seconds on a 4G connection. |

### 4.2 Security

| ID | Requirement |
|---|---|
| NFR-04 | All production traffic shall be served over HTTPS, with HTTP requests redirected to HTTPS. |
| NFR-05 | Session cookies shall carry `httpOnly`, `sameSite=lax`, and — in production — `secure`. |
| NFR-06 | Security headers shall be applied via Helmet. |
| NFR-07 | All request bodies shall be validated against a schema before reaching business logic. |
| NFR-08 | Password hashes shall never appear in any API response or log line. |
| NFR-09 | Stack traces shall never be returned to clients in production. |
| NFR-10 | The database user shall hold only `readWrite` permission on the application database. |

### 4.3 Reliability and availability

| ID | Requirement |
|---|---|
| NFR-11 | pm2 shall restart the application automatically on crash. |
| NFR-12 | The application shall start automatically on server reboot. |
| NFR-13 | The application shall retry the initial database connection with backoff rather than exiting immediately. |
| NFR-14 | The application shall shut down gracefully on `SIGTERM`, draining in-flight requests. |

### 4.4 Maintainability

| ID | Requirement |
|---|---|
| NFR-15 | Every environment variable shall be documented in `.env.example`. |
| NFR-16 | A deployment shall be reproducible by following `DEPLOYMENT.md` alone, with no undocumented steps. |
| NFR-17 | Backend code shall be organised by responsibility: routes, controllers, services, models, middleware. |

### 4.5 Usability

| ID | Requirement |
|---|---|
| NFR-18 | The interface shall be usable at viewport widths from 360 px upward. |
| NFR-19 | Every failed action shall display a human-readable message, never a raw error code. |
| NFR-20 | Every asynchronous action shall display a loading state. |

---

## 5. Out of Scope

The following are explicitly excluded from version 1.0:

- Password reset and email verification
- Refresh-token rotation (a single 24-hour access token is used instead)
- OAuth or social login
- Two-factor authentication
- Audit logging of administrative actions
- Soft deletion or account deletion
- File uploads and avatars
- Internationalisation
- Dark mode
- Automated test suites (added only if time permits after deployment is complete)

---

## 6. Acceptance Criteria

Version 1.0 is complete when all of the following hold:

1. All `Must` priority functional requirements are implemented and manually verified.
2. Three seeded accounts — one per role — each log in and land on the correct dashboard.
3. An employee who manually navigates to `/admin` is denied by the server, not merely hidden by the client.
4. The application is reachable over HTTPS at a real domain name.
5. `git push` to `main` triggers an automatic deployment that completes without manual intervention.
6. `DEPLOYMENT.md` reconstructs the entire environment from a blank server.
