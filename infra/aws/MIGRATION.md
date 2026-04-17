# Migration to new AWS account + redhanded-game.com domain

This checklist walks through migrating the Red Handed infra from the old AWS
account (`700672899544`, domain `aghazzaf.com`) to the new one (`210884642211`,
domain `redhanded-game.com`).

Architecture: **Lightsail-only** (no S3, no CloudFront). The web app is served
from a container on the same VM as the API, fronted by Caddy which handles
Let's Encrypt SSL.

---

## Prerequisites (before running the migration script)

- [ ] **AWS CLI v2 installed** locally. Test: `aws --version`
- [ ] **AWS CLI configured** for the new account. Test:
      `aws sts get-caller-identity` should return `"Account": "210884642211"`
- [ ] **MFA enabled on the root user** of the new AWS account
- [ ] **IAM user** (not root) with `AdministratorAccess` used in `aws configure`
- [ ] **Billing active** on the new account — a valid payment method is set
- [ ] **Lightsail fully activated** — browse to the Lightsail console; if you
      see a 403 "There might be a problem with your access to Lightsail",
      wait up to 24h and click "Confirm your AWS registration"

---

## Phase 1 — Create AWS infrastructure

Run once from the repo root:

```bash
./infra/aws/migrate-to-new-account.sh
```

The script:

1. Verifies you're on account `210884642211`
2. Creates ECR repos `red-handed-api` and `red-handed-web`
3. Creates a Lightsail SSH key pair and saves `redhanded-deploy-key.pem` in
   the repo root (**gitignored** — do not commit)
4. Creates two Lightsail instances: `redhanded-prod` ($10/mo) and
   `redhanded-staging` ($7/mo)
5. Allocates and attaches two static IPs
6. Opens firewall ports 22/80/443
7. SSHes into each VM and installs Docker + docker-compose-plugin
8. Runs `setup-github-oidc.sh` to create the IAM role the workflows assume

At the end it prints the **two static IPs** — note them for Phase 2.

Re-running is safe: every step is idempotent.

---

## Phase 2 — Namecheap DNS records

Log in to Namecheap → Domain List → `redhanded-game.com` → **Advanced DNS**.

### Keep these existing records (for Private Email)

| Type | Host | Value | Priority/TTL |
|---|---|---|---|
| MX  | @ | `mx1.privateemail.com` | 10 |
| MX  | @ | `mx2.privateemail.com` | 10 |
| TXT | @ | `v=spf1 include:spf.privateemail.com ~all` | Auto |
| TXT | (DKIM selector from Namecheap Private Email console) | (DKIM value) | Auto |

### Add these new records

Replace `<PROD_IP>` and `<STAGING_IP>` with the addresses printed by the
migration script.

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@`            | `<PROD_IP>`    | Auto |
| A | `api`          | `<PROD_IP>`    | Auto |
| A | `staging`      | `<STAGING_IP>` | Auto |
| A | `api-staging`  | `<STAGING_IP>` | Auto |

Optionally add `www` pointing at `<PROD_IP>` if you want `www.redhanded-game.com`
to work too.

DNS propagation: a few minutes typically, up to 48h worst case. Test with:

```bash
dig +short api.redhanded-game.com
```

---

## Phase 3 — GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Value |
|---|---|
| `LIGHTSAIL_PROD_HOST`    | `<PROD_IP>` from Phase 1 |
| `LIGHTSAIL_STAGING_HOST` | `<STAGING_IP>` from Phase 1 |
| `LIGHTSAIL_SSH_KEY`      | Paste the entire contents of `redhanded-deploy-key.pem` |
| `GOOGLE_CLIENT_ID`       | See Phase 4 |
| `GOOGLE_CLIENT_SECRET`   | See Phase 4 |
| `VITE_GOOGLE_CLIENT_ID`  | Same value as `GOOGLE_CLIENT_ID` |

> The `LIGHTSAIL_SSH_KEY` value must include the `-----BEGIN ... PRIVATE KEY-----`
> and `-----END ... PRIVATE KEY-----` lines.

---

## Phase 4 — Google OAuth (Google Cloud Console)

https://console.cloud.google.com/ → APIs & Services → Credentials.

Either update the existing OAuth client or create a new one for the new domain.

### Authorized JavaScript origins

- `https://redhanded-game.com`
- `https://staging.redhanded-game.com`

### Authorized redirect URIs

- `https://api.redhanded-game.com/api/auth/google/callback`
- `https://api-staging.redhanded-game.com/api/auth/google/callback`

Copy the `Client ID` and `Client secret` into the GitHub secrets from Phase 3.

---

## Phase 5 — First deploy

```bash
git checkout staging           # or: git checkout -b staging
git push origin staging
```

This triggers **CD — Staging**:

1. Build + push API/Web images to ECR
2. SSH into the staging VM
3. Pull images, update `.env`, `docker compose up -d`
4. Smoke-test `https://staging.redhanded-game.com` and
   `https://api-staging.redhanded-game.com`

Watch the run under **Actions** tab on GitHub. First run may take 5–10 min
because Caddy is provisioning Let's Encrypt certs.

Once staging is green, merge to `main` — **CD — Production** triggers
automatically on `CD — Staging` success and deploys to prod.

---

## Phase 6 — Post-deploy verification

- [ ] `https://redhanded-game.com` loads the web app
- [ ] `https://api.redhanded-game.com/health` (or `/`) responds 200
- [ ] WebSocket connects (open browser devtools → Network → WS)
- [ ] Google Sign-In works end-to-end
- [ ] Email delivery: send a verification email, confirm it arrives at
      `contact@redhanded-game.com` style inbox

---

## Phase 7 — Decommission old infra (wait 1 week)

Once the new setup has been stable for at least a week:

1. On the **old** AWS account (`700672899544`):
   - Delete the two Lightsail instances (`35.181.142.208`, `35.181.233.160`)
   - Release their static IPs
   - Delete the S3 buckets `aghazzaf-web-prod`, `aghazzaf-web-staging`
   - Delete the CloudFront distributions `E1ZHK1GBOO9V4T`, `E1ZIQ7E8U04EBD`
   - Delete the ECR repo `red-handed-api`
   - Delete the `GitHubActionsRedHandedDeploy` IAM role
2. At Namecheap: remove any lingering records pointing at the old IPs
3. Close the old AWS account if no longer used

---

## Troubleshooting

### Script fails at `aws lightsail create-instances` with 403

Lightsail is not fully activated on the account. Wait up to 24h after billing
activation. Meanwhile you can re-run the script; the ECR + OIDC steps will
succeed and only Lightsail steps will fail.

### `Not authorized to perform sts:AssumeRoleWithWebIdentity` in GitHub Actions

See the troubleshooting section in `infra/aws/README.md`. Most likely the
trust policy's `GitHubOrg`/`GitHubRepo` don't match the exact case used on
GitHub.

### Caddy fails to obtain Let's Encrypt cert

- DNS hasn't propagated yet — wait, then restart: `docker compose restart caddy`
- Port 80 not reachable from the internet — check Lightsail firewall
- Hitting LE rate limits — stop retrying; wait an hour

### Docker pull fails on the VM with `denied: User: ... is not authorized`

ECR password expired (they're valid 12h). Trigger a new deploy from
GitHub Actions; the workflow refreshes the password each run.
