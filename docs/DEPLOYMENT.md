# Deployment Runbook — Deploylab

| Field | Value |
|---|---|
| Status | **Phase 9 complete — the app is running on the server.** Phases 10–14 filled in as they complete |
| Target | AWS EC2, Ubuntu 24.04 LTS, `t3.micro` (1 GB RAM) |
| First deployed | 2026-09-09 |

The goal for this document: someone with a blank AWS account and this file alone
can reproduce production. Every command that actually worked goes here, including
the ones that only worked on the second attempt.

Record real values in the table below as you go. Do not record secrets.

---

## Environment Facts

| Item | Value |
|---|---|
| Provider | AWS EC2 |
| AWS account | `376219458055` |
| Plan | Free plan — $100 credits, expiring 2027-03-09 |
| Region | **`ap-south-1` (Mumbai)** — chosen to match the Atlas cluster and to sit near the users |
| Availability zone | `ap-south-1b` |
| Instance | `deploylab` — `i-092c52d2665fd3b35`, `t3.micro`, 2 vCPU / 1 GiB |
| AMI | Ubuntu Server 24.04 LTS, `ami-006f82a1d5a27da54` (64-bit x86) |
| Storage | 16 GiB gp3 |
| Security group | `deploylab-sg` — `sg-0b8cad13c74d5e0a8` |
| Public IP | `13.201.93.125` — ⚠️ **still the auto-assigned address; no Elastic IP associated yet** |
| SSH user | `deploy` (the AMI ships with `ubuntu`, kept as a fallback) |
| App directory | `/home/deploy/deploylab` |
| pm2 process name | `deploylab` |
| Node version | v22.23.2, npm 10.9.8, pm2 7.0.4, git 2.43.0 |
| Swap | 2 GiB at `/swapfile`, persistent via `fstab` |
| Atlas cluster | M0, database `Deploylab` |
| Domain | _Phase 11_ |

### Outstanding

| Item | Why it matters |
|---|---|
| **No Elastic IP associated** | The current address is the auto-assigned one and changes on every stop/start, which would break the Atlas allowlist and later the DNS record |
| **Atlas allowlist still `0.0.0.0/0`** | Narrow it to the Elastic IP once that exists. Add the new rule before removing the open one |
| **Production shares a database with development** | Both point at the same Atlas cluster and the same `Deploylab` database. Seeding, testing, or a careless delete locally now touches production data. Acceptable while learning; a separate database — even just a different name in the same cluster — is the fix |

---

## 0. Before Touching AWS — Billing Safety

**Read this before creating the account.** AWS requires a payment card even for
free usage, bills by the hour, and will happily keep charging after any free
allowance ends. The free tier terms changed materially during 2025, so confirm
what your account actually gets on the signup page rather than trusting any
tutorial — including this one.

**This account is on the credits-based free plan**, not the older 12-month free
tier: $100 of credits with a fixed expiry date, and usage draws them down rather
than billing the card. The EC2 dashboard shows the remaining balance and days.

That changes what to watch. The risk is not a surprise invoice, it is quietly
burning the balance on something left running. A rough sense of the monthly draw
for this setup — one micro instance, a small EBS volume, and one public IPv4
address — is on the order of ten to fifteen dollars, varying by region and with
whatever AWS currently charges. Over the life of the credits that leaves room for
this project and not much else, so do not leave spare instances running.

Check the balance on the EC2 dashboard periodically. When credits run out, an
account on this plan is either suspended or converted to paid depending on the
plan settings — worth knowing which, before it happens.

Things that commonly cost money on an otherwise "free" setup:

| Item | Why it surprises people |
|---|---|
| Public IPv4 address | Charged per hour since February 2024, with a free allowance that may not cover a full month past the first year |
| Elastic IP not attached to a running instance | Billed hourly while idle. Release it if you tear the instance down |
| Instance left running past the free allowance | The meter does not stop because you stopped using the app |
| EBS storage | The disk is billed even while the instance is stopped |

**Do this immediately after the account exists, before launching anything:**

- [ ] Enable MFA on the root account
- [ ] Create an IAM user for daily use; stop using root
- [ ] Billing → Budgets → create a zero-spend or low-threshold budget with an email alert
- [ ] Billing preferences → turn on free tier usage alerts

A budget alert does not stop charges. It tells you they started. That is still
the difference between noticing in a day and noticing on a statement.

---

## 1. Launch the Instance

### 1.0 Pick the region first

Set the region in the top-right dropdown **before creating anything**. Almost
every EC2 resource is regional: a key pair, security group, or instance made in
one region is simply invisible from another, and there is no move operation.

Choose the region that matches **where the Atlas cluster lives**, then where the
users are. Every request the app makes to the database pays the round trip
between the two, several times per page. An app in Stockholm talking to a
database in Mumbai adds well over a hundred milliseconds to each query, and no
amount of application tuning recovers it.

