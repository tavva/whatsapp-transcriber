// ABOUTME: Tests for whitelist matching of senders by phone number and LID.
// ABOUTME: Covers name lookup, unknown senders, and "+" prefix normalisation.

import { describe, it, expect } from "vitest";
import { createWhitelist } from "../src/whitelist.js";

describe("createWhitelist", () => {
  it("allows a sender matched by number", () => {
    const whitelist = createWhitelist([{ name: "Alice", number: "447700900000" }]);
    expect(whitelist.allows("447700900000")).toBe(true);
    expect(whitelist.nameFor("447700900000")).toBe("Alice");
  });

  it("allows a sender matched by lid", () => {
    const whitelist = createWhitelist([
      { name: "Alice", number: "447700900000", lid: "276909493588153" },
    ]);
    expect(whitelist.allows("276909493588153")).toBe(true);
    expect(whitelist.nameFor("276909493588153")).toBe("Alice");
  });

  it("rejects a sender that is not listed", () => {
    const whitelist = createWhitelist([{ name: "Alice", number: "447700900000" }]);
    expect(whitelist.allows("447700900001")).toBe(false);
    expect(whitelist.nameFor("447700900001")).toBeUndefined();
  });

  it("ignores a leading + on both config and lookup", () => {
    const whitelist = createWhitelist([{ name: "Alice", number: "+447700900000" }]);
    expect(whitelist.allows("447700900000")).toBe(true);
    expect(whitelist.allows("+447700900000")).toBe(true);
  });

  it("keeps each contact's own name when several are listed", () => {
    const whitelist = createWhitelist([
      { name: "Alice", number: "447700900000" },
      { name: "Bob", number: "447700900001", lid: "123456789012345" },
    ]);
    expect(whitelist.nameFor("447700900000")).toBe("Alice");
    expect(whitelist.nameFor("447700900001")).toBe("Bob");
    expect(whitelist.nameFor("123456789012345")).toBe("Bob");
  });
});
