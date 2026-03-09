// ABOUTME: Writes voice note transcriptions as markdown files.
// ABOUTME: Files are named by date, time, and sender for easy browsing.

import fs from "fs";
import path from "path";

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(date) {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${h}-${m}`;
}

function formatTimestamp(date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function writeNote({ outputDir, senderName, timestamp, duration, transcript }) {
  fs.mkdirSync(outputDir, { recursive: true });

  const dateStr = formatDate(timestamp);
  const timeStr = formatTime(timestamp);
  const filename = `${dateStr}_${timeStr}_${senderName}.md`;
  const filePath = path.join(outputDir, filename);

  const content = `# Voice Note — ${senderName}, ${timestamp.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} ${timeStr.replace("-", ":")}

**From:** ${senderName}
**Date:** ${formatTimestamp(timestamp)}
**Duration:** ${formatDuration(duration)}

---

${transcript}
`;

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}