This deployment uses `ap-south-1` (Mumbai) for both.

### 1.1 Create the key pair

EC2 → Key Pairs → Create key pair.

- Name: `deploylab`
- Type: **ed25519**
- Format: `.pem`

The private key downloads once and cannot be downloaded again. Move it somewhere
permanent:

```powershell
# Windows
mkdir "$env:USERPROFILE\.ssh" -Force
move "$env:USERPROFILE\Downloads\deploylab.pem" "$env:USERPROFILE\.ssh\deploylab.pem"
icacls "$env:USERPROFILE\.ssh\deploylab.pem" /inheritance:r /grant:r "$env:USERNAME:R"
```

That `icacls` line matters. SSH refuses a key that other users on the machine can
read, and on Windows a freshly downloaded file inherits permissions that trip
this. The error is `UNPROTECTED PRIVATE KEY FILE`.

### 1.2 Security group

EC2 → Security Groups → Create.

| Type | Port | Source | Reason |
|---|---|---|---|
| SSH | 22 | **My IP** | Not `0.0.0.0/0`. Port 22 open to the world gets brute-forced within minutes |
| HTTP | 80 | `0.0.0.0/0` | Public site, and Let's Encrypt validates over port 80 in Phase 11 |
| HTTPS | 443 | `0.0.0.0/0` | Phase 11 |

**Port 5000 stays closed.** Express binds to `127.0.0.1` in production, so it is
unreachable from outside regardless — but leaving the port shut means the
firewall and the binding agree, and neither alone is load-bearing.

If your home IP changes, SSH will start timing out. Edit the rule rather than
widening it to `0.0.0.0/0`.

### 1.3 Launch

EC2 → Instances → Launch.

- AMI: **Ubuntu Server 24.04 LTS**, 64-bit x86 (not ARM, unless you pick an ARM
  instance type to match)
- Instance type: whichever micro size your free tier covers
- Key pair: `deploylab`
- Security group: the one from 1.2
- Storage: 8–16 GB gp3 is plenty

### 1.4 Elastic IP

EC2 → Elastic IPs → Allocate → Associate with the instance.

Without this the public IP changes on every stop/start, which breaks both the
Atlas allowlist and any DNS record. Record it in the facts table.

> Release the Elastic IP if you ever terminate the instance. An allocated address
> not attached to a running instance is billed.

---

## 2. First Connection

```bash
ssh -i ~/.ssh/deploylab.pem ubuntu@<ELASTIC_IP>
```

On Windows use the full path: `ssh -i C:\Users\<you>\.ssh\deploylab.pem ubuntu@<ELASTIC_IP>`

| Symptom | Cause |
|---|---|
| `Connection timed out` | Security group rule missing, or your IP changed |
| `Permission denied (publickey)` | Wrong username. Ubuntu AMIs use `ubuntu`, not `root` or `ec2-user` |
| `UNPROTECTED PRIVATE KEY FILE` | Key permissions — run the `icacls` line from 1.1 |

---

## 3. Update the System

```bash
sudo apt update && sudo apt upgrade -y
```

If a kernel update prompts for a reboot, take it now rather than mid-deploy:

```bash
sudo reboot
```

---

## 4. Add Swap

**Do this before building anything.** The instance has 1 GB of RAM. A Vite
production build peaks well above what is left after Node and the OS take their
share, and the failure mode is not a clear error — the kernel's OOM killer
terminates the build process and you get a truncated log with no explanation.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

The `fstab` line makes it survive a reboot. `free -h` should now show 2 GB of swap.

---

## 5. Create a Deploy User

Working as the AMI's default user is workable but sloppy; a dedicated account
keeps the app's files and the pm2 service owned by something purpose-made.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy

# Give it the same SSH key you already hold
sudo rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

Open a **second terminal** and confirm the new user works before going further:

```bash
ssh -i ~/.ssh/deploylab.pem deploy@<ELASTIC_IP>
```

Do not skip that check. The next step reduces SSH access, and verifying the new
route first is what stops you locking yourself out of the box entirely.

---

## 6. Harden SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Set:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Ubuntu 24.04 also reads `/etc/ssh/sshd_config.d/*.conf`, and the cloud image ships
a file there that may already set `PasswordAuthentication`. A setting in the main
file will not win against it, so check:

```bash
sudo grep -r PasswordAuthentication /etc/ssh/sshd_config.d/
```

Then validate and reload — validate first, so a typo fails loudly instead of
taking the SSH daemon down while you are connected through it:

```bash
sudo sshd -t && sudo systemctl reload ssh
```

Keep your current session open until a fresh one succeeds.

---

## 7. Firewall

The security group already filters at the AWS edge. `ufw` is a second layer on
the host itself, which matters if a rule is ever widened by accident.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

