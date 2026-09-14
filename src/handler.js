// ABOUTME: Handles one voice note: fetch the audio, transcribe it, save it, send it on.
// ABOUTME: Shared by the live webhook and the catch-up scan, so both behave identically.

import fs from "fs";
import path from "path";
import { writeNote } from "./notes.js";

export function createNoteHandler({
  filter,
  store,
  transcribe,
  sender,
  progress,
  outputDir,
  tmpDir = "/tmp",
}) {
  async function transcribeWithRetry(audio) {
    try {
      return await transcribe(audio);
    } catch (err) {
      console.error("Transcription failed, retrying once:", err.message);
      return await transcribe(audio);
    }
  }

  function keepForManualProcessing(audio, senderName) {
    const failedDir = path.join(outputDir, "..", "failed");
    try {
      fs.mkdirSync(failedDir, { recursive: true });
      const failedPath = path.join(failedDir, `${Date.now()}_${senderName}.ogg`);
      fs.writeFileSync(failedPath, audio);
      console.log(`Audio saved to ${failedPath} for manual processing`);
    } catch (err) {
      console.error("Failed to save audio file:", err.message);
    }
  }

  return async function handle(note) {
    if (progress.seen(note.id)) return;

    const senderName = filter.nameFor(note);
    if (!senderName) {
      console.log(`Ignoring voice note from ${note.senderJid} in ${note.chat}`);
      return;
    }

    console.log(`Voice note from ${senderName} in ${note.chat}`);

    const audioPath = path.join(tmpDir, `${note.id}.ogg`);
    let audio;
    try {
      await store.downloadAudio({ chat: note.chat, id: note.id, output: audioPath });
      audio = fs.readFileSync(audioPath);
    } catch (err) {
      console.error(`Could not fetch audio for ${note.id}:`, err.message);
      return;
    } finally {
      fs.rmSync(audioPath, { force: true });
    }

    let result;
    try {
      result = await transcribeWithRetry(audio);
    } catch (err) {
      console.error(`Transcription failed for ${note.id}:`, err.message);
      keepForManualProcessing(audio, senderName);
      return;
    }

    const filePath = writeNote({
      outputDir,
      senderName,
      timestamp: new Date(note.timestamp),
      duration: Math.round(result.duration || 0),
      transcript: result.transcript,
    });
    console.log(`Transcription saved to ${filePath}`);

    progress.record({ id: note.id, timestamp: note.timestamp });

    try {
      await sender.send({
        text: `📝 Voice note from ${senderName}:\n\n${result.transcript}`,
        idempotencyKey: note.id,
      });
      console.log("Transcription sent to WhatsApp");
    } catch (err) {
      console.error(`Could not send transcript for ${note.id}:`, err.message);
    }
  };
}
