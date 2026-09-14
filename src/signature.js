// ABOUTME: Verifies the HMAC-SHA256 signature wacli sends with each webhook post.
// ABOUTME: Compares in constant time so a wrong signature leaks nothing by timing.

import crypto from "crypto";

export function verifySignature({ body, header, secret }) {
  if (typeof header !== "string" || !header.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  let received;
  try {
    received = Buffer.from(header.slice("sha256=".length), "hex");
  } catch {
    return false;
  }

  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}
