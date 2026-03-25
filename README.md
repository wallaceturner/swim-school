# Swim School Plugin

WhatsApp bot for swim school instructors: shift inquiries, learn-to-swim doc queries, and shift cover requests.

## Deploy to Live Instance

```bash
# From the repo root:
scp -r /opt/github/wallaceturner/swim-school/* wal@api2.investi.com.au:~/swim-school/

# Then on api2:
./deploy.sh
```

## First-Time Setup on Remote

```bash
# Trust the plugin to suppress the "plugins.allow is empty" warning:
openclaw config set plugins.allow '["swim-school"]'
```

## Configuration

On the remote, configure the plugin:

```bash
openclaw config set plugins.entries.swim-school.enabled true

# Add instructors (phone in E.164 format, email is unique ID)
openclaw config set plugins.entries.swim-school.config.instructors '[
  {"name": "Wal", "phone": "+61438862978", "email": "wallaceturner@gmail.com", "siteIds": ["mosmanpark"]}
]'

# Add managers
openclaw config set plugins.entries.swim-school.config.managers '[
  {"name": "Wal", "phone": "+61438862978", "email": "wallaceturner@gmail.com", "siteIds": ["mosmanpark"]}
]'

# Add sites
openclaw config set plugins.entries.swim-school.config.sites '[
  {"siteId": "mosmanpark"}
]'
```

## Features

1. **Shift inquiry** — Instructors ask the bot what shifts they have coming up.
2. **Doc query** — Instructors ask about learn-to-swim programs or request a PDF via email.
3. **Shift cover** — Instructors request cover for a shift; the bot messages other instructors at the same site and coordinates manager approval.

Instructors are identified by their WhatsApp phone number. The AI is locked down to only these three capabilities.

## Config Options

| Key | Default | Description |
|-----|---------|-------------|
| `apiMode` | `"mock"` | `"mock"` for sample data, `"live"` when the shift API is ready |
| `apiBaseUrl` | — | Base URL for the live shift API |
| `coverRequestExpiryHours` | `24` | Hours before unanswered cover requests expire |
| `gwBinaryPath` | `"gw"` | Path to the Google Workspace CLI binary |
