#!/bin/bash
# Provisions a fresh Ubuntu 22.04 host with Docker + docker-compose plugin
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker ubuntu
fi

if ! docker compose version >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
fi

sudo mkdir -p /opt/imposter
sudo chown ubuntu:ubuntu /opt/imposter

echo "Provision complete."
