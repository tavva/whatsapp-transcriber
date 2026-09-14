// ABOUTME: Tests for the HTTP endpoint wacli posts live messages to.
// ABOUTME: Exercises real requests against a real listening server.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { createServer } from "../src/server.js";

const secret = "shared-secret";
const sign = (body) => "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

const payload = {
  Chat: "120363428390959185@g.us",
  ID: "3A83CAACF24A282D3458",
  SenderJID: "447535983823@s.whatsapp.net",
  Timestamp: "2026-09-14T13:55:47Z",
  FromMe: false,
  Text: "[Audio]",
  ChatName: "Nexa",
};

describe("createServer", () => {
  let server;
  let baseUrl;
  let handled;
  let onNote;

  const post = (body, headers = {}) =>
    fetch(`${baseUrl}/hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });

  beforeEach(async () => {
    handled = [];
    onNote = async (note) => {
      handled.push(note);
    };

    server = createServer({ secret, onNote: (note) => onNote(note) });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("accepts a correctly signed message and passes it on", async () => {
    const body = JSON.stringify(payload);
    const response = await post(body, { "X-Wacli-Signature": sign(body) });

    expect(response.status).toBe(202);
    expect(handled).toEqual([payload]);
  });

  it("rejects an unsigned post and passes nothing on", async () => {
    const response = await post(JSON.stringify(payload));

    expect(response.status).toBe(401);
    expect(handled).toEqual([]);
  });

  it("rejects a tampered body", async () => {
    const body = JSON.stringify(payload);
    const response = await post(body.replace("3A83", "0000"), { "X-Wacli-Signature": sign(body) });

    expect(response.status).toBe(401);
    expect(handled).toEqual([]);
  });

  it("rejects a body that is not JSON", async () => {
    const body = "not json";
    const response = await post(body, { "X-Wacli-Signature": sign(body) });

    expect(response.status).toBe(400);
  });

  it("answers before the note has finished processing", async () => {
    onNote = () => new Promise(() => {});
    const body = JSON.stringify(payload);

    const response = await post(body, { "X-Wacli-Signature": sign(body) });
    expect(response.status).toBe(202);
  });

  it("stays up when processing a note throws", async () => {
    onNote = async () => {
      throw new Error("deepgram exploded");
    };
    const body = JSON.stringify(payload);

    expect((await post(body, { "X-Wacli-Signature": sign(body) })).status).toBe(202);

    onNote = async (note) => handled.push(note);
    expect((await post(body, { "X-Wacli-Signature": sign(body) })).status).toBe(202);
  });

  it("reports healthy on /healthz", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns not found for any other path", async () => {
    expect((await fetch(`${baseUrl}/elsewhere`)).status).toBe(404);
  });
});
