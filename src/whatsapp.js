// ABOUTME: Connects to WhatsApp Web and listens for incoming voice notes.
// ABOUTME: Filters messages by whitelist and dispatches audio for transcription.

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

export function createWhatsAppClient({ authDir, onVoiceNote }) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

  client.on("disconnected", (reason) => {
    console.log("WhatsApp disconnected:", reason);
  });

  client.on("message", async (message) => {
    if (message.type !== "ptt") return;

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
