# Swim School Plugin

WhatsApp bot for Waterwise swim school instructors and managers.

## Build

```bash
docker build -t wallaceturner/swimschool:latest .
docker push wallaceturner/swimschool:latest
```

## Deploy

On `dev.investi.com.au`:

```bash
bash /home/wal/swimschool/deploy_swimschool.sh
```

Or interactively (foreground, see logs):

```bash
docker run --rm -it -p 127.0.0.1:18789:18789 -v /home/wal/swimschool/data:/home/node/.openclaw -e TZ=Australia/Perth -e GOOGLE_WORKSPACE_CLI_CONFIG_DIR=/home/node/.openclaw/gws-config wallaceturner/swimschool:latest
```

## Access

SSH tunnel from local machine:

```bash
ssh -N -L 18789:127.0.0.1:18789 wal@dev.investi.com.au
```

Then open http://localhost:18789/

## First-Time Container Setup

Exec into the running container:

```bash
docker exec -it swimschool bash
```

### OpenClaw setup wizard

```bash
node openclaw.mjs setup
```

### Disable quips

```bash
node openclaw.mjs config set cli.banner.taglineMode '"off"'
```

### Google Workspace CLI auth

```bash
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR=/home/node/.openclaw/gws-config
gws auth login
```

Test it works:

```bash
gws drive files list --params '{"pageSize":1}'
```

### Device pairing (web UI)

After opening the web UI for the first time, it will show "pairing required". Inside the container:

```bash
node openclaw.mjs devices list
node openclaw.mjs devices approve <request-id>
```

### File permissions

The container runs as uid 1000 (`node`). If you get permission errors, fix ownership on the host:

```bash
sudo chown -R 1000:1000 /home/wal/swimschool/data
```

## Plugin Config

All config is set inside the container via `node openclaw.mjs config set ...` or by editing `/home/node/.openclaw/openclaw.json`.

### Instructors

```bash
node openclaw.mjs config set plugins.entries.swim-school.config.instructors '[{"name": "Sarah", "phone": "+61400000001", "email": "sarah@example.com", "siteIds": ["mosmanpark"]}]'
```

### Managers

```bash
node openclaw.mjs config set plugins.entries.swim-school.config.managers '[{"name": "Wal", "phone": "+61438862978", "email": "wallaceturner@gmail.com", "siteIds": ["mosmanpark"]}]'
```

### Sites

```bash
node openclaw.mjs config set plugins.entries.swim-school.config.sites '[{"siteId": "mosmanpark"}]'
```

### Drive folder

```bash
node openclaw.mjs config set plugins.entries.swim-school.config.driveFolder '"instructors"'
```

### WhatsApp allowlist

Instructors/managers must also be in the WhatsApp allowFrom list:

```bash
node openclaw.mjs config set channels.whatsapp.allowFrom '["+61438862978", "+61400000001"]'
```

## Logs

```bash
docker logs -f swimschool
```

## Features

1. **Doc queries** - search, read, and email learn-to-swim program documents from a Google Drive folder
2. **Shift inquiry** - look up upcoming shifts (mock data for now)
3. **Shift cover** - request cover, notify other instructors, manager approval flow

## Config Options

| Key | Default | Description |
|-----|---------|-------------|
| `driveFolder` | `"instructors"` | Google Drive folder name for documents |
| `apiMode` | `"mock"` | `"mock"` for sample shift data, `"live"` when API is ready |
| `coverRequestExpiryHours` | `24` | Hours before unanswered cover requests expire |

## Testing Without SIM Cards

Set `SWIM_DRY_RUN=1` in the container environment to log WhatsApp notifications to console instead of sending them:

```bash
docker run ... -e SWIM_DRY_RUN=1 wallaceturner/swimschool:latest
```
