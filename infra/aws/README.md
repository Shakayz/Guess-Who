# AWS Infrastructure — Imposter Game (Guess-Who)

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
  --stack-name prod-imposter-stack \
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
  --stack-name prod-imposter-stack \
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
aws cloudformation create-stack --stack-name dev-imposter-stack \
  --template-body file://infra/aws/cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=Environment,ParameterValue=dev ...

# Staging (PFV)
aws cloudformation create-stack --stack-name staging-imposter-stack \
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

## GitHub Actions Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

### Per-environment secrets (set in each GitHub Environment)

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key for ECS deployments |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |

### Recommended IAM policy for the deploy user

The CI/CD IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:ListTasks",
        "ecs:DescribeTasks",
        "cloudformation:DescribeStacks",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

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
aws ecs describe-services --cluster prod-imposter-cluster \
  --services prod-imposter-api prod-imposter-web \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount,status:status}'

# View recent logs
aws logs tail /ecs/prod/imposter-api --follow

# Force new deployment (re-pull images without changing task def)
aws ecs update-service --cluster prod-imposter-cluster \
  --service prod-imposter-api --force-new-deployment

# Get stack outputs
aws cloudformation describe-stacks --stack-name prod-imposter-stack \
  --query 'Stacks[0].Outputs'
```
