// ABOUTME: Tests for reading voice notes out of the wacli store.
// ABOUTME: Covers parsing wacli's JSON output and building its command arguments.

import { describe, it, expect } from "vitest";
import { parseNotes, listArgs, downloadArgs } from "../src/store.js";

// Shape taken from `wacli messages list --json`; values anonymised.
const audioRow = (id, timestamp) => ({
  ChatJID: "120363428390959185@g.us",
  ChatName: "Sophie Deen",
  MsgID: id,
  SenderJID: "447700900000@s.whatsapp.net",
  SenderName: "Alice",
  Timestamp: timestamp,
  FromMe: false,
  Text: "[Audio]",
  DisplayText: "Sent audio",
  MediaType: "audio",
  MimeType: "audio/ogg; codecs=opus",
  LocalPath: "",
});

const textRow = (id, timestamp) => ({
  ChatJID: "120363428390959185@g.us",
  MsgID: id,
  SenderJID: "447700900000@s.whatsapp.net",
  SenderName: "Alice",
  Timestamp: timestamp,
  FromMe: false,
  Text: "hello",
  MediaType: "",
  MimeType: "",
});

const output = (messages) => JSON.stringify({ success: true, data: { messages }, error: null });

describe("parseNotes", () => {
  it("keeps voice notes and discards everything else", () => {
    const notes = parseNotes(
      output([textRow("t1", "2026-09-14T14:00:00Z"), audioRow("a1", "2026-09-14T13:55:47Z")])
    );
    expect(notes.map((n) => n.id)).toEqual(["a1"]);
  });

  it("returns the fields needed to fetch and credit a note", () => {
    const [note] = parseNotes(output([audioRow("a1", "2026-09-14T13:55:47Z")]));
    expect(note).toEqual({
      chat: "120363428390959185@g.us",
      id: "a1",
      senderJid: "447700900000@s.whatsapp.net",
      senderName: "Alice",
      timestamp: "2026-09-14T13:55:47Z",
    });
  });

  it("returns notes oldest first, since wacli lists newest first", () => {
    const notes = parseNotes(
      output([
        audioRow("newer", "2026-09-14T13:55:47Z"),
        audioRow("older", "2026-09-14T13:53:32Z"),
      ])
    );
    expect(notes.map((n) => n.id)).toEqual(["older", "newer"]);
  });

  it("returns nothing when the store has no matching messages", () => {
    expect(parseNotes(output([]))).toEqual([]);
  });

  it("returns nothing when wacli reports no messages key at all", () => {
    expect(parseNotes(JSON.stringify({ success: true, data: {}, error: null }))).toEqual([]);
  });
});

describe("listArgs", () => {
  it("asks for messages after a watermark, read-only and as JSON", () => {
    expect(listArgs({ storeDir: "/whatsapp", after: "2026-09-14T13:00:00Z", limit: 500 })).toEqual([
      "--read-only",
      "--store",
      "/whatsapp",
      "--json",
      "messages",
      "list",
      "--after",
      "2026-09-14T13:00:00Z",
      "--limit",
      "500",
    ]);
  });

  it("omits the watermark on a first run when nothing has been processed", () => {
    expect(listArgs({ storeDir: "/whatsapp", after: null, limit: 50 })).not.toContain("--after");
  });
});

describe("downloadArgs", () => {
  it("downloads one message's media to an explicit path, taking no store lock", () => {
    expect(
      downloadArgs({
        storeDir: "/whatsapp",
        chat: "120363428390959185@g.us",
        id: "a1",
        output: "/tmp/a1.ogg",
      })
    ).toEqual([
      "--read-only",
      "--store",
      "/whatsapp",
      "media",
      "download",
      "--chat",
      "120363428390959185@g.us",
      "--id",
      "a1",
      "--output",
      "/tmp/a1.ogg",
    ]);
  });
});
