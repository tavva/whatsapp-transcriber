# WhatsApp Transcriber

Automatically transcribes WhatsApp voice notes from chosen contacts and saves them as searchable markdown files. Transcripts are also sent back to you in WhatsApp so you can read them right where you received the voice note.

## What You Get

A voice note from Alice becomes a markdown file like this:

```markdown
# Voice Note — Alice, 9 Mar 2026 16:05

**From:** Alice
**Date:** 2026-03-09 16:05:29
**Duration:** 1m 21s

---

Hey, just wanted to check in about Saturday. I think we should
meet at the café around 11, and I'll bring the documents we
talked about last week...
```

## How It Works

1. You choose which contacts to transcribe
2. The service runs in the background, listening for voice notes
3. When one arrives, it's transcribed using [Deepgram](https://deepgram.com) and saved as a markdown file
4. The transcript is also sent to your "Message Yourself" chat in WhatsApp

If transcription fails, the original audio is saved so nothing is lost.

## Getting Started

You'll need a [Deepgram](https://deepgram.com) API key. Their free tier currently comes with $200 of credit which should last for years of voice notes.

1. Copy `config.example.yaml` to `config.yaml` and add the contacts you'd like to transcribe
2. Set your Deepgram API key: `export DEEPGRAM_API_KEY=your-key`
3. Run `docker compose up`
4. Scan the QR code that appears with your phone — you only need to do this once

## Licence

ISC
