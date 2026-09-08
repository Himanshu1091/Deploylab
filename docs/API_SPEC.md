# API Specification — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Base path | `/api` |
| Content type | `application/json` |
| Authentication | JWT in an httpOnly cookie named `token`, sent automatically by the browser |

---

## Conventions

**Success envelope**

```json
{ "success": true, "data": { } }
```

**Error envelope**

```json
{ "success": false, "message": "Incorrect email or password.", "code": "UNAUTHORIZED" }
```

**User object** — returned wherever a user appears. `passwordHash` is never included.

```json
{
  "id": "66f1a2b3c4d5e6f708192a3b",
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "role": "employee",
  "managerId": "66f1a2b3c4d5e6f708192a40",
  "isActive": true,
  "createdAt": "2026-09-08T10:30:00.000Z"
}
```

---

## Endpoint Index

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/health` | — | — |
| POST | `/api/auth/register` | — | — |
| POST | `/api/auth/login` | — | — |
| POST | `/api/auth/logout` | Cookie | Any |
| GET | `/api/auth/me` | Cookie | Any |
| PATCH | `/api/users/me` | Cookie | Any |
| GET | `/api/users` | Cookie | `admin` |
| GET | `/api/users/stats` | Cookie | `admin` |
| PATCH | `/api/users/:id/role` | Cookie | `admin` |
| PATCH | `/api/users/:id/status` | Cookie | `admin` |
| PATCH | `/api/users/:id/manager` | Cookie | `admin` |
| GET | `/api/users/team` | Cookie | `manager` |

---

## 1. Health

### `GET /api/health`

No authentication. Used by uptime monitors and post-deploy smoke tests.

**200**
```json
{ "status": "ok", "db": "connected", "uptime": 3841.22, "timestamp": "2026-09-08T10:30:00.000Z" }
```

**503** — database unreachable
```json
{ "status": "degraded", "db": "disconnected", "uptime": 12.04, "timestamp": "2026-09-08T10:30:00.000Z" }
```

---

## 2. Authentication

### `POST /api/auth/register`

Creates an account and logs the user in immediately. Role is always `employee` — it is not accepted from the request body.

**Request**
```json
{ "name": "Priya Sharma", "email": "priya@example.com", "password": "hunter2pass" }
```

| Field | Rules |
|---|---|
| `name` | Required, 2–60 characters |
| `email` | Required, valid format, max 254, stored lowercase |
| `password` | Required, 8–72 characters, at least one letter and one digit |

**201** — sets the `token` cookie
```json
{ "success": true, "data": { "user": { "id": "…", "name": "Priya Sharma", "email": "priya@example.com", "role": "employee", "isActive": true, "createdAt": "…" } } }
```

| Error | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Field-specific validation message |
| 409 | `EMAIL_EXISTS` | "An account with this email already exists." |

---

### `POST /api/auth/login`

**Request**
```json
{ "email": "priya@example.com", "password": "hunter2pass" }
```

**200** — sets the `token` cookie
```json
{ "success": true, "data": { "user": { } } }
```

| Error | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | "Email and password are required." |
| 401 | `INVALID_CREDENTIALS` | "Incorrect email or password." |
| 403 | `ACCOUNT_DISABLED` | "This account has been deactivated. Contact your administrator." |
| 429 | `RATE_LIMITED` | "Too many attempts. Try again in a few minutes." |

`401` is returned identically for an unknown email and a wrong password. Differentiating them would let an attacker enumerate which accounts exist.

---

### `POST /api/auth/logout`

Clears the `token` cookie. Idempotent — returns `200` even without a valid session.

**200**
```json
{ "success": true, "data": { "message": "Logged out." } }
```

---

### `GET /api/auth/me`

Returns the authenticated user. Called on every application mount to restore the session.

**200**
```json
{ "success": true, "data": { "user": { "id": "…", "name": "Priya Sharma", "email": "priya@example.com", "role": "employee", "managerId": "…", "manager": { "id": "…", "name": "Rahul Verma" }, "isActive": true, "createdAt": "…" } } }
```

`manager` is populated with `id` and `name` only, and is `null` when unassigned.

| Error | Code | Message |
|---|---|---|
| 401 | `UNAUTHORIZED` | "Not authenticated." |

A `401` here is normal for a guest and must not trigger the client's redirect interceptor.

---

## 3. Profile

### `PATCH /api/users/me`

Updates the caller's own profile. Only `name` is accepted; any other field in the body is ignored rather than rejected, so a client sending a full user object cannot accidentally escalate.

**Request**
```json
{ "name": "Priya S. Sharma" }
```

**200**
```json
{ "success": true, "data": { "user": { } } }
```

| Error | Code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |

---

## 4. Admin — User Management

All endpoints in this section require the `admin` role. A non-admin receives `403 FORBIDDEN` with "You do not have permission to perform this action."

### `GET /api/users`

**Query parameters**

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `page` | integer | 1 | Minimum 1 |
| `limit` | integer | 20 | Maximum 100 |
| `role` | string | — | One of `admin`, `manager`, `employee` |
| `search` | string | — | Case-insensitive partial match on name or email |

**200**
```json
{
  "success": true,
  "data": {
    "users": [ { } ],
    "pagination": { "page": 1, "limit": 20, "total": 47, "pages": 3 }
  }
}
```

Each user includes `manager: { id, name } | null`.

---

### `GET /api/users/stats`

Feeds the admin dashboard cards.

**200**
```json
{
  "success": true,
  "data": { "total": 47, "active": 45, "inactive": 2, "byRole": { "admin": 2, "manager": 5, "employee": 40 } }
}
```

---

### `PATCH /api/users/:id/role`

**Request**
```json
{ "role": "manager" }
```

**200** — returns the updated user.

| Error | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | "Role must be one of: admin, manager, employee." |
| 400 | `SELF_ROLE_CHANGE` | "You cannot change your own role." |
| 403 | `FORBIDDEN` | Caller is not an admin |
| 404 | `USER_NOT_FOUND` | "User not found." |

The self-change guard exists so a lone admin cannot demote themselves and lock every administrative function out of the system.

---

### `PATCH /api/users/:id/status`

**Request**
```json
{ "isActive": false }
```

**200** — returns the updated user.

| Error | Code | Message |
|---|---|---|
| 400 | `SELF_STATUS_CHANGE` | "You cannot deactivate your own account." |
| 403 | `FORBIDDEN` | Caller is not an admin |
| 404 | `USER_NOT_FOUND` | "User not found." |

Deactivation takes effect immediately: `requireAuth` re-reads the user record on every request and returns `401` when `isActive` is false, so a live session is cut off on the next call rather than surviving until the token expires.

---

### `PATCH /api/users/:id/manager`

**Request**
```json
{ "managerId": "66f1a2b3c4d5e6f708192a40" }
```

Send `{ "managerId": null }` to unassign.

**200** — returns the updated user.

| Error | Code | Message |
|---|---|---|
| 400 | `SELF_MANAGER` | "A user cannot be their own manager." |
| 400 | `NOT_A_MANAGER` | "The assigned user does not hold the manager role." |
| 404 | `USER_NOT_FOUND` | "User not found." |

---

## 5. Manager — Team

### `GET /api/users/team`

Returns users whose `managerId` equals the caller's id. Requires the `manager` role.

**200**
```json
{ "success": true, "data": { "team": [ { } ], "count": 4 } }
```

An empty team returns `200` with `team: []` and `count: 0` — not `404`. An empty team is a normal state, and the client renders an empty state rather than an error.

| Error | Code |
|---|---|
| 403 | `FORBIDDEN` |

---

## 6. Rate Limits

| Scope | Limit | Window |
|---|---|---|
| `POST /api/auth/login` | 10 requests per IP | 15 minutes |
| `POST /api/auth/register` | 5 requests per IP | 60 minutes |
| All other `/api` routes | 200 requests per IP | 15 minutes |

Exceeding a limit returns `429` with a `Retry-After` header.

Behind nginx, Express must be configured with `app.set('trust proxy', 1)` and nginx must forward `X-Forwarded-For`. Otherwise every request appears to originate from `127.0.0.1` and one user hitting the limit locks out everyone.

---

## 7. Status Code Reference

| Code | Meaning in this API |
|---|---|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation failure or business rule violation |
| 401 | Not authenticated — missing, invalid, or expired token |
| 403 | Authenticated but not permitted, or account deactivated |
| 404 | Resource not found |
| 409 | Conflict — duplicate email |
| 429 | Rate limited |
| 500 | Unhandled server error |
| 503 | Health check failing |
