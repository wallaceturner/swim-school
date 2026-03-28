#!/usr/bin/env bash
set -euo pipefail
docker pull wallaceturner/swimschool:latest
docker rm -f swimschool 2>/dev/null || true
docker run -d --name swimschool --restart unless-stopped \
  -p 127.0.0.1:18789:18789 \
  -v /home/wal/swimschool/data:/home/node/.openclaw \
  -e TZ=Australia/Perth \
  -e GOOGLE_WORKSPACE_CLI_CONFIG_DIR=/home/node/.openclaw/gws-config \
  wallaceturner/swimschool:latest

# ssh -N -L 18789:127.0.0.1:18789 wal@dev.investi.com.au
# http://localhost:18789/       