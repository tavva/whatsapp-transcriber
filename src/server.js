// ABOUTME: HTTP endpoint that wacli posts live message events to.
// ABOUTME: Verifies each post's signature, then hands the note off without blocking the reply.

import http from "http";
import { verifySignature } from "./signature.js";

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

export function createServer({ secret, onNote }) {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") return json(res, 200, { ok: true });
    if (req.url !== "/hook") return json(res, 404, { ok: false });

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (!verifySignature({ body, header: req.headers["x-wacli-signature"], secret })) {
        return json(res, 401, { ok: false });
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return json(res, 400, { ok: false });
      }

      json(res, 202, { ok: true });

      Promise.resolve()
        .then(() => onNote(payload))
        .catch((err) => console.error("Failed to handle note:", err.message));
    });
  });
}
