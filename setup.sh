#!/bin/bash
# ── Fresh machine setup for Red Handed ─────────────────────────────────────
# Run once after cloning: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "Setting up Red Handed..."

# Create .env from example if it doesn't exist
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "  Created apps/api/.env"
else
  echo "  apps/api/.env already exists, skipping"
fi

echo ""
echo "Setup complete. Start the full dev stack with:"
echo ""
echo "  docker compose -f docker-compose.dev.yml up"
echo ""
echo "Once running:"
echo "  Web  -> http://localhost:5173"
echo "  API  -> http://localhost:3001"
echo ""
echo "Migrations and seed data run automatically on first start."
