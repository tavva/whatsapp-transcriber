# WhatsApp Voice Note Transcriber — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dockerised Node.js service that transcribes WhatsApp voice notes from whitelisted contacts via Deepgram and saves them as markdown files, sending the transcript back to the user in WhatsApp.

**Architecture:** Event-driven Node.js app using whatsapp-web.js to listen for incoming voice notes, Deepgram SDK for transcription, and local filesystem for markdown output. Config is YAML-based with a contact whitelist.

**Tech Stack:** Node.js (ESM), whatsapp-web.js, @deepgram/sdk, js-yaml, vitest, Docker

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `config.example.yaml`

**Step 1: Initialise package.json**

```bash
cd /Users/ben/repos/whatsapp-transcriber
npm init -y
```

Then edit `package.json` to set `"type": "module"` and add a start script:

```json
{
  "name": "whatsapp-transcriber",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "vitest run"
  }
}
```

**Step 2: Install dependencies**

```bash
npm install whatsapp-web.js qrcode-terminal js-yaml @deepgram/sdk
npm install -D vitest
```

**Step 3: Create .gitignore**

```
node_modules/
config.yaml
data/
.wwebjs_auth/
```

**Step 4: Create config.example.yaml**

```yaml
# Copy to config.yaml and fill in your values.
# Deepgram API key can also be set via DEEPGRAM_API_KEY env var.
deepgram_api_key: your-deepgram-api-key-here
output_dir: /data/transcriptions

whitelist:
  - name: Alice
    number: "447700900000"
  - name: Bob
    number: "447700900001"
```

**Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore config.example.yaml
git commit -m "chore: scaffold project with dependencies"
```

---

### Task 2: Config Loader (TDD)

**Files:**
- Create: `src/config.js`
- Create: `test/config.test.js`

**Step 1: Write failing tests**

```js
// test/config.test.js
// ABOUTME: Tests for YAML config loading and validation.
// ABOUTME: Covers whitelist parsing, defaults, env var overrides, and error cases.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("loadConfig", () => {
  let tmpDir;
  let configPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
    configPath = path.join(tmpDir, "config.yaml");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    delete process.env.DEEPGRAM_API_KEY;
  });

  it("loads a valid config file", () => {
    fs.writeFileSync(
      configPath,
      `deepgram_api_key: test-key
output_dir: /data/transcriptions
whitelist:
  - name: Alice
    number: "447700900000"
`
    );

    const config = loadConfig(configPath);
    expect(config.deepgramApiKey).toBe("test-key");
    expect(config.outputDir).toBe("/data/transcriptions");
    expect(config.whitelist).toEqual([
      { name: "Alice", number: "447700900000" },
    ]);
  });

  it("uses DEEPGRAM_API_KEY env var over config file value", () => {
    fs.writeFileSync(
      configPath,
      `deepgram_api_key: file-key
output_dir: /data/transcriptions
whitelist:
  - name: Alice
    number: "447700900000"
`
    );

    process.env.DEEPGRAM_API_KEY = "env-key";
    const config = loadConfig(configPath);
    expect(config.deepgramApiKey).toBe("env-key");
  });

  it("throws if config file does not exist", () => {
    expect(() => loadConfig("/nonexistent/config.yaml")).toThrow();
  });

  it("throws if whitelist is empty", () => {
    fs.writeFileSync(
      configPath,
      `deepgram_api_key: test-key
output_dir: /tmp
whitelist: []
`
    );
    expect(() => loadConfig(configPath)).toThrow("whitelist");
  });

  it("throws if deepgram_api_key is missing and env var not set", () => {
    fs.writeFileSync(
      configPath,
      `output_dir: /tmp
whitelist:
  - name: Alice
    number: "447700900000"
`
    );
    expect(() => loadConfig(configPath)).toThrow("deepgram");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run test/config.test.js
```

Expected: FAIL — `loadConfig` does not exist.

**Step 3: Implement config.js**

```js
// src/config.js
// ABOUTME: Loads and validates the YAML config file.
// ABOUTME: Supports env var override for the Deepgram API key.

import fs from "fs";
import yaml from "js-yaml";

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf-8");
  const doc = yaml.load(raw);

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY || doc.deepgram_api_key;
  if (!deepgramApiKey) {
    throw new Error(
      "Missing deepgram API key: set deepgram_api_key in config or DEEPGRAM_API_KEY env var"
    );
  }

  const whitelist = doc.whitelist || [];
  if (whitelist.length === 0) {
    throw new Error("Config whitelist must contain at least one contact");
  }

  return {
    deepgramApiKey,
    outputDir: doc.output_dir || "/data/transcriptions",
    whitelist,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run test/config.test.js
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/config.js test/config.test.js
git commit -m "feat: add config loader with validation"
```

---

### Task 3: Note Writer (TDD)

**Files:**
- Create: `src/notes.js`
- Create: `test/notes.test.js`

**Step 1: Write failing tests**

```js
// test/notes.test.js
// ABOUTME: Tests for markdown note writing from voice note transcriptions.
// ABOUTME: Covers file creation, content format, and directory auto-creation.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeNote } from "../src/notes.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("writeNote", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-notes-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("writes a markdown file with the correct content", () => {
    const filePath = writeNote({
      outputDir: tmpDir,
      senderName: "Alice",
      timestamp: new Date("2026-03-09T15:30:42Z"),
      duration: 83,
      transcript: "Hey, just wanted to check in about tomorrow.",
    });

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("# Voice Note — Alice");
    expect(content).toContain("**From:** Alice");
    expect(content).toContain("**Duration:** 1m 23s");
    expect(content).toContain("Hey, just wanted to check in about tomorrow.");
  });

  it("generates a filename from date, time, and sender", () => {
    const filePath = writeNote({
      outputDir: tmpDir,
      senderName: "Bob",
      timestamp: new Date("2026-03-09T08:05:00Z"),
      duration: 10,
      transcript: "Hello",
    });

    const filename = path.basename(filePath);
    expect(filename).toMatch(/^2026-03-09_\d{2}-\d{2}_Bob\.md$/);
  });

  it("creates the output directory if it does not exist", () => {
    const nested = path.join(tmpDir, "sub", "dir");
    const filePath = writeNote({
      outputDir: nested,
      senderName: "Alice",
      timestamp: new Date(),
      duration: 5,
      transcript: "Test",
    });

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("formats duration correctly for seconds only", () => {
    const filePath = writeNote({
      outputDir: tmpDir,
      senderName: "Alice",
      timestamp: new Date("2026-03-09T12:00:00Z"),
      duration: 45,
      transcript: "Short note",
    });

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("**Duration:** 0m 45s");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run test/notes.test.js
```

Expected: FAIL — `writeNote` does not exist.

**Step 3: Implement notes.js**

```js
// src/notes.js
// ABOUTME: Writes voice note transcriptions as markdown files.
// ABOUTME: Files are named by date, time, and sender for easy browsing.

import fs from "fs";
import path from "path";

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(date) {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${h}-${m}`;
}

function formatTimestamp(date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function writeNote({ outputDir, senderName, timestamp, duration, transcript }) {
  fs.mkdirSync(outputDir, { recursive: true });

  const dateStr = formatDate(timestamp);
  const timeStr = formatTime(timestamp);
  const filename = `${dateStr}_${timeStr}_${senderName}.md`;
  const filePath = path.join(outputDir, filename);

  const content = `# Voice Note — ${senderName}, ${timestamp.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} ${timeStr.replace("-", ":")}

**From:** ${senderName}
**Date:** ${formatTimestamp(timestamp)}
**Duration:** ${formatDuration(duration)}

---

${transcript}
`;

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run test/notes.test.js
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/notes.js test/notes.test.js
git commit -m "feat: add markdown note writer"
```

---

### Task 4: Transcriber (TDD)

**Files:**
- Create: `src/transcriber.js`
- Create: `test/transcriber.test.js`

We mock the Deepgram HTTP call here since we're testing our wrapper logic (buffer conversion, option passing, result extraction, error handling), not Deepgram itself.

**Step 1: Write failing tests**

```js
// test/transcriber.test.js
// ABOUTME: Tests for the Deepgram transcription wrapper.
// ABOUTME: Verifies transcript extraction and error handling using a mock SDK.

import { describe, it, expect, vi } from "vitest";
import { createTranscriber } from "../src/transcriber.js";

function makeMockDeepgram(response) {
  return {
    listen: {
      prerecorded: {
        transcribeFile: vi.fn().mockResolvedValue(response),
      },
    },
  };
}

describe("createTranscriber", () => {
  it("returns the transcript text from a successful response", async () => {
    const mockClient = makeMockDeepgram({
      result: {
        results: {
          channels: [
            { alternatives: [{ transcript: "Hello from the voice note" }] },
          ],
        },
      },
      error: null,
    });

    const transcribe = createTranscriber(mockClient);
    const result = await transcribe(Buffer.from("fake-audio"));

    expect(result).toBe("Hello from the voice note");
    expect(mockClient.listen.prerecorded.transcribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ model: "nova-3", smart_format: true })
    );
  });

  it("throws when Deepgram returns an error", async () => {
    const mockClient = makeMockDeepgram({
      result: null,
      error: { message: "Invalid audio" },
    });

    const transcribe = createTranscriber(mockClient);
    await expect(transcribe(Buffer.from("bad"))).rejects.toThrow(
      "Invalid audio"
    );
  });

  it("throws when response has no transcript", async () => {
    const mockClient = makeMockDeepgram({
      result: { results: { channels: [] } },
      error: null,
    });

    const transcribe = createTranscriber(mockClient);
    await expect(transcribe(Buffer.from("empty"))).rejects.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run test/transcriber.test.js
```

Expected: FAIL — `createTranscriber` does not exist.

**Step 3: Implement transcriber.js**

```js
// src/transcriber.js
// ABOUTME: Wraps the Deepgram SDK to transcribe audio buffers.
// ABOUTME: Returns the transcript text or throws on failure.

export function createTranscriber(deepgramClient) {
  return async function transcribe(audioBuffer) {
    const { result, error } = await deepgramClient.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "nova-3",
        smart_format: true,
        detect_language: true,
      }
    );

    if (error) {
      throw new Error(error.message || "Deepgram transcription failed");
    }

    const channels = result?.results?.channels;
    if (!channels || channels.length === 0) {
      throw new Error("No transcription channels in Deepgram response");
    }

    return channels[0].alternatives[0].transcript;
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run test/transcriber.test.js
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/transcriber.js test/transcriber.test.js
git commit -m "feat: add Deepgram transcription wrapper"
```

---

### Task 5: WhatsApp Client

**Files:**
- Create: `src/whatsapp.js`

This module handles WhatsApp Web connection, message filtering, and media download. It's not unit-testable in a meaningful way — we test it manually with a real voice note.

**Step 1: Implement whatsapp.js**

```js
// src/whatsapp.js
// ABOUTME: Connects to WhatsApp Web and listens for incoming voice notes.
// ABOUTME: Filters messages by whitelist and dispatches audio for transcription.

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

export function createWhatsAppClient({ authDir, onVoiceNote }) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("Scan this QR code with WhatsApp on your phone");
  });

  client.on("authenticated", () => {
    console.log("WhatsApp authenticated");
  });

  client.on("ready", () => {
    console.log(`WhatsApp client ready (logged in as ${client.info.pushname})`);
  });

  client.on("disconnected", (reason) => {
    console.log("WhatsApp disconnected:", reason);
  });

  client.on("message", async (message) => {
    if (message.type !== "ptt") return;

    const contact = await message.getContact();
    const number = message.from.replace("@c.us", "");

    await onVoiceNote({ message, contact, number });
  });

  return client;
}

export async function sendSelfMessage(client, text) {
  const myNumber = client.info.wid._serialized;
  await client.sendMessage(myNumber, text);
}
```

**Step 2: Commit**

```bash
git add src/whatsapp.js
git commit -m "feat: add WhatsApp client with voice note listener"
```

---

### Task 6: Entry Point

**Files:**
- Create: `src/index.js`

**Step 1: Implement index.js**

This wires all components together: loads config, creates the Deepgram client, starts the WhatsApp client, and handles the voice note flow.

```js
// src/index.js
// ABOUTME: Entry point that wires WhatsApp, Deepgram, and note writing together.
// ABOUTME: Listens for voice notes, transcribes them, saves markdown, and messages back.

import { createClient } from "@deepgram/sdk";
import { loadConfig } from "./config.js";
import { createTranscriber } from "./transcriber.js";
import { writeNote } from "./notes.js";
import { createWhatsAppClient, sendSelfMessage } from "./whatsapp.js";
import fs from "fs";
import path from "path";

const CONFIG_PATH = process.env.CONFIG_PATH || "./config.yaml";

const config = loadConfig(CONFIG_PATH);
const deepgram = createClient(config.deepgramApiKey);
const transcribe = createTranscriber(deepgram);

const whitelistedNumbers = new Set(config.whitelist.map((c) => c.number));
const numberToName = Object.fromEntries(
  config.whitelist.map((c) => [c.number, c.name])
);

const client = createWhatsAppClient({
  authDir: process.env.AUTH_DIR || "./.wwebjs_auth",
  onVoiceNote: async ({ message, contact, number }) => {
    if (!whitelistedNumbers.has(number)) return;

    const senderName = numberToName[number] || contact.pushname || "Unknown";
    console.log(`Voice note received from ${senderName} (${number})`);

    try {
      const media = await message.downloadMedia();
      const audioBuffer = Buffer.from(media.data, "base64");

      let transcript;
      try {
        transcript = await transcribe(audioBuffer);
      } catch (err) {
        console.error("Transcription failed, retrying once:", err.message);
        transcript = await transcribe(audioBuffer);
      }

      const timestamp = new Date(message.timestamp * 1000);

      const filePath = writeNote({
        outputDir: config.outputDir,
        senderName,
        timestamp,
        duration: Math.round(media.filesize ? media.filesize / 1000 : 0),
        transcript,
      });

      console.log(`Transcription saved to ${filePath}`);

      await sendSelfMessage(
        client,
        `📝 Voice note from ${senderName}:\n\n${transcript}`
      );

      console.log("Transcription sent to self in WhatsApp");
    } catch (err) {
      console.error(`Failed to process voice note from ${senderName}:`, err);

      const failedDir = path.join(config.outputDir, "..", "failed");
      fs.mkdirSync(failedDir, { recursive: true });
      try {
        const media = await message.downloadMedia();
        const audioBuffer = Buffer.from(media.data, "base64");
        const failedPath = path.join(
          failedDir,
          `${Date.now()}_${senderName}.ogg`
        );
        fs.writeFileSync(failedPath, audioBuffer);
        console.log(`Audio saved to ${failedPath} for manual processing`);
      } catch (saveErr) {
        console.error("Failed to save audio file:", saveErr.message);
      }
    }
  },
});

client.initialize();
```

**Note:** The `duration` calculation from `media.filesize` is a rough estimate. WhatsApp's message object doesn't expose duration directly for voice notes. We may refine this later if Deepgram's response includes duration metadata.

**Step 2: Commit**

```bash
git add src/index.js
git commit -m "feat: add entry point wiring all components together"
```

---

### Task 7: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yaml`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-slim

RUN apt-get update && \
    apt-get install -y chromium && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ src/

CMD ["node", "src/index.js"]
```

**Step 2: Create docker-compose.yaml**

```yaml
services:
  transcriber:
    build: .
    container_name: whatsapp-transcriber
    restart: unless-stopped
    environment:
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - CONFIG_PATH=/app/config.yaml
      - AUTH_DIR=/data/auth
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./data/auth:/data/auth
      - ./data/transcriptions:/data/transcriptions
      - ./data/failed:/data/failed
```

**Step 3: Commit**

```bash
git add Dockerfile docker-compose.yaml
git commit -m "feat: add Docker and docker-compose setup"
```

---

### Task 8: Smoke Test

**Step 1: Build the Docker image**

```bash
docker compose build
```

Expected: Image builds successfully.

**Step 2: Create a config.yaml with a real contact**

Copy `config.example.yaml` to `config.yaml` and fill in real values.

**Step 3: Start the service**

```bash
DEEPGRAM_API_KEY=your-key docker compose up
```

Expected: QR code appears in logs. Scan it. Client connects.

**Step 4: Send a voice note from the whitelisted contact**

Expected:
- Console logs show "Voice note received from ..."
- A markdown file appears in `data/transcriptions/`
- A message appears in your "Message Yourself" WhatsApp chat

**Step 5: Commit any fixes from smoke testing**
