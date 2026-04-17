# AWS Infrastructure — Red Handed (Guess-Who)

## Architecture

- **Compute**: ECS Fargate (API + Web services)
- **Database**: RDS PostgreSQL 16 (Multi-AZ in prod)
- **Cache**: ElastiCache Redis 7
- **Load Balancer**: ALB with WebSocket/sticky-session support for Socket.IO
- **Storage**: S3 for static assets
- **Networking**: VPC with public/private subnets across 2 AZs

## Prerequisites

1. AWS CLI v2 installed and configured (`aws configure`)
2. `jq` installed (used by deploy script)
3. An ACM certificate for your domain (must be in the same region)
4. Docker images pushed to GHCR

## Deploying the CloudFormation Stack

### First-time setup

```bash
aws cloudformation create-stack \
  --stack-name prod-red-handed-stack \
  --template-body file://infra/aws/cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=Environment,ParameterValue=prod \
    ParameterKey=DomainName,ParameterValue=your-domain.com \
    ParameterKey=ACMCertificateArn,ParameterValue=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID \
    ParameterKey=DBPassword,ParameterValue=YOUR_DB_PASSWORD \
    ParameterKey=RedisAuthToken,ParameterValue=YOUR_REDIS_TOKEN \
    ParameterKey=JWTSecret,ParameterValue=YOUR_JWT_SECRET \
    ParameterKey=APIImageTag,ParameterValue=latest \
    ParameterKey=WebImageTag,ParameterValue=latest
```

### Updating an existing stack

```bash
aws cloudformation update-stack \
  --stack-name prod-red-handed-stack \
  --template-body file://infra/aws/cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=Environment,UsePreviousValue=true \
    ParameterKey=DomainName,UsePreviousValue=true \
    ParameterKey=ACMCertificateArn,UsePreviousValue=true \
    ParameterKey=DBPassword,UsePreviousValue=true \
    ParameterKey=RedisAuthToken,UsePreviousValue=true \
    ParameterKey=JWTSecret,UsePreviousValue=true \
    ParameterKey=APIImageTag,ParameterValue=NEW_TAG \
    ParameterKey=WebImageTag,ParameterValue=NEW_TAG
```

### For dev/staging environments

Use a different stack name and `Environment` parameter:

```bash
# Dev
aws cloudformation create-stack --stack-name dev-red-handed-stack \
  --template-body file://infra/aws/cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=Environment,ParameterValue=dev ...

# Staging (PFV)
aws cloudformation create-stack --stack-name staging-red-handed-stack \
  --template-body file://infra/aws/cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=Environment,ParameterValue=staging ...
```

## Manual Deployment (deploy.sh)

```bash
# Deploy latest to prod
./infra/aws/deploy.sh prod

# Deploy a specific image tag
./infra/aws/deploy.sh prod abc123def

# Deploy different tags for API and Web
./infra/aws/deploy.sh dev dev-abc123 dev-def456
```

The script will:
1. Save current task definitions for rollback
2. Register new task definitions with updated images
3. Update ECS services
4. Wait for stabilization
5. Auto-rollback on failure

## GitHub Actions — OIDC credentials

The CD workflows (`.github/workflows/cd-staging.yml`, `cd-prod.yml`) authenticate
to AWS via **OIDC** (no long-lived access keys). They assume the role
`arn:aws:iam::210884642211:role/GitHubActionsRedHandedDeploy`.

### One-time setup

Run this once per AWS account — it creates the `token.actions.githubusercontent.com`
OIDC provider and the `GitHubActionsRedHandedDeploy` IAM role with a trust
policy scoped to `Shakayz/Guess-Who`:

```bash
./infra/aws/setup-github-oidc.sh
```

The script auto-detects whether the OIDC provider already exists in the
account. To force-skip provider creation:

```bash
CREATE_OIDC_PROVIDER=false ./infra/aws/setup-github-oidc.sh
```

Under the hood this deploys `infra/aws/github-oidc.yml`, which provisions:

- An `AWS::IAM::OIDCProvider` for `token.actions.githubusercontent.com`
- An `AWS::IAM::Role` whose trust policy only accepts OIDC tokens where:
  - `aud` = `sts.amazonaws.com`
  - `sub` matches `repo:Shakayz/Guess-Who:ref:refs/heads/*`,
    `...:environment:production`, `...:environment:staging`, or
    `...:pull_request`

