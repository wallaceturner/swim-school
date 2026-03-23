# Swim School Plugin

WhatsApp bot for swim school instructors: shift inquiries, learn-to-swim doc queries, and shift cover requests.

## Deploy to Live Instance

```bash
# From the repo root:
scp -r /opt/github/openclaw/extensions/swim-school/* wal@api2.investi.com.au:~/swim-school/

# Then on api2:
openclaw plugins install -l ~/swim-school
openclaw gateway restart
```

## Configuration

On the remote, configure the plugin:

```bash
openclaw config set plugins.entries.swim-school.enabled true

# Add instructors (phone in E.164 format)
openclaw config set plugins.entries.swim-school.config.instructors '[
  {"instructorId": "inst-1", "name": "Sarah", "phone": "+61400000001", "email": "sarah@example.com", "siteId": "burwood"},
  {"instructorId": "inst-2", "name": "James", "phone": "+61400000002", "email": "james@example.com", "siteId": "burwood"}
]'

# Add sites
openclaw config set plugins.entries.swim-school.config.sites '[
  {"siteId": "burwood", "name": "Burwood Swim Centre", "suburb": "Burwood", "managerPhone": "+61400000099", "managerName": "Mike"}
]'

# Add allowed Google Docs
openclaw config set plugins.entries.swim-school.config.allowedDocs '[
  {"docId": "YOUR_GOOGLE_DOC_ID", "title": "Learn to Swim Level 1", "category": "programs"}
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
