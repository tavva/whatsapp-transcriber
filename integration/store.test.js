// ABOUTME: Integration tests against the real wacli store and the real Deepgram API.
// ABOUTME: Needs the store mounted at STORE_DIR, the wacli binary, and DEEPGRAM_API_KEY.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { DefaultDeepgramClient } from "@deepgram/sdk";
import { createStore } from "../src/store.js";
import { createTranscriber } from "../src/transcriber.js";

const STORE_DIR = process.env.STORE_DIR || "/whatsapp";

// A real voice note in the Nexa group, 14 September 2026 13:55:47Z.
const CHAT = "120363428390959185@g.us";
const MESSAGE_ID = "3A83CAACF24A282D3458";

describe("wacli store", () => {
  let store;

  beforeAll(() => {
    if (!fs.existsSync(STORE_DIR)) {
      throw new Error(
        `No wacli store at ${STORE_DIR}. Run this on yeats with the store mounted, or set STORE_DIR.`
      );
    }
    store = createStore({ storeDir: STORE_DIR });
  });

  it("reads a known voice note out of the store", async () => {
    const note = await store.note(CHAT, MESSAGE_ID);

    expect(note).not.toBeNull();
    expect(note.id).toBe(MESSAGE_ID);
    expect(note.chat).toBe(CHAT);
    expect(note.senderJid).toMatch(/@s\.whatsapp\.net$/);
  });

  it("returns nothing for a message that is not a voice note", async () => {
    const notes = await store.notesSince(null, 5);
    expect(Array.isArray(notes)).toBe(true);

    const missing = await store.note(CHAT, "NOTAREALMESSAGEID");
    expect(missing).toBeNull();
  });

  it("downloads the audio for a known voice note", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-integration-"));
    const output = path.join(tmpDir, "note.ogg");

    await store.downloadAudio({ chat: CHAT, id: MESSAGE_ID, output });

    const audio = fs.readFileSync(output);
    expect(audio.length).toBeGreaterThan(1000);
    expect(audio.subarray(0, 4).toString()).toBe("OggS");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("transcribes that audio with Deepgram", async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error("DEEPGRAM_API_KEY is required for this test");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-integration-"));
    const output = path.join(tmpDir, "note.ogg");
    await store.downloadAudio({ chat: CHAT, id: MESSAGE_ID, output });

    const deepgram = new DefaultDeepgramClient({
      apiKey: `Token ${apiKey}`,
      headers: { Authorization: `Token ${apiKey}` },
    });
    const result = await createTranscriber(deepgram)(fs.readFileSync(output));

    expect(typeof result.transcript).toBe("string");
    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
