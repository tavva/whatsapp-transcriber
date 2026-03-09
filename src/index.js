// ABOUTME: Entry point that wires WhatsApp, Deepgram, and note writing together.
// ABOUTME: Listens for voice notes, transcribes them, saves markdown, and messages back.

import { createClient } from "@deepgram/sdk";
import { loadConfig } from "./config.js";
import { createTranscriber } from "./transcriber.js";
import { writeNote } from "./notes.js";
import { createWhatsAppClient, sendSelfMessage } from "./whatsapp.js";
import fs from "fs";
import path from "path";

const CONFIG_PATH = process.env.CONFIG_PATH || "./config.yaml";

const config = loadConfig(CONFIG_PATH);
const deepgram = createClient(config.deepgramApiKey);
const transcribe = createTranscriber(deepgram);

const whitelistedNumbers = new Set(config.whitelist.map((c) => c.number));
const numberToName = Object.fromEntries(
  config.whitelist.map((c) => [c.number, c.name])
);

const client = createWhatsAppClient({
  authDir: process.env.AUTH_DIR || "./.wwebjs_auth",
  onVoiceNote: async ({ message, contact, number }) => {
    if (!whitelistedNumbers.has(number)) return;

    const senderName = numberToName[number] || contact.pushname || "Unknown";
    console.log(`Voice note received from ${senderName} (${number})`);

    let audioBuffer;
    try {
      const media = await message.downloadMedia();
      audioBuffer = Buffer.from(media.data, "base64");

      let result;
      try {
        result = await transcribe(audioBuffer);
      } catch (err) {
        console.error("Transcription failed, retrying once:", err.message);
        result = await transcribe(audioBuffer);
      }

      const timestamp = new Date(message.timestamp * 1000);

      const filePath = writeNote({
        outputDir: config.outputDir,
        senderName,
        timestamp,
        duration: Math.round(result.duration || 0),
        transcript: result.transcript,
      });

      console.log(`Transcription saved to ${filePath}`);

      await sendSelfMessage(
        client,
        `📝 Voice note from ${senderName}:\n\n${result.transcript}`
      );

      console.log("Transcription sent to self in WhatsApp");
    } catch (err) {
      console.error(`Failed to process voice note from ${senderName}:`, err);

      if (audioBuffer) {
        const failedDir = path.join(config.outputDir, "..", "failed");
        fs.mkdirSync(failedDir, { recursive: true });
        try {
          const failedPath = path.join(
            failedDir,
            `${Date.now()}_${senderName}.ogg`
          );
          fs.writeFileSync(failedPath, audioBuffer);
          console.log(`Audio saved to ${failedPath} for manual processing`);
        } catch (saveErr) {
          console.error("Failed to save audio file:", saveErr.message);
        }
      }
    }
  },
});

client.initialize();
