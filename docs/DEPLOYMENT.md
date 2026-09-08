# Deployment Runbook — Deploylab

| Field | Value |
|---|---|
| Status | Skeleton — filled in as phases 9–14 complete |
| Target | Ubuntu 24.04 LTS, 1 GB RAM |

The goal for this document: someone with a blank server and this file alone can reproduce production. Every command that actually worked goes here, including the ones that only worked on the second attempt.

---

## Environment Facts

Fill in as they become known.

| Item | Value |
|---|---|
| Provider | _TBD — Phase 9_ |
| Instance type | _TBD_ |
| Region | _TBD_ |
| Public IP | _TBD_ |
| Domain | _TBD — Phase 11_ |
| SSH user | _TBD_ |
| App directory | `/home/<user>/deploylab` |
| pm2 process name | `deploylab` |
| Node version | _TBD_ |
| Atlas cluster | M0, `ap-south-1` |

---

## 1. Server Preparation

_Phase 9. Record the exact commands used._

```bash
# placeholder
```

---

## 2. Application Setup

_Phase 9._

```bash
# placeholder
```

---

## 3. Environment Variables

Never commit `server/.env`. Create it directly on the server.

| Variable | Where the value comes from |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `MONGODB_URI` | Atlas → Connect → Drivers |
| `JWT_SECRET` | `openssl rand -hex 32`, generated fresh per environment |
| `JWT_EXPIRES_IN` | `24h` |

---

## 4. pm2

_Phase 9._

```bash
# placeholder
```

---

## 5. nginx

_Phase 10. Paste the full working site config here._

```nginx
# placeholder
```

---

## 6. TLS

_Phase 11._

```bash
# placeholder
```

---

## 7. CI/CD

_Phase 12. Paste the final workflow file here._

```yaml
# placeholder
```

---

## 8. Routine Operations

| Task | Command |
|---|---|
| View logs | `pm2 logs deploylab` |
| Restart | `pm2 reload deploylab` |
| Status | `pm2 status` |
| Health check | `curl -s localhost:5000/api/health` |
| nginx config test | `sudo nginx -t` |
| nginx reload | `sudo systemctl reload nginx` |
| Disk usage | `df -h` |
| Memory | `free -m` |

---

## 9. Rollback

_Phase 12._

```bash
# placeholder
```

---

## 10. Troubleshooting Log

The most valuable section in this file. One row per problem actually hit.

| Date | Symptom | Cause | Fix |
|---|---|---|---|
| | | | |
