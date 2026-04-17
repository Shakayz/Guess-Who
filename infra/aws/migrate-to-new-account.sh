#!/usr/bin/env bash
# ============================================================================
# migrate-to-new-account.sh
# ----------------------------------------------------------------------------
# One-shot setup of the Red Handed infrastructure in a fresh AWS account
# (210884642211) for the redhanded-game.com domain.
#
# Creates:
#   - ECR repositories (red-handed-api, red-handed-web)
#   - Lightsail instances (redhanded-prod, redhanded-staging) in eu-west-3
#   - Static IPs attached to each instance
#   - GitHub Actions OIDC provider + IAM role (via setup-github-oidc.sh)
#   - Provisions Docker + docker-compose on each Lightsail VM
#
# Idempotent: safe to re-run. Skips anything that already exists.
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (`aws configure`)
#   - Default region eu-west-3
#   - Credentials belong to the NEW account (210884642211)
#   - Lightsail must be fully activated on the AWS account
#     (new accounts can take up to 24h — if you get 403 errors, wait)
#
# Usage:
#   ./infra/aws/migrate-to-new-account.sh
#
# Environment overrides:
#   EXPECTED_ACCOUNT_ID  (default: 210884642211)
#   AWS_REGION           (default: eu-west-3)
#   PROD_INSTANCE_NAME   (default: redhanded-prod)
#   STAGING_INSTANCE_NAME (default: redhanded-staging)
#   PROD_BUNDLE_ID       (default: small_3_0 — $10/mo, 2GB RAM)
#   STAGING_BUNDLE_ID    (default: nano_3_0 — $5/mo, 512MB RAM)
# ============================================================================

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────

EXPECTED_ACCOUNT_ID="${EXPECTED_ACCOUNT_ID:-210884642211}"
AWS_REGION="${AWS_REGION:-eu-west-3}"
AVAILABILITY_ZONE="${AVAILABILITY_ZONE:-${AWS_REGION}a}"

PROD_INSTANCE_NAME="${PROD_INSTANCE_NAME:-redhanded-prod}"
STAGING_INSTANCE_NAME="${STAGING_INSTANCE_NAME:-redhanded-staging}"
PROD_STATIC_IP_NAME="${PROD_STATIC_IP_NAME:-redhanded-prod-ip}"
STAGING_STATIC_IP_NAME="${STAGING_STATIC_IP_NAME:-redhanded-staging-ip}"

# Lightsail bundles — see https://aws.amazon.com/lightsail/pricing/
# small_3_0 = 2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB transfer — $10/mo
# nano_3_0  = 512 MB RAM, 2 vCPU, 20 GB SSD, 1 TB transfer — $5/mo (tight for staging)
# micro_3_0 = 1 GB RAM, 2 vCPU, 40 GB SSD, 2 TB transfer — $7/mo (safer for staging)
PROD_BUNDLE_ID="${PROD_BUNDLE_ID:-small_3_0}"
STAGING_BUNDLE_ID="${STAGING_BUNDLE_ID:-micro_3_0}"

BLUEPRINT_ID="ubuntu_22_04"
SSH_KEY_NAME="${SSH_KEY_NAME:-redhanded-deploy-key}"

API_ECR_REPO="red-handed-api"
WEB_ECR_REPO="red-handed-web"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Helpers ────────────────────────────────────────────────────────────────

