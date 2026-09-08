# Functional Requirements Document — Deploylab

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-09-08 |
| Companion to | [SRS.md](SRS.md) |

This document describes *how the application behaves*, screen by screen and rule by rule. Where the SRS says "the system shall reject invalid input", this document says exactly which input is invalid, what message appears, and where.

---

## 1. Modules

| # | Module | Purpose |
|---|---|---|
| M1 | Authentication | Register, log in, log out, session restore |
| M2 | Authorisation | Route protection on both client and server |
| M3 | Profile | View and edit own details |
| M4 | Admin — User Management | List users, change roles, toggle activation, assign managers |
| M5 | Manager — Team View | Read-only list of direct reports |
| M6 | Shell | Layout, navigation, error and loading states |

---

## 2. M1 — Authentication

### 2.1 Registration screen (`/register`)

**Fields**

| Field | Type | Required | Validation | Error message |
|---|---|---|---|---|
| Name | text | Yes | 2–60 characters, trimmed | "Name must be between 2 and 60 characters." |
| Email | email | Yes | Valid format, lowercased, max 254 chars | "Enter a valid email address." |
| Password | password | Yes | 8–72 characters, at least one letter and one digit | "Password must be at least 8 characters and include a letter and a number." |
| Confirm password | password | Yes | Must equal Password | "Passwords do not match." |

The 72-character ceiling is not arbitrary — bcrypt silently truncates beyond 72 bytes, so anything longer would create a false sense of strength.

**Behaviour**

1. Validation runs on blur for each field, and again for all fields on submit.
2. The submit button is disabled while the request is in flight, and its label changes to "Creating account…".
3. On `201 Created`, the user is logged in immediately — the server sets the session cookie as part of the registration response — and is redirected to `/dashboard`.
4. On `409 Conflict`, an inline error appears beneath the email field: "An account with this email already exists."
5. On any `5xx`, a page-level banner appears: "Something went wrong. Please try again."

**Notes**

- Every account created here receives the role `employee`. Role is never selectable during registration; allowing it would be a trivial privilege-escalation hole.
- A link reading "Already have an account? Log in" sits below the form.

### 2.2 Login screen (`/login`)

**Fields**

| Field | Type | Required | Validation |
|---|---|---|---|
| Email | email | Yes | Non-empty, valid format |
| Password | password | Yes | Non-empty |

**Behaviour**

1. On `200 OK`, the session cookie is set and the user is redirected — to the page they originally requested if they were bounced here by a route guard, otherwise to `/dashboard`.
2. On `401 Unauthorized`, a form-level error appears: "Incorrect email or password." The same message is shown whether the email is unknown or the password is wrong. Distinguishing the two would let an attacker enumerate registered accounts.
3. On `403 Forbidden`, the error reads: "This account has been deactivated. Contact your administrator."
4. On `429 Too Many Requests`, the error reads: "Too many attempts. Try again in a few minutes."

### 2.3 Session restore

On application mount, the client calls `GET /api/auth/me`.

| Response | Client action |
|---|---|
| `200 OK` | Populate auth context, render the requested route |
| `401 Unauthorized` | Clear auth context, treat the user as a guest |

A full-page loading state renders until this call resolves. Without it, a logged-in user refreshing the page would see a flash of the login screen before being restored — visually jarring and easily mistaken for a bug.

### 2.4 Logout

Triggered from the header menu. Calls `POST /api/auth/logout`, clears client auth state, redirects to `/login`. Client state is cleared even if the network call fails, so the user is never stranded in a half-logged-out state.

---

## 3. M2 — Authorisation

### 3.1 Route map

| Path | Access | Redirect when denied |
|---|---|---|
| `/login` | Guests only | `/dashboard` if already authenticated |
| `/register` | Guests only | `/dashboard` if already authenticated |
| `/dashboard` | Any authenticated user | `/login` |
| `/profile` | Any authenticated user | `/login` |
| `/admin/users` | `admin` only | `/dashboard` with a "not authorised" notice |
| `/team` | `manager` only | `/dashboard` with a "not authorised" notice |
| `*` | Public | 404 page |

