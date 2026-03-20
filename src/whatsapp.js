// ABOUTME: Connects to WhatsApp Web and listens for incoming voice notes.
// ABOUTME: Filters messages by whitelist and dispatches audio for transcription.

import fs from "fs";
import path from "path";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

function removeChromiumLockFiles(authDir) {
  const sessionDir = path.join(authDir, "session");
  for (const lockFile of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    const filePath = path.join(sessionDir, lockFile);
    try {
      fs.unlinkSync(filePath);
      console.log(`Removed stale lock file: ${filePath}`);
    } catch (err) {
      if (err.code !== "ENOENT") console.warn(`Could not remove ${filePath}:`, err.message);
    }
  }
}

export function createWhatsAppClient({ authDir, onVoiceNote }) {
  removeChromiumLockFiles(authDir);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-features=LockProfileCookieDatabase",
      ],
    },
  });

  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("Scan this QR code with WhatsApp on your phone");
  });

  client.on("authenticated", () => {
    console.log("WhatsApp authenticated");
  });

  client.on("ready", () => {
    console.log(`WhatsApp client ready (logged in as ${client.info.pushname})`);
  });

  client.on("auth_failure", (message) => {
    console.error("WhatsApp auth failure:", message);
  });

  client.on("disconnected", (reason) => {
    console.log("WhatsApp disconnected:", reason);
  });

  client.on("message_create", async (message) => {
    console.log(`Message received: type=${message.type} from=${message.from} hasMedia=${message.hasMedia}`);
    if (message.type !== "ptt" && message.type !== "audio") return;

    const contact = await message.getContact();
    const number = message.from.replace("@c.us", "");

    await onVoiceNote({ message, contact, number });
  });

  return client;
}

export async function sendSelfMessage(client, text) {
  const myNumber = client.info.wid._serialized;
  await client.sendMessage(myNumber, text);
}
