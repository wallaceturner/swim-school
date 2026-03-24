#!/usr/bin/env bash
set -euo pipefail

npm install --production --prefix ~/swim-school
openclaw plugins install -l ~/swim-school
openclaw gateway restart
