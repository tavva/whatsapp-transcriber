# WhatsApp Voice Note Transcriber — Design

## Overview

A Dockerised Node.js service that connects to WhatsApp Web, listens for
incoming voice notes from whitelisted contacts, transcribes them via Deepgram,
saves the transcription as a markdown file, and sends the text back to the user
in WhatsApp's "Message Yourself" chat.

## Components

- **WhatsApp client** — whatsapp-web.js with Puppeteer. Authenticates via QR
  code on first run, persists session across restarts.
- **Audio handler** — Downloads voice note media (ogg/opus), passes the buffer
  to Deepgram.
- **Transcription** — Deepgram Node SDK, pre-recorded (batch) API.
- **Note writer** — Saves markdown files to a mounted volume, named by
  date/time and sender (e.g. `2026-03-09_15-30_Alice.md`).
- **Self-messenger** — Sends the transcription text to the user's own WhatsApp
  number via "Message Yourself".

## Data Flow

1. Voice note arrives → check sender against whitelist → ignore if not listed
2. Download media from WhatsApp (ogg/opus buffer)
3. Send buffer to Deepgram pre-recorded API → get transcript text back
4. Write markdown file to output directory
5. Send transcript to "Message Yourself" chat in WhatsApp

## Markdown File Format

```markdown
# Voice Note — Alice, 9 Mar 2026 15:30

**From:** Alice
**Date:** 2026-03-09 15:30:42
**Duration:** 1m 23s

---

Transcribed text goes here...
```

## Configuration

`config.yaml` (gitignored, `config.example.yaml` committed as template):

```yaml
deepgram_api_key: ${DEEPGRAM_API_KEY}
output_dir: /data/transcriptions

whitelist:
  - name: Alice
    number: "447700900000"
  - name: Bob
    number: "447700900001"
```

Sensitive values (Deepgram API key) passed as environment variables.

## Docker & Deployment

- Node.js base image with Chromium (required by Puppeteer for whatsapp-web.js)
- Mounted volumes:
  - `/data/transcriptions` — markdown output
  - `/data/auth` — WhatsApp session persistence
- Config file mounted into container
- Deepgram API key passed as env var
- `docker-compose.yaml` for managing volumes and env vars

### First-run Auth

QR code printed to container logs (`docker logs -f whatsapp-transcriber`).
Scan from phone. Session persists in auth volume across restarts.

### Error Handling

- Deepgram failure: log error, retry once. If still failing, save audio to
  `failed/` subdirectory.
- WhatsApp disconnect: whatsapp-web.js handles reconnection automatically.
  Log disconnect/reconnect events.

## Project Structure

```
whatsapp-transcriber/
├── Dockerfile
├── docker-compose.yaml
├── package.json
├── config.example.yaml
├── .gitignore
├── src/
│   ├── index.js          # Entry point — wires everything together
│   ├── whatsapp.js       # WhatsApp client setup & message listener
│   ├── transcriber.js    # Deepgram transcription
│   ├── notes.js          # Markdown file writer
│   └── config.js         # Loads & validates config.yaml
├── test/
│   └── ...
└── data/                 # Gitignored, created by Docker volumes
    ├── transcriptions/
    ├── auth/
    └── failed/
```

## Testing

- Unit tests for `transcriber.js`, `notes.js`, and `config.js`
- WhatsApp integration tested manually with real voice notes
- Test framework: vitest
