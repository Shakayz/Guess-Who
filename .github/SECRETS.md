# GitHub Secrets & Environments Setup

Deployments use two GitHub **Environments**: `staging` and `production`. Each
environment owns its own copy of the environment-scoped secrets below; the
workflow references them with **unprefixed** names and GitHub automatically
picks the right one based on the job's `environment:` field.

Configure everything under: **GitHub → Settings → Secrets and variables → Actions**

---

## 1. Create the two environments

**Settings → Environments → New environment**

| Environment  | Protection rules                                    |
|--------------|-----------------------------------------------------|
| `staging`    | None (auto-deploy on push to `main`)                |
| `production` | **Required reviewers** (you or a co-admin) — strongly recommended |

---

## 2. Repository-level secrets (shared by both envs)

**Settings → Secrets and variables → Actions → Secrets tab → New repository secret**

These are identical across staging and production.

| Secret                 | Description                                                          |
|------------------------|----------------------------------------------------------------------|
| `GOOGLE_CLIENT_ID`     | OAuth Google server-side                                             |
| `GOOGLE_CLIENT_SECRET` | OAuth Google server-side secret                                      |
| `VITE_GOOGLE_CLIENT_ID`| OAuth Google client-side — baked into web bundle at build time       |
| `APPLE_CLIENT_ID`      | Apple Sign In Services ID (e.g. `com.redhanded.game.signin`) — used server-side for JWT audience check |
| `VITE_APPLE_CLIENT_ID` | Apple Sign In Services ID — baked into web bundle at build time (usually same value as `APPLE_CLIENT_ID`) |
| `RESEND_API_KEY`       | Resend transactional email API key                                   |
| `LIGHTSAIL_SSH_KEY`    | SSH private key authorised on both staging and production VMs        |

> If you prefer a different SSH key per environment, move `LIGHTSAIL_SSH_KEY`
> into each environment's secrets (section 3) instead of the repo level.

---

## 3. Environment-scoped secrets (different per env)

**Settings → Environments → `{staging|production}` → Add secret**

Add each secret **once to `staging`** and **once to `production`**, with
different values. The names below are unprefixed — identical in both envs.

| Secret                       | Description / how to generate                                    |
|------------------------------|------------------------------------------------------------------|
| `LIGHTSAIL_HOST`             | IP or DNS name of the Lightsail VM for this env                  |
| `POSTGRES_USER`              | Postgres user for the app DB                                     |
| `POSTGRES_PASSWORD`          | Postgres password (strong, unique per env)                       |
| `POSTGRES_DB`                | Postgres database name                                           |
| `JWT_SECRET`                 | `openssl rand -base64 48` — **must differ between staging and prod** |
| `STRIPE_SECRET_KEY`          | `sk_test_...` in staging, `sk_live_...` in production            |
| `STRIPE_WEBHOOK_SECRET`      | `whsec_...` — one per env (Stripe dashboard → test vs live)      |
| `STRIPE_PRICE_ID_PACK_500`   | `price_...` for the 500-coin pack                                |
| `STRIPE_PRICE_ID_PACK_1500`  | `price_...` for the 1500-coin pack                               |
| `STRIPE_PRICE_ID_PACK_5000`  | `price_...` for the 5000-coin pack                               |

---

## 4. (Optional) Environment variables for non-sensitive values

Domain names are currently hardcoded in the workflow `env:` blocks. If you want
to change them without editing YAML, move them to **environment Variables**
(not secrets) and reference as `${{ vars.API_DOMAIN }}` instead of `${{ env.API_DOMAIN }}`:

| Variable          | Staging value                     | Production value              |
|-------------------|-----------------------------------|-------------------------------|
| `API_DOMAIN`      | `api-staging.redhanded-game.com`  | `api.redhanded-game.com`      |
| `WEB_DOMAIN`      | `staging.redhanded-game.com`      | `redhanded-game.com`          |

Leave them hardcoded if you prefer YAML-as-source-of-truth.

---

## 5. Cleanup — delete obsolete secrets

If these legacy names exist at the repo level, delete them — the workflow
no longer reads them:

- `LIGHTSAIL_STAGING_HOST`, `LIGHTSAIL_PROD_HOST` → replaced by env-scoped `LIGHTSAIL_HOST`
- `STRIPE_SECRET_KEY_STAGING`, `STRIPE_SECRET_KEY_PROD` → `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET_STAGING`, `STRIPE_WEBHOOK_SECRET_PROD` → `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PACK_{500,1500,5000}_{STAGING,PROD}` → unprefixed per env
- Any `DEV_*` / `PFV_*` leftovers from the old three-env scheme

And if `POSTGRES_PASSWORD` / `JWT_SECRET` / `POSTGRES_USER` / `POSTGRES_DB`
currently live at the **repo level**, move them into each environment so
staging and production stop sharing credentials.

---

## Utility commands

```bash
# Strong JWT secret
openssl rand -base64 48

# Generate a deploy SSH key
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Authorise the public key on a VM
ssh-copy-id -i ~/.ssh/github_deploy.pub ubuntu@YOUR_SERVER

# Print the private key to paste into GitHub as LIGHTSAIL_SSH_KEY
cat ~/.ssh/github_deploy
```
