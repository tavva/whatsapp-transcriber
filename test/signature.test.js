// ABOUTME: Tests for verifying the HMAC signature wacli puts on webhook posts.
// ABOUTME: Covers valid signatures, tampering, and malformed or missing headers.

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifySignature } from "../src/signature.js";

const secret = "shared-secret";
const body = '{"Chat":"120363428390959185@g.us","ID":"3A83CAACF24A282D3458"}';
const sign = (payload, key = secret) =>
  "sha256=" + crypto.createHmac("sha256", key).update(payload).digest("hex");

describe("verifySignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifySignature({ body, header: sign(body), secret })).toBe(true);
  });

  it("rejects a body that has been altered in transit", () => {
    const tampered = body.replace("3A83", "0000");
    expect(verifySignature({ body: tampered, header: sign(body), secret })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifySignature({ body, header: sign(body, "wrong-secret"), secret })).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifySignature({ body, header: undefined, secret })).toBe(false);
  });

  it("rejects a header without the sha256= prefix", () => {
    const bare = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifySignature({ body, header: bare, secret })).toBe(false);
  });

  it("rejects a header that is not valid hex", () => {
    expect(verifySignature({ body, header: "sha256=nothex", secret })).toBe(false);
  });
});