Port 5000 is deliberately absent.

---

## 8. Install Node.js

Ubuntu's packaged Node is far too old. Use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

Record the version in the facts table. Node 22 LTS matches the `engines` field in
both `package.json` files and the version CI runs.

---

## 9. Install git and pm2

```bash
sudo apt install -y git
sudo npm install -g pm2
pm2 -v
```

---

## 10. Clone and Configure

The repository is **private**, so an anonymous HTTPS clone fails with
`could not read Username for 'https://github.com'`. Use a deploy key: an SSH key
that exists only on this server and is authorised for this one repository.

Better than a personal access token — scoped to a single repo, no expiry to
renew, and it can be read-only. Phase 12's automated deploy uses the same key.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N '' -C 'deploylab-ec2-deploy-key'

cat > ~/.ssh/config <<'CONF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
CONF

chmod 600 ~/.ssh/config ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub
```

Add that public key at **repo → Settings → Deploy keys → Add deploy key**, and
leave *Allow write access* **unchecked**. The server only ever pulls; if it were
ever compromised, a read-only key cannot push to your repository.

Then clone over SSH, not HTTPS:

```bash
cd ~
git clone git@github.com:Himanshu1091/Deploylab.git deploylab
cd deploylab
```

Create the environment file **on the server**. It is gitignored, so it does not
arrive with the clone — that is the point.

```bash
nano backend/.env
```

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/Deploylab?retryWrites=true&w=majority
JWT_SECRET=<paste the output of the command below>
JWT_EXPIRES_IN=24h
```

Generate a **new** secret for production rather than reusing the development one:

```bash
openssl rand -hex 32
```

A leaked development secret should not hand anyone a valid production session.
Note also that changing this value invalidates every existing session, which is
the emergency lever if a token ever leaks.

Lock the file down — it holds the database password:

```bash
chmod 600 backend/.env
```

The database name is case-sensitive and must be `Deploylab`, matching what
development uses.

---

## 11. Install and Build

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm run build
```

`npm ci` rather than `npm install`: it installs exactly what the lockfile pins and
fails if the lockfile and `package.json` disagree, so the server gets the same
dependency tree CI tested.

Confirm the build landed:

```bash
ls -la frontend/dist
```

If the build is killed without an error message, swap was not added — go back to
step 4.

---

## 12. Atlas Allowlist

MongoDB Atlas → Network Access. Add the Elastic IP as `<ELASTIC_IP>/32`, then
remove the `0.0.0.0/0` entry from Phase 1.

Do it in that order. Removing the open rule first, then discovering the new entry
was mistyped, means the app cannot reach the database and the health endpoint
starts returning 503.

---

## 13. Start Under pm2

```bash
cd ~/deploylab
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs deploylab --lines 50
```

Expect:

```
[db] connected - database "Deploylab"
[server] production - listening on http://127.0.0.1:5000
```

Seed the accounts if this is a fresh database:

```bash
npm --prefix backend run seed
```

---

## 14. Verify

Express binds to loopback in production, so this must be run **on the server**.
There is no external URL to test yet — nginx arrives in Phase 10.

```bash
curl -s localhost:5000/api/health
curl -s -o /dev/null -w '%{http_code}\n' localhost:5000/
```

Expect `{"status":"ok","db":"connected",...}` and `200`.

Confirm it is genuinely unreachable from outside — from your own machine, not the
server:

```bash
curl --max-time 5 http://<ELASTIC_IP>:5000/api/health
```

That should time out. If it answers, the binding or the security group is wrong.

---

## 15. Survive a Reboot

```bash
pm2 save
pm2 startup systemd
```

`pm2 startup` prints a `sudo env PATH=... pm2 startup systemd -u deploy --hp /home/deploy`
command. Run the command it prints, not a copy from anywhere else — it is
generated for this user and path.

Then prove it rather than assuming:

```bash
sudo reboot
# wait, reconnect
pm2 status
curl -s localhost:5000/api/health
```

A deployment that does not survive a reboot is not finished. Instances restart —
for maintenance, for a crash, because someone stopped one to save money.

---

## 16. nginx

```bash
sudo apt install -y nginx
```

### The permission that causes a 403

nginx workers run as `www-data`, and `/home/deploy` is `0750` — no traverse for
anyone outside the `deploy` group. The files are perfectly readable; nginx simply
cannot walk the path to them, and returns 403 on a file that plainly exists.

```bash
sudo usermod -aG deploy www-data
sudo systemctl restart nginx   # restart, not reload: group membership is
                               # applied when workers are spawned fresh
```

`chmod 755 /home/deploy` also fixes it, but opens the home directory to every
local account rather than just the web server.

Check it directly rather than guessing:

```bash
sudo -u www-data test -r /home/deploy/deploylab/frontend/dist/index.html \
  && echo READABLE || echo "NOT READABLE"
