# Build:  ./scripts/docker-build.sh
# Run:    ./scripts/docker-run.sh
# CLI:    docker exec swimschool node dist/index.js <command>
# Shell:  docker exec -it swimschool bash

FROM ghcr.io/openclaw/openclaw:2026.3.24-slim

USER root

# Install Google Workspace CLI
RUN npm install -g @googleworkspace/cli

# Install swim-school plugin and its dependencies
COPY --chown=node:node . /home/node/swim-school/
RUN cd /home/node/swim-school && npm install --omit=dev

USER node

# Link-install the plugin so openclaw discovers it on startup
RUN node dist/index.js plugins install -l /home/node/swim-school
