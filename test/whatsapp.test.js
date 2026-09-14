// ABOUTME: Tests for resolving a sender's number from a WhatsApp message ID.
// ABOUTME: Covers @c.us IDs, @lid IDs with and without a resolved contact, and other IDs.

import { describe, it, expect } from "vitest";
import { resolveSenderNumber } from "../src/whatsapp.js";

describe("resolveSenderNumber", () => {
  it("strips the @c.us suffix from a direct chat ID", () => {
    expect(resolveSenderNumber("447700900000@c.us", { number: "447700900000" }))
      .toBe("447700900000");
  });

  it("prefers the contact's number for a @lid ID", () => {
    expect(resolveSenderNumber("276909493588153@lid", { number: "447700900000" }))
      .toBe("447700900000");
  });

  it("falls back to the lid itself when the contact has no number", () => {
    expect(resolveSenderNumber("276909493588153@lid", { number: undefined }))
      .toBe("276909493588153");
  });

  it("falls back to the lid itself when the contact could not be resolved", () => {
    expect(resolveSenderNumber("276909493588153@lid", undefined))
      .toBe("276909493588153");
  });

  it("returns an unrecognised ID unchanged", () => {
    expect(resolveSenderNumber("120363406807122815@g.us", undefined))
      .toBe("120363406807122815@g.us");
  });
});
