// ABOUTME: Reads voice notes and their audio out of the wacli store.
// ABOUTME: Every call is read-only, so it never contends with the sync daemon's write lock.

import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);

export function parseNotes(stdout) {
  const messages = JSON.parse(stdout).data?.messages ?? [];

  return messages
    .filter((m) => m.MediaType === "audio")
    .map((m) => ({
      chat: m.ChatJID,
      id: m.MsgID,
      senderJid: m.SenderJID,
      senderName: m.SenderName,
      timestamp: m.Timestamp,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function listArgs({ storeDir, after, limit }) {
  const args = ["--read-only", "--store", storeDir, "--json", "messages", "list"];
  if (after) args.push("--after", after);
  return args.concat(["--limit", String(limit)]);
}

export function downloadArgs({ storeDir, chat, id, output }) {
  return [
    "--read-only",
    "--store",
    storeDir,
    "media",
    "download",
    "--chat",
    chat,
    "--id",
    id,
    "--output",
    output,
  ];
}

export function createStore({ storeDir, binary = "wacli" }) {
  return {
    async notesSince(after, limit = 500) {
      const { stdout } = await run(binary, listArgs({ storeDir, after, limit }));
      return parseNotes(stdout);
    },

    async note(chat, id) {
      const { stdout } = await run(binary, listArgs({ storeDir, after: null, limit: 50 }).concat(["--chat", chat]));
      return parseNotes(stdout).find((n) => n.id === id) ?? null;
    },

    async downloadAudio({ chat, id, output }) {
      await run(binary, downloadArgs({ storeDir, chat, id, output }));
      return output;
    },
  };
}
