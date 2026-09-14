// ABOUTME: Tests for the startup scan that picks up notes missed while the service was down.
// ABOUTME: Webhook delivery is best-effort, so this is what stops notes going missing.

import { describe, it, expect, beforeEach } from "vitest";
import { createCatchUp } from "../src/catchup.js";

const note = (id, timestamp) => ({
  chat: "120363428390959185@g.us",
  id,
  senderJid: "447700900000@s.whatsapp.net",
  senderName: "Alice",
  timestamp,
});

describe("createCatchUp", () => {
  let asked;
  let handled;
  let available;
  let seenIds;

  const build = (handle) =>
    createCatchUp({
      store: {
        async notesSince(after) {
          asked.push(after);
          return available;
        },
      },
      progress: {
        lastTimestamp: () => "2026-09-14T13:00:00Z",
        seen: (id) => seenIds.includes(id),
      },
      handle: handle ?? (async (n) => handled.push(n.id)),
    });

  beforeEach(() => {
    asked = [];
    handled = [];
    seenIds = [];
    available = [note("older", "2026-09-14T13:53:32Z"), note("newer", "2026-09-14T13:55:47Z")];
  });

  it("asks the store for notes since the last one processed", async () => {
    await build().run();
    expect(asked).toEqual(["2026-09-14T13:00:00Z"]);
  });

  it("processes missed notes oldest first", async () => {
    await build().run();
    expect(handled).toEqual(["older", "newer"]);
  });

  it("skips notes already processed", async () => {
    seenIds = ["older"];
    await build().run();
    expect(handled).toEqual(["newer"]);
  });

  it("does nothing when there is nothing missed", async () => {
    available = [];
    await build().run();
    expect(handled).toEqual([]);
  });

  it("carries on when one note fails", async () => {
    const handle = async (n) => {
      if (n.id === "older") throw new Error("download failed");
      handled.push(n.id);
    };

    await build(handle).run();

    expect(handled).toEqual(["newer"]);
  });

  it("reports how many notes it picked up", async () => {
    expect(await build().run()).toBe(2);
  });
});
