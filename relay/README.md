# BSLink relay (BeatSaver map list intermediary)

Small Node/Express service so the **Android app can POST a map list** while the **PC app long-polls** from another network (no shared LAN required). Map list JSON passes through this server; use **HTTPS** in production and host it yourself if you care about privacy.

## Requirements

- Node.js 18+
- A **public HTTPS URL** in production (e.g. behind Fly.io, Railway, Render, or a VPS with a reverse proxy). Set `PUBLIC_ORIGIN` to that origin (no trailing slash), e.g. `https://relay.example.com`.

## Run locally

```bash
cd relay
npm install
set PUBLIC_ORIGIN=http://127.0.0.1:3848
set PORT=3848
npm start
```

On macOS/Linux use `export` instead of `set`.

## API (for the PC app and phone)

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/v1/sessions` | Create a session. Returns `sessionId`, `token`, `pairingUrl`. |
| `POST` | `/v1/sessions/:id/import?token=...&autoDownload=0\|1` | Phone sends `bsaber-map-list` JSON (same as PC LAN `/import`). |
| `GET` | `/v1/sessions/:id/wait?token=...` | PC long-polls until a message arrives or timeout (~50s); repeat. |
| `DELETE` | `/v1/sessions/:id?token=...` | End session (optional). |
| `GET` | `/health` | Health check. |

Environment variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3848` | Listen port |
| `PUBLIC_ORIGIN` | `http://127.0.0.1:PORT` | Used in `pairingUrl` for QR codes |
| `SESSION_TTL_MS` | 24h | Session expiry |
| `WAIT_TIMEOUT_MS` | 50000 | Long-poll wait |
| `MAX_BODY_BYTES` | 26MB | Max JSON body |

## PC app

In **Receive → Internet relay**, enter the relay **base URL** (e.g. `https://relay.example.com`), click **Start relay session**, then scan the QR from the Android app. The PC stores `relayUrl` in its settings.

## Security notes

- Use TLS (`https://`) for anything beyond localhost.
- Anyone with the session `token` can post to that session; treat QR contents like a password.
- For multi-instance scaling you would add Redis or similar (not included in this MVP).