```

### Site config

`/etc/nginx/sites-available/deploylab`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /home/deploy/deploylab/frontend/dist;
    index index.html;

    access_log /var/log/nginx/deploylab.access.log;
    error_log  /var/log/nginx/deploylab.error.log;

    client_max_body_size 1m;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # ^~ so this prefix beats the regex location below. Without it a request for
    # /api/something.json would be captured by the file-extension rule and 404.
    location ^~ /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout    60s;
    }

    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache" always;
    }

    # Anything that looks like a file must 404 when missing rather than falling
    # through to index.html. HTML where a script was expected shows up as
    # "Unexpected token '<'", which says nothing about the real problem.
    location ~ \.[^/]+$ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable it and drop the default site, which otherwise answers on `/`:

```bash
sudo ln -sf /etc/nginx/sites-available/deploylab /etc/nginx/sites-enabled/deploylab
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Why the header block matters

Express runs with `trust proxy`, so `X-Forwarded-For` is what the rate limiter
treats as the client. Omit these headers and every request appears to come from
`127.0.0.1` — one visitor hitting the login limit then locks out everyone.

Confirm it by making a request from your own machine and reading the app log:
the address should be yours, not `127.0.0.1`.

```bash
pm2 logs deploylab --lines 5 --nostream
```

### Verified from the public internet

| Check | Result |
|---|---|
| `/`, `/login`, `/admin/users` | `200`, `Cache-Control: no-cache` |
| `/api/health` | `200`, `db: connected` |
| `/assets/<hashed>.js` | `200`, gzip, `max-age=31536000, immutable` |
| `/assets/nope.js`, `/favicon.ico` | `404`, not the HTML fallback |
| Port `5000` from outside | times out |
| Client IP in the app log | the real address, not `127.0.0.1` |

### Known: login does not work yet

`NODE_ENV=production` sets the session cookie `Secure`, and browsers discard
`Secure` cookies delivered over plain HTTP. Login returns `200`, the cookie is
dropped, and the app bounces back to the login screen.

This is expected and is why TLS comes before anything depends on it. Phase 11
resolves it.

---

## 17. TLS

_Phase 11._

```bash
# placeholder
```

---

## 18. CI/CD

_Phase 12. Paste the final workflow file here._

```yaml
# placeholder
```

---

## Routine Operations

| Task | Command |
|---|---|
| View logs | `pm2 logs deploylab` |
| Last 100 log lines | `pm2 logs deploylab --lines 100 --nostream` |
| Restart with zero downtime | `pm2 reload deploylab` |
| Hard restart | `pm2 restart deploylab` |
| Status and memory | `pm2 status` |
| Live monitor | `pm2 monit` |
| Health check | `curl -s localhost:5000/api/health` |
| Disk usage | `df -h` |
| Memory and swap | `free -h` |
| What is listening | `sudo ss -tlnp` |
| nginx config test | `sudo nginx -t` |
| nginx reload | `sudo systemctl reload nginx` |

---

## Deploying a Change

Until Phase 12 automates it:

```bash
cd ~/deploylab
git pull
npm --prefix backend ci
npm --prefix frontend ci
npm run build
pm2 reload deploylab
curl -s localhost:5000/api/health
```

`reload` rather than `restart`: it triggers the graceful shutdown path, which
drains in-flight requests instead of dropping them.

---

## Rollback

```bash
cd ~/deploylab
git log --oneline -n 10
git checkout <known-good-sha>
npm --prefix backend ci && npm --prefix frontend ci
npm run build
pm2 reload deploylab
```

Return to the branch afterwards with `git checkout main`.

---

## Troubleshooting Log

The most valuable section in this file. One row per problem actually hit.

| Date | Symptom | Cause | Fix |
|---|---|---|---|
| 2026-09-09 | `Identity file ... deploylab.pem not accessible: No such file or directory`, then `Permission denied (publickey)` | The downloaded key was still sitting in `Downloads`, never moved to `~/.ssh` | Move it, then `icacls ... /inheritance:r /grant:r "$env:USERNAME:R"` |
| 2026-09-09 | `fatal: could not read Username for 'https://github.com'` | The repository is private, so an anonymous HTTPS clone cannot authenticate | Generate a deploy key on the server, register it read-only on the repo, clone over SSH |
| 2026-09-09 | `/api/health` returned an empty body immediately after reboot | The app was up but Mongoose had not finished connecting — the query landed at uptime 0s | Not a fault. Wait for the connection; the health endpoint exists precisely to report this state |
| 2026-09-09 | Remote script failed with `unexpected EOF while looking for matching quote` | Quotes inside a script were mangled passing through PowerShell into `ssh` | Base64-encode the script locally and decode it on the server, avoiding shell quoting entirely |
