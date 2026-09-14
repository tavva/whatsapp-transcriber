// ABOUTME: Tests for sending transcripts back through the whatsapp-bridge service.
// ABOUTME: Runs against a real local HTTP server so the request itself is exercised.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "http";
import { createSender } from "../src/bridge.js";

describe("createSender", () => {
  let server;
  let baseUrl;
  let received;
  let reply;

  beforeEach(async () => {
    received = [];
    reply = { status: 200, body: { ok: true, id: "3EB0ABC", delivered_at: "2026-09-14T14:00:00Z" } };

    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received.push({ url: req.url, method: req.method, headers: req.headers, body: JSON.parse(body) });
        res.writeHead(reply.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(reply.body));
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("posts the transcript to the configured recipient", async () => {
    const sender = createSender({ baseUrl, token: "tok", to: "447949943542" });
    await sender.send({ text: "hello there", idempotencyKey: "a1" });

    expect(received[0].url).toBe("/v1/send/text");
    expect(received[0].method).toBe("POST");
    expect(received[0].body).toEqual({ to: "447949943542", message: "hello there" });
  });

  it("authenticates with the bearer token", async () => {
    const sender = createSender({ baseUrl, token: "tok", to: "447949943542" });
    await sender.send({ text: "hello", idempotencyKey: "a1" });

    expect(received[0].headers.authorization).toBe("Bearer tok");
  });

  it("sends an idempotency key so a retry cannot double-send", async () => {
    const sender = createSender({ baseUrl, token: "tok", to: "447949943542" });
    await sender.send({ text: "hello", idempotencyKey: "3A83CAACF24A282D3458" });

    expect(received[0].headers["idempotency-key"]).toBe("3A83CAACF24A282D3458");
  });

  it("reports the error code when the recipient is not allowlisted", async () => {
    reply = { status: 403, body: { ok: false, error: "forbidden_recipient", detail: "not allowed" } };
    const sender = createSender({ baseUrl, token: "tok", to: "447700900999" });

    await expect(sender.send({ text: "hello", idempotencyKey: "a1" })).rejects.toThrow(
      "forbidden_recipient"
    );
  });

  it("reports a failure when the bridge itself errors", async () => {
    reply = { status: 500, body: { ok: false, error: "send_failed", detail: "boom" } };
    const sender = createSender({ baseUrl, token: "tok", to: "447949943542" });

    await expect(sender.send({ text: "hello", idempotencyKey: "a1" })).rejects.toThrow("send_failed");
  });
});
