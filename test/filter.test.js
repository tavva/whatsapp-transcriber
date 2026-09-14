// ABOUTME: Tests for deciding which voice notes to transcribe and who to credit.
// ABOUTME: Covers whitelisted contacts, listed groups, and everyone else.

import { describe, it, expect } from "vitest";
import { createFilter } from "../src/filter.js";

const config = {
  whitelist: [
    { name: "Sophie", number: "447535983823" },
    { name: "Me", number: "447949943542" },
  ],
  groups: [{ name: "Nexa", jid: "120363428390959185@g.us" }],
};

describe("createFilter", () => {
  it("credits a whitelisted contact in a direct chat by their configured name", () => {
    const filter = createFilter(config);
    expect(
      filter.nameFor({
        chat: "447535983823@s.whatsapp.net",
        senderJid: "447535983823@s.whatsapp.net",
        senderName: "Sophie Deen",
      })
    ).toBe("Sophie");
  });

  it("ignores a voice note from someone not listed", () => {
    const filter = createFilter(config);
    expect(
      filter.nameFor({
        chat: "447700900999@s.whatsapp.net",
        senderJid: "447700900999@s.whatsapp.net",
        senderName: "Stranger",
      })
    ).toBeNull();
  });

  it("accepts anyone posting in a listed group", () => {
    const filter = createFilter(config);
    expect(
      filter.nameFor({
        chat: "120363428390959185@g.us",
        senderJid: "447700900999@s.whatsapp.net",
        senderName: "Someone Else",
      })
    ).toBe("Someone Else");
  });

  it("prefers the configured name for a whitelisted contact posting in a listed group", () => {
    const filter = createFilter(config);
    expect(
      filter.nameFor({
        chat: "120363428390959185@g.us",
        senderJid: "447535983823@s.whatsapp.net",
        senderName: "Sophie Deen",
      })
    ).toBe("Sophie");
  });

  it("ignores a group that is not listed", () => {
    const filter = createFilter(config);
    expect(
      filter.nameFor({
        chat: "120363406807122815@g.us",
        senderJid: "447700900999@s.whatsapp.net",
        senderName: "Someone Else",
      })
    ).toBeNull();
  });

  it("falls back to Unknown for a group sender with no push name", () => {
    const filter = createFilter(config);
    expect(
      filter.nameFor({
        chat: "120363428390959185@g.us",
        senderJid: "447700900999@s.whatsapp.net",
        senderName: "",
      })
    ).toBe("Unknown");
  });

  it("ignores a leading + on a configured number", () => {
    const filter = createFilter({ whitelist: [{ name: "Sophie", number: "+447535983823" }], groups: [] });
    expect(
      filter.nameFor({
        chat: "447535983823@s.whatsapp.net",
        senderJid: "447535983823@s.whatsapp.net",
        senderName: "Sophie Deen",
      })
    ).toBe("Sophie");
  });

  it("works when no groups are configured at all", () => {
    const filter = createFilter({ whitelist: [{ name: "Sophie", number: "447535983823" }] });
    expect(
      filter.nameFor({
        chat: "120363428390959185@g.us",
        senderJid: "447700900999@s.whatsapp.net",
        senderName: "Someone Else",
      })
    ).toBeNull();
  });
});
