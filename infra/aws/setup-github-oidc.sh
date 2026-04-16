#!/usr/bin/env bash
# Deploys infra/aws/github-oidc.yml — the OIDC provider + IAM role that
# GitHub Actions needs to assume via OIDC (sts:AssumeRoleWithWebIdentity).
#
# Run once per AWS account. If the token.actions.githubusercontent.com OIDC
# provider already exists in the account, re-run with CREATE_OIDC_PROVIDER=false.
#
# Usage:
#   ./infra/aws/setup-github-oidc.sh
#   CREATE_OIDC_PROVIDER=false ./infra/aws/setup-github-oidc.sh

set -euo pipefail

STACK_NAME="${STACK_NAME:-github-oidc-red-handed}"
REGION="${AWS_REGION:-eu-west-3}"
CREATE_OIDC_PROVIDER="${CREATE_OIDC_PROVIDER:-auto}"
# Case-sensitive — must match the exact case registered on GitHub, because
# GitHub OIDC "sub" claims preserve case and AWS IAM StringLike is case-sensitive.
GITHUB_ORG="${GITHUB_ORG:-Shakayz}"
GITHUB_REPO="${GITHUB_REPO:-Guess-Who}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/github-oidc.yml"

if [[ "$CREATE_OIDC_PROVIDER" == "auto" ]]; then
  echo "==> Checking whether a GitHub OIDC provider already exists…"
  if aws iam list-open-id-connect-providers --region "$REGION" \
        --query "OpenIDConnectProviderList[].Arn" --output text 2>/dev/null \
        | grep -q "token.actions.githubusercontent.com"; then
    echo "    Existing provider detected — will NOT create a new one."
    CREATE_OIDC_PROVIDER="false"
  else
    echo "    No existing provider — will create one."
    CREATE_OIDC_PROVIDER="true"
  fi
fi

echo "==> Deploying stack '$STACK_NAME' in $REGION"
echo "    GitHubOrg=$GITHUB_ORG  GitHubRepo=$GITHUB_REPO  CreateOidcProvider=$CREATE_OIDC_PROVIDER"

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --parameter-overrides \
    GitHubOrg="$GITHUB_ORG" \
    GitHubRepo="$GITHUB_REPO" \
    CreateOidcProvider="$CREATE_OIDC_PROVIDER"

echo "==> Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table

echo
echo "Copy the DeployRoleArn above into .github/workflows/cd-staging.yml and"
echo "cd-prod.yml as the ROLE_ARN env value (it should already match"
echo "arn:aws:iam::<account>:role/GitHubActionsRedHandedDeploy)."
