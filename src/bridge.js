// ABOUTME: Sends transcripts back to WhatsApp through the whatsapp-bridge service.
// ABOUTME: The bridge holds the session, so this only ever makes an authenticated HTTP call.

export function createSender({ baseUrl, token, to }) {
  return {
    async send({ text, idempotencyKey }) {
      const response = await fetch(`${baseUrl}/v1/send/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ to, message: text }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || `bridge responded ${response.status}`);
      }
      return result.id;
    },
  };
}