### 3.2 The two-layer rule

Client-side guards exist for user experience: they stop a manager from seeing a broken admin screen. They are **not** a security boundary — anyone can edit client-side JavaScript in their browser.

Every protected endpoint therefore re-checks the role on the server. The acceptance test for this is deliberate: an employee who types `/admin/users` into the address bar must be blocked by a `403` from the API, not merely by a hidden navigation link.

### 3.3 Post-login landing

All roles land on `/dashboard`. The dashboard renders different content per role rather than redirecting to separate URLs, which keeps the routing table small and the redirect logic free of role branching.

---

## 4. M3 — Profile

### 4.1 Profile screen (`/profile`)

**Display**

| Field | Source | Editable |
|---|---|---|
| Name | `user.name` | Yes |
| Email | `user.email` | No |
| Role | `user.role` | No — shown as a coloured badge |
| Manager | `user.manager.name` | No — shown only if assigned |
| Member since | `user.createdAt`, formatted as "8 September 2026" | No |

**Editing name**

1. An "Edit" button switches the name field to an input.
2. Same validation as registration: 2–60 characters.
3. Save calls `PATCH /api/users/me`; Cancel restores the original value.
4. On success a toast reads "Profile updated" and the auth context refreshes so the header greeting updates immediately.

Email and role are read-only by design. Changing an email is an identity change requiring verification, which is out of scope. Changing one's own role is a privilege-escalation hole.

---

## 5. M4 — Admin: User Management

### 5.1 User list (`/admin/users`)

**Table columns**

| Column | Content |
|---|---|
| Name | Full name; the current admin's own row is suffixed "(you)" |
| Email | Email address |
| Role | Dropdown: Admin / Manager / Employee |
| Manager | Dropdown listing all users with the `manager` role, plus "— None —" |
| Status | Toggle: Active / Inactive |
| Joined | Formatted date |

**Controls**

- Role filter: All / Admin / Manager / Employee
- Pagination: 20 rows per page, with previous and next controls and a "Showing 1–20 of 47" summary

**States**

| State | Display |
|---|---|
| Loading | Skeleton rows |
| Empty after filtering | "No users match this filter." |
| Error | "Could not load users." plus a Retry button |

### 5.2 Changing a role

1. Admin selects a new role from the row's dropdown.
2. A confirmation dialog appears: "Change Priya Sharma's role from Employee to Manager?"
3. On confirm, `PATCH /api/users/:id/role` fires. The row shows a spinner and the dropdown is disabled.
4. On success the row updates and a toast confirms "Role updated."
5. On failure the dropdown reverts to its previous value and a toast explains the error.

**Self-demotion guard.** The current admin's own role dropdown is disabled, with the tooltip "You cannot change your own role." The server enforces the same rule independently and returns `400 Bad Request` if bypassed. Without this, a lone admin could demote themselves and permanently lock every administrative function out of the system — recoverable only by editing the database directly.

### 5.3 Toggling activation

1. Admin flips the status toggle.
2. A confirmation dialog appears when deactivating: "Deactivate this account? The user will be signed out and unable to log in." No confirmation is needed to reactivate, since that action is non-destructive.
3. `PATCH /api/users/:id/status` fires.
4. The current admin's own toggle is disabled, for the same lockout reason as above.

A deactivated user holding a valid cookie is rejected on their next request: the authentication middleware re-reads the user record and returns `401` if `isActive` is false. This means deactivation takes effect immediately rather than waiting up to 24 hours for the token to expire — worth the extra database read on each request.

### 5.4 Assigning a manager

1. Admin picks a manager from the row's dropdown.
2. `PATCH /api/users/:id/manager` fires; no confirmation dialog, since the action is easily reversed.
3. Server-side rules: the target must not be assigned to themselves, and the assignee must currently hold the `manager` role.

