// ABOUTME: Entry point that wires the wacli store, Deepgram, and note writing together.
// ABOUTME: Listens for webhook posts from wacli sync and catches up on anything missed.

import { DefaultDeepgramClient } from "@deepgram/sdk";
import { loadConfig } from "./config.js";
import { createTranscriber } from "./transcriber.js";
import { createStore } from "./store.js";
import { createFilter } from "./filter.js";
import { createProgress } from "./progress.js";
import { createSender } from "./bridge.js";
import { createNoteHandler } from "./handler.js";
import { createCatchUp } from "./catchup.js";
import { createServer } from "./server.js";

const CONFIG_PATH = process.env.CONFIG_PATH || "./config.yaml";
const STORE_DIR = process.env.STORE_DIR || "/whatsapp";
const PROGRESS_FILE = process.env.PROGRESS_FILE || "/data/progress.json";
const BRIDGE_URL = process.env.BRIDGE_URL || "http://whatsapp-bridge:8080";
const PORT = Number(process.env.PORT || 8080);
const TMP_DIR = process.env.TMP_DIR || "/tmp";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

const config = loadConfig(CONFIG_PATH);
const webhookSecret = required("WEBHOOK_SECRET");
const bridgeToken = required("BRIDGE_TOKEN");

const deepgram = new DefaultDeepgramClient({
  apiKey: `Token ${config.deepgramApiKey}`,
  headers: { Authorization: `Token ${config.deepgramApiKey}` },
});

const store = createStore({ storeDir: STORE_DIR });
const progress = createProgress(PROGRESS_FILE);

const handle = createNoteHandler({
  filter: createFilter(config),
  store,
  transcribe: createTranscriber(deepgram),
  sender: createSender({ baseUrl: BRIDGE_URL, token: bridgeToken, to: config.sendTo }),
  progress,
  outputDir: config.outputDir,
  tmpDir: TMP_DIR,
});

const server = createServer({
  secret: webhookSecret,
  onNote: async (payload) => {
    const note = await store.note(payload.Chat, payload.ID);
    if (!note) return;
    await handle(note);
  },
});

server.listen(PORT, () => {
  console.log(`Listening for wacli webhooks on port ${PORT}`);
});

const missed = await createCatchUp({ store, progress, handle }).run();
console.log(missed ? `Caught up on ${missed} missed voice note(s)` : "No missed voice notes");

function shutdown() {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
