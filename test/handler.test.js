// ABOUTME: Tests for handling one voice note end to end within the process.
// ABOUTME: Real files, real filter, real progress, real HTTP to a local bridge stand-in.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { createNoteHandler } from "../src/handler.js";
import { createFilter } from "../src/filter.js";
import { createProgress } from "../src/progress.js";
import { createSender } from "../src/bridge.js";

const note = {
  chat: "120363428390959185@g.us",
  id: "3A83CAACF24A282D3458",
  senderJid: "447700900000@s.whatsapp.net",
  senderName: "Alice",
  timestamp: "2026-09-14T13:55:47Z",
};

describe("createNoteHandler", () => {
  let tmpDir;
  let outputDir;
  let server;
  let sent;
  let handler;
  let transcribeCalls;
  let transcribeResult;
  let downloadCalls;

  const build = (overrides = {}) =>
    createNoteHandler({
      filter: createFilter({
        whitelist: [{ name: "Me", number: "447949943542" }],
        groups: [{ name: "Nexa", jid: "120363428390959185@g.us" }],
      }),
      store: {
        async downloadAudio({ id, output }) {
          downloadCalls.push(id);
          fs.writeFileSync(output, Buffer.from("ogg-bytes-for-" + id));
          return output;
        },
      },
      transcribe: async (buffer) => {
        transcribeCalls.push(buffer.toString());
        if (transcribeResult instanceof Error) throw transcribeResult;
        return transcribeResult;
      },
      sender: createSender({ baseUrl: server.baseUrl, token: "tok", to: "447949943542" }),
      progress: createProgress(path.join(tmpDir, "progress.json")),
      outputDir,
      tmpDir,
      ...overrides,
    });

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-handler-"));
    outputDir = path.join(tmpDir, "transcriptions");
    fs.mkdirSync(outputDir);
    sent = [];
    transcribeCalls = [];
    downloadCalls = [];
    transcribeResult = { transcript: "hello from the group", duration: 12 };

    const httpServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        sent.push(JSON.parse(body));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, id: "sent-1" }));
      });
    });
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    server = { http: httpServer, baseUrl: `http://127.0.0.1:${httpServer.address().port}` };

    handler = build();
  });

  afterEach(async () => {
    await new Promise((resolve) => server.http.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a markdown note for a voice note in a listed group", async () => {
    await handler(note);

    const files = fs.readdirSync(outputDir);
    expect(files).toHaveLength(1);
    expect(fs.readFileSync(path.join(outputDir, files[0]), "utf-8")).toContain(
      "hello from the group"
    );
  });

  it("credits the note to whoever actually spoke", async () => {
    await handler(note);

    expect(fs.readdirSync(outputDir)[0]).toContain("Alice");
  });

  it("sends the transcript on to the configured recipient", async () => {
    await handler(note);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("447949943542");
    expect(sent[0].message).toContain("hello from the group");
    expect(sent[0].message).toContain("Alice");
  });

  it("transcribes the audio it downloaded", async () => {
    await handler(note);

    expect(downloadCalls).toEqual([note.id]);
    expect(transcribeCalls).toEqual(["ogg-bytes-for-" + note.id]);
  });

  it("ignores a voice note from someone not listed", async () => {
    await handler({ ...note, chat: "447700900000@s.whatsapp.net" });

    expect(fs.readdirSync(outputDir)).toEqual([]);
    expect(sent).toEqual([]);
    expect(downloadCalls).toEqual([]);
  });

  it("does not process the same note twice", async () => {
    await handler(note);
    await handler(note);

    expect(fs.readdirSync(outputDir)).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("retries transcription once before giving up", async () => {
    let attempts = 0;
    handler = build({
      transcribe: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("deepgram hiccup");
        return { transcript: "second time lucky", duration: 3 };
      },
    });

    await handler(note);

    expect(attempts).toBe(2);
    expect(fs.readdirSync(outputDir)).toHaveLength(1);
  });

  it("keeps the audio for manual processing when transcription fails outright", async () => {
    transcribeResult = new Error("deepgram down");

    await handler(note);

    const failedDir = path.join(outputDir, "..", "failed");
    expect(fs.readdirSync(failedDir).some((f) => f.includes("Alice"))).toBe(true);
    expect(fs.readdirSync(outputDir)).toEqual([]);
  });

  it("leaves a failed note unrecorded so catch-up can retry it", async () => {
    transcribeResult = new Error("deepgram down");
    const progress = createProgress(path.join(tmpDir, "progress.json"));
    handler = build({ progress });

    await handler(note);

    expect(progress.seen(note.id)).toBe(false);
  });

  it("still records the note when only the WhatsApp send fails", async () => {
    await new Promise((resolve) => server.http.close(resolve));
    server.http = http.createServer(() => {});
    await new Promise((resolve) => server.http.listen(0, "127.0.0.1", resolve));

    const progress = createProgress(path.join(tmpDir, "progress.json"));
    handler = build({
      progress,
      sender: {
        send: async () => {
          throw new Error("bridge unreachable");
        },
      },
    });

    await handler(note);

    expect(fs.readdirSync(outputDir)).toHaveLength(1);
    expect(progress.seen(note.id)).toBe(true);
  });

  it("cleans up the downloaded audio once it is transcribed", async () => {
    await handler(note);

    const leftovers = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".ogg"));
    expect(leftovers).toEqual([]);
  });
});
