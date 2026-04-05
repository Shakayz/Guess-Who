#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Deploy Imposter Game to AWS ECS Fargate
#
# Usage:
#   ./deploy.sh <environment> [api-image-tag] [web-image-tag]
#
# Examples:
#   ./deploy.sh prod                    # deploy :latest
#   ./deploy.sh dev  dev-abc123         # deploy specific API tag
#   ./deploy.sh prod abc123 abc123      # deploy specific tags for both
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Args ──────────────────────────────────────────────────────
ENV="${1:?Usage: deploy.sh <dev|staging|prod> [api-tag] [web-tag]}"
API_TAG="${2:-latest}"
WEB_TAG="${3:-${API_TAG}}"

# Validate environment
case "$ENV" in
  dev|staging|prod) ;;
  *) echo "ERROR: Environment must be dev, staging, or prod"; exit 1 ;;
esac

CLUSTER="${ENV}-imposter-cluster"
API_SERVICE="${ENV}-imposter-api"
WEB_SERVICE="${ENV}-imposter-web"
API_TASK_FAMILY="${ENV}-imposter-api"
WEB_TASK_FAMILY="${ENV}-imposter-web"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ROLLBACK_API_TASK=""
ROLLBACK_WEB_TASK=""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying Imposter Game — ${ENV}"
echo "  API image tag: ${API_TAG}"
echo "  Web image tag: ${WEB_TAG}"
echo "  Cluster:       ${CLUSTER}"
echo "  Region:        ${REGION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Helpers ───────────────────────────────────────────────────
rollback() {
  echo ""
  echo "!! DEPLOYMENT FAILED — initiating rollback..."

  if [ -n "$ROLLBACK_API_TASK" ]; then
    echo "Rolling back API to: ${ROLLBACK_API_TASK}"
    aws ecs update-service \
      --cluster "$CLUSTER" \
      --service "$API_SERVICE" \
      --task-definition "$ROLLBACK_API_TASK" \
      --region "$REGION" \
      --no-cli-pager > /dev/null
  fi

  if [ -n "$ROLLBACK_WEB_TASK" ]; then
    echo "Rolling back Web to: ${ROLLBACK_WEB_TASK}"
    aws ecs update-service \
      --cluster "$CLUSTER" \
      --service "$WEB_SERVICE" \
      --task-definition "$ROLLBACK_WEB_TASK" \
      --region "$REGION" \
      --no-cli-pager > /dev/null
  fi

  echo "Waiting for rollback to stabilize..."
  aws ecs wait services-stable \
    --cluster "$CLUSTER" \
    --services "$API_SERVICE" "$WEB_SERVICE" \
    --region "$REGION" 2>/dev/null || true

  echo "Rollback complete."
  exit 1
}

trap rollback ERR

# ── 1. Save current task definitions for rollback ─────────────
echo ""
echo "[1/5] Saving current task definitions for rollback..."
ROLLBACK_API_TASK=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$API_SERVICE" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text 2>/dev/null || echo "")

ROLLBACK_WEB_TASK=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$WEB_SERVICE" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text 2>/dev/null || echo "")

echo "  API rollback target: ${ROLLBACK_API_TASK:-none}"
echo "  Web rollback target: ${ROLLBACK_WEB_TASK:-none}"

# ── 2. Get current task definitions and update images ─────────
echo ""
echo "[2/5] Creating new task definition revisions..."

# API — fetch current, swap image, register new revision
API_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$API_TASK_FAMILY" \
  --region "$REGION" \
  --query 'taskDefinition' \
  --output json)

NEW_API_TASK_DEF=$(echo "$API_TASK_DEF" | \
  jq --arg TAG "$API_TAG" \
  '.containerDefinitions[0].image = "ghcr.io/shakayz/guess-who/api:" + $TAG' | \
  jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

NEW_API_ARN=$(echo "$NEW_API_TASK_DEF" | \
  aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region "$REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "  New API task: ${NEW_API_ARN}"

# Web — fetch current, swap image, register new revision
WEB_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$WEB_TASK_FAMILY" \
  --region "$REGION" \
  --query 'taskDefinition' \
  --output json)

NEW_WEB_TASK_DEF=$(echo "$WEB_TASK_DEF" | \
  jq --arg TAG "$WEB_TAG" \
  '.containerDefinitions[0].image = "ghcr.io/shakayz/guess-who/web:" + $TAG' | \
  jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

NEW_WEB_ARN=$(echo "$NEW_WEB_TASK_DEF" | \
  aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region "$REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "  New Web task: ${NEW_WEB_ARN}"

# ── 3. Update ECS services ───────────────────────────────────
echo ""
echo "[3/5] Updating ECS services..."

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$API_SERVICE" \
  --task-definition "$NEW_API_ARN" \
  --region "$REGION" \
  --no-cli-pager > /dev/null

echo "  API service updated."

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$WEB_SERVICE" \
  --task-definition "$NEW_WEB_ARN" \
  --region "$REGION" \
  --no-cli-pager > /dev/null

echo "  Web service updated."

# ── 4. Wait for services to stabilize ────────────────────────
echo ""
echo "[4/5] Waiting for services to stabilize (this may take several minutes)..."

aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$API_SERVICE" "$WEB_SERVICE" \
  --region "$REGION"

echo "  All services stable."

# ── 5. Verify deployment ─────────────────────────────────────
echo ""
echo "[5/5] Verifying deployment..."

API_RUNNING=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$API_SERVICE" \
  --region "$REGION" \
  --query 'services[0].runningCount' \
  --output text)

WEB_RUNNING=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$WEB_SERVICE" \
  --region "$REGION" \
  --query 'services[0].runningCount' \
  --output text)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEPLOYMENT SUCCESSFUL"
echo "  Environment: ${ENV}"
echo "  API tasks running: ${API_RUNNING}"
echo "  Web tasks running: ${WEB_RUNNING}"
echo "  API image: ghcr.io/shakayz/guess-who/api:${API_TAG}"
echo "  Web image: ghcr.io/shakayz/guess-who/web:${WEB_TAG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
