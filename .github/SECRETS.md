# GitHub Secrets & Environments Setup

Configure these in: **GitHub → Settings → Secrets and variables → Actions**

---

## Environments à créer dans GitHub

GitHub → Settings → Environments → New environment

| Environment | Protection Rules |
|---|---|
| `development` | Aucune (auto-deploy) |
| `pfv` | Optionnel: ajouter 1 reviewer pour valider avant déploiement |
| `production` | **Required reviewers** (obligatoire — toi ou un co-admin) |

---

## Secrets globaux (partagés entre tous les environnements)

> GitHub → Settings → Secrets → Actions → New repository secret

| Secret | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Google server-side (même valeur pour tous les envs) |
| `GOOGLE_CLIENT_SECRET` | OAuth Google secret |
| `VITE_GOOGLE_CLIENT_ID` | OAuth Google client-side (baked into web bundle at build time) |
| `APPLE_CLIENT_ID` | Apple Sign In Services ID (ex: `com.redhanded.game.signin`) — used server-side for JWT audience check |
| `VITE_APPLE_CLIENT_ID` | Apple Sign In Services ID — baked into web bundle at build time (usually the same value as `APPLE_CLIENT_ID`) |

---

## Secrets par environnement — DEV (`development`)

| Secret | Exemple |
|---|---|
| `DEV_SSH_HOST` | `192.168.1.100` |
| `DEV_SSH_USER` | `ubuntu` |
| `DEV_SSH_KEY` | Clé privée SSH (contenu complet) |
| `DEV_DATABASE_URL` | `postgresql://postgres:pass@postgres:5432/red_handed` |
| `DEV_REDIS_URL` | `redis://redis:6379` |
| `DEV_JWT_SECRET` | Minimum 32 caractères aléatoires |
| `DEV_ALLOWED_ORIGINS` | `http://dev.yourdomain.com` |
| `DEV_APP_URL` | `http://dev.yourdomain.com` |

---

## Secrets par environnement — PFV (`pfv`)

| Secret | Exemple |
|---|---|
| `PFV_SSH_HOST` | IP du serveur PFV |
| `PFV_SSH_USER` | `ubuntu` |
| `PFV_SSH_KEY` | Clé privée SSH PFV |
| `PFV_DATABASE_URL` | `postgresql://postgres:pass@postgres:5432/red_handed_pfv` |
| `PFV_REDIS_URL` | `redis://:pass@redis:6379` |
| `PFV_JWT_SECRET` | Secret JWT PFV (différent du prod) |
| `PFV_ALLOWED_ORIGINS` | `https://pfv.yourdomain.com` |
| `PFV_APP_URL` | `https://pfv.yourdomain.com` |
| `PFV_POSTGRES_PASSWORD` | Mot de passe Postgres PFV |
| `PFV_REDIS_PASSWORD` | Mot de passe Redis PFV |
| `STRIPE_TEST_KEY` | `sk_test_...` (clé Stripe test) |
| `PFV_STRIPE_WEBHOOK_SECRET` | `whsec_...` (endpoint test Stripe) |

---

## Secrets par environnement — PRODUCTION (`production`)

| Secret | Exemple |
|---|---|
| `PROD_SSH_HOST` | IP du serveur production |
| `PROD_SSH_USER` | `ubuntu` |
| `PROD_SSH_KEY` | Clé privée SSH production |
| `PROD_DATABASE_URL` | `postgresql://postgres:STRONG@postgres:5432/red_handed` |
| `PROD_REDIS_URL` | `redis://:STRONG@redis:6379` |
| `PROD_JWT_SECRET` | `openssl rand -base64 48` |
| `PROD_ALLOWED_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |
| `PROD_APP_URL` | `https://yourdomain.com` |
| `PROD_POSTGRES_PASSWORD` | Mot de passe Postgres production |
| `PROD_REDIS_PASSWORD` | Mot de passe Redis production |
| `PROD_STRIPE_SECRET_KEY` | `sk_live_...` |
| `PROD_STRIPE_WEBHOOK_SECRET` | `whsec_...` (endpoint live Stripe) |

---

## Générer un JWT_SECRET fort

```bash
openssl rand -base64 48
```

---

## Générer une clé SSH pour le déploiement

```bash
# Sur ta machine locale
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Copier la clé publique sur chaque serveur
ssh-copy-id -i ~/.ssh/github_deploy.pub ubuntu@TON_SERVEUR

# Ajouter le contenu de github_deploy (clé privée) comme secret GitHub
cat ~/.ssh/github_deploy
```