---

## 6. M5 — Manager: Team View

### 6.1 Team screen (`/team`)

Displays users whose `managerId` matches the logged-in manager.

**Columns:** Name, Email, Role, Status, Joined. No actions — the view is strictly read-only.

**Empty state:** "No team members assigned yet. An administrator can assign reports to you."

This empty state matters more than it looks: it is the default experience for every newly promoted manager, and an error screen there would read as a broken deployment.

---

## 7. M6 — Shell

### 7.1 Header

Left: the "Deploylab" wordmark, linking to `/dashboard`.

Right: the user's name, a role badge, and a dropdown containing Profile and Log out.

### 7.2 Navigation

Links are rendered per role:

| Role | Links |
|---|---|
| Employee | Dashboard, Profile |
| Manager | Dashboard, My Team, Profile |
| Admin | Dashboard, Users, Profile |

### 7.3 Dashboard content by role

| Role | Content |
|---|---|
| Employee | Greeting, own profile summary card, role badge |
| Manager | Greeting, own profile card, a "Team size: N" stat card linking to `/team` |
| Admin | Greeting, own profile card, stat cards for total users, active users, and a breakdown by role, linking to `/admin/users` |

### 7.4 Global states

| State | Treatment |
|---|---|
| Route loading | Centred spinner within the content area |
| Network error | Inline banner with a Retry action |
| Session expiry (`401` on any call) | Clear auth state, redirect to `/login` with the notice "Your session expired. Please log in again." |
| Unknown route | 404 page with a link back to the dashboard |

### 7.5 Toasts

Success toasts auto-dismiss after 3 seconds. Error toasts persist until dismissed, because an error the user did not read is an error that will be reported as a silent failure.

---

## 8. Cross-cutting Rules

| ID | Rule |
|---|---|
| BR-01 | Email is stored lowercase and trimmed; comparison is therefore case-insensitive. |
| BR-02 | Password is never returned by any endpoint, in any form. |
| BR-03 | A user cannot modify their own role or activation status. |
| BR-04 | A deactivated user's existing session is invalidated on their next request. |
| BR-05 | Only a user holding the `manager` role may be assigned as someone's manager. |
| BR-06 | A user cannot be their own manager. |
| BR-07 | Demoting a manager who still has reports leaves those reports' `managerId` dangling; the UI shows "— None —" for them. Cascading reassignment is out of scope for v1.0. |
| BR-08 | All timestamps are stored in UTC and rendered in the browser's local timezone. |

---

## 9. Acceptance Test Scenarios

| # | Scenario | Expected result |
|---|---|---|
| AT-01 | Register with an email already in use | `409`, inline error under the email field, no account created |
| AT-02 | Log in with a correct email and wrong password | `401`, message "Incorrect email or password." |
| AT-03 | Log in with an unregistered email | `401`, the *same* message as AT-02 |
| AT-04 | Log in as each of the three seeded roles | Each lands on `/dashboard` with role-appropriate content |
| AT-05 | As employee, navigate directly to `/admin/users` | Redirected to `/dashboard`; the API returns `403` if called directly |
| AT-06 | As admin, attempt to change own role | Control disabled; direct API call returns `400` |
| AT-07 | Deactivate a user who is currently logged in | That user's next request returns `401` and they are sent to `/login` |
| AT-08 | Refresh the page while logged in | Session is restored with no flash of the login screen |
| AT-09 | Log out, then press the browser back button | The protected page does not render; the user is sent to `/login` |
| AT-10 | Manager with zero reports opens `/team` | Empty state renders, not an error |
| AT-11 | Submit 11 failed logins in one minute | `429` returned with a retry message |
| AT-12 | Call any protected endpoint with no cookie | `401`, no data leaked in the response body |
| AT-13 | Stop the database, then call `/api/health` | Returns `503` with `db: "disconnected"` |
