// ABOUTME: Remembers which voice notes have been transcribed and how far catch-up got.
// ABOUTME: Backed by a small JSON file so progress survives a restart.

import fs from "fs";
import path from "path";

const REMEMBERED_IDS = 200;

function read(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return {
      lastTimestamp: parsed.lastTimestamp ?? null,
      ids: Array.isArray(parsed.ids) ? parsed.ids : [],
    };
  } catch {
    return { lastTimestamp: null, ids: [] };
  }
}

export function createProgress(file) {
  const state = read(file);

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  };

  return {
    lastTimestamp: () => state.lastTimestamp,
    seen: (id) => state.ids.includes(id),
    record({ id, timestamp }) {
      state.ids.push(id);
      if (state.ids.length > REMEMBERED_IDS) {
        state.ids = state.ids.slice(-REMEMBERED_IDS);
      }
      if (!state.lastTimestamp || timestamp > state.lastTimestamp) {
        state.lastTimestamp = timestamp;
      }
      save();
    },
  };
}