log()  { printf "\033[1;34m[%s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }
ok()   { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  ⚠\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m  ✗\033[0m %s\n" "$*" >&2; }

confirm_account() {
  local actual
  actual=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
  if [[ -z "$actual" ]]; then
    err "AWS CLI not configured or unreachable. Run: aws configure"
    exit 1
  fi
  if [[ "$actual" != "$EXPECTED_ACCOUNT_ID" ]]; then
    err "Wrong AWS account: got $actual, expected $EXPECTED_ACCOUNT_ID."
    err "Fix: re-run aws configure or set AWS_PROFILE."
    exit 1
  fi
  ok "AWS account confirmed: $actual"
}

ecr_repo_exists() {
  aws ecr describe-repositories \
    --region "$AWS_REGION" \
    --repository-names "$1" >/dev/null 2>&1
}

create_ecr_repo() {
  local name="$1"
  if ecr_repo_exists "$name"; then
    ok "ECR repo $name already exists"
    return 0
  fi
  log "Creating ECR repo $name"
  aws ecr create-repository \
    --region "$AWS_REGION" \
    --repository-name "$name" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 >/dev/null
  # Basic lifecycle policy: keep last 10 images
  aws ecr put-lifecycle-policy \
    --region "$AWS_REGION" \
    --repository-name "$name" \
    --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep last 10 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":10},"action":{"type":"expire"}}]}' \
    >/dev/null
  ok "ECR repo $name created with lifecycle policy"
}

lightsail_key_exists() {
  aws lightsail get-key-pair \
    --region "$AWS_REGION" \
    --key-pair-name "$1" >/dev/null 2>&1
}

create_lightsail_key() {
  if lightsail_key_exists "$SSH_KEY_NAME"; then
    ok "Lightsail SSH key $SSH_KEY_NAME already exists"
    return 0
  fi
  log "Creating Lightsail SSH key $SSH_KEY_NAME"
  local key_file="$SCRIPT_DIR/../../${SSH_KEY_NAME}.pem"
  aws lightsail create-key-pair \
    --region "$AWS_REGION" \
    --key-pair-name "$SSH_KEY_NAME" \
    --query 'privateKeyBase64' --output text \
    | sed 's/\\n/\n/g' > "$key_file"
  chmod 600 "$key_file"
  ok "Private key saved to $key_file (gitignored, keep safe — you need this content for GitHub secret LIGHTSAIL_SSH_KEY)"
}

instance_exists() {
  aws lightsail get-instance \
    --region "$AWS_REGION" \
    --instance-name "$1" >/dev/null 2>&1
}

create_lightsail_instance() {
  local name="$1" bundle="$2"
  if instance_exists "$name"; then
    ok "Lightsail instance $name already exists"
    return 0
  fi
  log "Creating Lightsail instance $name ($bundle)"
  aws lightsail create-instances \
    --region "$AWS_REGION" \
    --instance-names "$name" \
    --availability-zone "$AVAILABILITY_ZONE" \
    --blueprint-id "$BLUEPRINT_ID" \
    --bundle-id "$bundle" \
    --key-pair-name "$SSH_KEY_NAME" \
    --tags "key=project,value=redhanded" "key=env,value=${name##*-}" \
    >/dev/null
  ok "Instance $name creation requested (takes ~1 min to boot)"
}

wait_instance_running() {
  local name="$1"
  log "Waiting for $name to reach state=running"
  for _ in $(seq 1 60); do
    local state
    state=$(aws lightsail get-instance \
      --region "$AWS_REGION" \
      --instance-name "$name" \
      --query 'instance.state.name' --output text 2>/dev/null || echo "pending")
    if [[ "$state" == "running" ]]; then
      ok "$name is running"
      return 0
    fi
    sleep 5
  done
  err "Timed out waiting for $name"
  return 1
}

static_ip_exists() {
  aws lightsail get-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$1" >/dev/null 2>&1
}

allocate_and_attach_static_ip() {
  local ip_name="$1" instance_name="$2"
  if ! static_ip_exists "$ip_name"; then
    log "Allocating static IP $ip_name"
    aws lightsail allocate-static-ip \
      --region "$AWS_REGION" \
      --static-ip-name "$ip_name" >/dev/null
    ok "Static IP $ip_name allocated"
  else
    ok "Static IP $ip_name already allocated"
  fi

  local attached
  attached=$(aws lightsail get-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$ip_name" \
    --query 'staticIp.attachedTo' --output text 2>/dev/null || echo "None")

  if [[ "$attached" != "$instance_name" ]]; then
    log "Attaching $ip_name → $instance_name"
    aws lightsail attach-static-ip \
      --region "$AWS_REGION" \
      --static-ip-name "$ip_name" \
      --instance-name "$instance_name" >/dev/null
    ok "Attached"
  else
    ok "$ip_name already attached to $instance_name"
  fi
}

get_static_ip() {
  aws lightsail get-static-ip \
    --region "$AWS_REGION" \
    --static-ip-name "$1" \
    --query 'staticIp.ipAddress' --output text
}

open_lightsail_ports() {
  local name="$1"
  log "Opening HTTP/HTTPS/SSH firewall for $name"
  # Lightsail default already opens 22. Add 80 and 443.
  aws lightsail put-instance-public-ports \
    --region "$AWS_REGION" \
    --instance-name "$name" \
    --port-infos \
      fromPort=22,toPort=22,protocol=TCP \
      fromPort=80,toPort=80,protocol=TCP \
      fromPort=443,toPort=443,protocol=TCP \
    >/dev/null
  ok "Firewall configured for $name"
}

provision_instance() {
  local ip="$1" name="$2"
  local key_file="$SCRIPT_DIR/../../${SSH_KEY_NAME}.pem"
  if [[ ! -f "$key_file" ]]; then
    warn "Private key $key_file not found — skipping provisioning for $name."
    warn "Re-run after getting the key from Lightsail console, or regenerate."
    return 0
  fi
  log "Provisioning Docker on $name ($ip)"
  # Wait for SSH to be ready
  for _ in $(seq 1 30); do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
           -i "$key_file" "ubuntu@$ip" "echo ok" >/dev/null 2>&1; then
      break
    fi
    sleep 3
  done
  scp -o StrictHostKeyChecking=no -i "$key_file" \
    "$SCRIPT_DIR/../../deploy/provision.sh" "ubuntu@$ip:/tmp/provision.sh"
  # Strip any CRLF line endings (files edited on Windows) before executing
  ssh -o StrictHostKeyChecking=no -i "$key_file" "ubuntu@$ip" \
    "sed -i 's/\r\$//' /tmp/provision.sh && chmod +x /tmp/provision.sh && /tmp/provision.sh"
  ok "$name provisioned"
}

# ─── Main ───────────────────────────────────────────────────────────────────

log "Starting Red Handed infra migration to account $EXPECTED_ACCOUNT_ID"

confirm_account

log "─── Step 1/4: ECR repositories ───"
create_ecr_repo "$API_ECR_REPO"
create_ecr_repo "$WEB_ECR_REPO"

log "─── Step 2/4: Lightsail SSH key + instances ───"
create_lightsail_key
create_lightsail_instance "$PROD_INSTANCE_NAME" "$PROD_BUNDLE_ID"
create_lightsail_instance "$STAGING_INSTANCE_NAME" "$STAGING_BUNDLE_ID"
wait_instance_running "$PROD_INSTANCE_NAME"
wait_instance_running "$STAGING_INSTANCE_NAME"

log "─── Step 3/4: Static IPs + firewall + provisioning ───"
allocate_and_attach_static_ip "$PROD_STATIC_IP_NAME"    "$PROD_INSTANCE_NAME"
allocate_and_attach_static_ip "$STAGING_STATIC_IP_NAME" "$STAGING_INSTANCE_NAME"
open_lightsail_ports "$PROD_INSTANCE_NAME"
open_lightsail_ports "$STAGING_INSTANCE_NAME"

PROD_IP=$(get_static_ip "$PROD_STATIC_IP_NAME")
STAGING_IP=$(get_static_ip "$STAGING_STATIC_IP_NAME")
ok "Prod IP:    $PROD_IP"
ok "Staging IP: $STAGING_IP"

provision_instance "$PROD_IP"    "$PROD_INSTANCE_NAME"
provision_instance "$STAGING_IP" "$STAGING_INSTANCE_NAME"

log "─── Step 4/4: GitHub Actions OIDC role ───"
bash "$SCRIPT_DIR/setup-github-oidc.sh"

# ─── Summary ────────────────────────────────────────────────────────────────

cat <<EOF

═══════════════════════════════════════════════════════════════════════════
  ✓ AWS infrastructure created
═══════════════════════════════════════════════════════════════════════════

Lightsail instances:
  prod    → $PROD_IP    ($PROD_INSTANCE_NAME)
  staging → $STAGING_IP ($STAGING_INSTANCE_NAME)

ECR:
  ${EXPECTED_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_ECR_REPO}
  ${EXPECTED_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_ECR_REPO}

SSH key (private): ${SSH_KEY_NAME}.pem in repo root (gitignored)

═══════════════════════════════════════════════════════════════════════════
  Next manual steps — see infra/aws/MIGRATION.md for the full checklist
═══════════════════════════════════════════════════════════════════════════

1. Add Namecheap DNS records:
     A     @              $PROD_IP
     A     api            $PROD_IP
     A     staging        $STAGING_IP
     A     api-staging    $STAGING_IP
   (keep the existing MX / TXT / DKIM email records intact)

2. Add GitHub Actions secrets (Repo → Settings → Secrets → Actions):
     LIGHTSAIL_PROD_HOST     = $PROD_IP
     LIGHTSAIL_STAGING_HOST  = $STAGING_IP
     LIGHTSAIL_SSH_KEY       = contents of ${SSH_KEY_NAME}.pem
     GOOGLE_CLIENT_ID        = (new Google OAuth client)
     GOOGLE_CLIENT_SECRET    = (new Google OAuth client)
     VITE_GOOGLE_CLIENT_ID   = (same as GOOGLE_CLIENT_ID)

3. Update Google OAuth (console.cloud.google.com) authorized origins + redirects.

4. Push to the staging branch — CD workflow should deploy successfully.

EOF
