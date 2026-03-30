#!/usr/bin/env bash
set -euo pipefail

# Seed workspace files if missing
for f in /home/node/swim-school/workspace/*.md; do
  name=$(basename "$f")
  target="/home/node/.openclaw/workspace/$name"
  if [ ! -f "$target" ]; then
    mkdir -p /home/node/.openclaw/workspace
    cp "$f" "$target"
  fi
done

exec node openclaw.mjs "$@"