> **Case matters.** GitHub OIDC `sub` claims preserve the exact case of the
> repository owner / name as registered on GitHub (so this repo is
> `Shakayz/Guess-Who`, not `shakayz/guess-who`). AWS IAM `StringLike`
> conditions are case-sensitive — a lowercase pattern will reject every
> real GitHub OIDC token and produce `Not authorized to perform
> sts:AssumeRoleWithWebIdentity`. If you fork/rename the repo, override
> `GITHUB_ORG` / `GITHUB_REPO` when running `setup-github-oidc.sh` using
> the exact case GitHub displays.

### Troubleshooting `Not authorized to perform sts:AssumeRoleWithWebIdentity`

If `aws-actions/configure-aws-credentials` fails with:

```
Error: Could not assume role with OIDC: Not authorized to perform
sts:AssumeRoleWithWebIdentity
```

the role's trust policy is rejecting the GitHub OIDC token. Check:

1. **Provider exists** — `aws iam list-open-id-connect-providers` must list
   `token.actions.githubusercontent.com`. If not, re-run the setup script.
2. **Role exists** — `aws iam get-role --role-name GitHubActionsRedHandedDeploy`
   must succeed.
3. **Trust policy covers the caller**. The `sub` claim of the GitHub OIDC
   token looks like:
   - push to `main`: `repo:Shakayz/Guess-Who:ref:refs/heads/main`
   - prod job (uses `environment: production`):
     `repo:Shakayz/Guess-Who:environment:production`
   The `StringLike` conditions in `github-oidc.yml` must allow these.
   **Case-sensitive**: the patterns must use the exact case GitHub uses
   for the owner/repo (see the callout above). If you forked/renamed the
   repo, update `GitHubOrg` / `GitHubRepo` parameters to the new exact
   case and redeploy the stack (`./infra/aws/setup-github-oidc.sh`).
4. **Workflow has `id-token: write`** — already set in both CD workflows.

## Environment Variable Mapping

| Compose env var | AWS source |
|----------------|------------|
| `DATABASE_URL` | Constructed from RDS endpoint (CloudFormation output `RDSEndpoint`) |
| `REDIS_URL` | Constructed from ElastiCache endpoint (output `RedisEndpoint`) |
| `JWT_SECRET` | CloudFormation parameter / Secrets Manager |
| `ALLOWED_ORIGINS` | Set to `https://<DomainName>` |
| `APP_URL` | Set to `https://<DomainName>` |
| OAuth / Stripe vars | Set directly in task definition environment or via Secrets Manager |

## Scaling Configuration

### API Service (handles WebSocket connections)
- **Min tasks**: 2 (across 2 AZs for HA)
- **Max tasks**: 10
- **Scale trigger**: CPU > 70%
- **Sticky sessions**: Enabled (required for Socket.IO)
- **CPU/Memory**: 512 CPU / 1024 MB per task

### Web Service (static React app via nginx)
- **Min tasks**: 2
- **Max tasks**: 6
- **Scale trigger**: CPU > 70%
- **CPU/Memory**: 256 CPU / 512 MB per task

### Database (RDS)
- **Instance**: db.t3.micro (can be changed to db.t3.small/medium)
- **Multi-AZ**: Enabled in prod only
- **Storage**: 20 GB gp3, auto-scales to 100 GB

### Cache (ElastiCache)
- **Instance**: cache.t3.micro
- **Nodes**: 1 (upgrade to replication group for HA)

To adjust scaling, update `MinCapacity`/`MaxCapacity` in the CloudFormation template
under `APIAutoScalingTarget` and `WebAutoScalingTarget`, then update the stack.

## Useful Commands

```bash
# Check service status
aws ecs describe-services --cluster prod-red-handed-cluster \
  --services prod-red-handed-api prod-red-handed-web \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount,status:status}'

# View recent logs
aws logs tail /ecs/prod/red-handed-api --follow

# Force new deployment (re-pull images without changing task def)
aws ecs update-service --cluster prod-red-handed-cluster \
  --service prod-red-handed-api --force-new-deployment

# Get stack outputs
aws cloudformation describe-stacks --stack-name prod-red-handed-stack \
  --query 'Stacks[0].Outputs'
```
