# Transcriber on wacli — Design

## Why

The transcriber runs whatsapp-web.js, which drives a headless Chromium against
web.whatsapp.com and holds its own WhatsApp linked device — a second one,
separate from the wacli session that the `whatsapp-store` service on yeats
already maintains. That link logged itself out and nobody noticed for four
months; the last transcription written was 13 May 2026.

wacli is already linked, already syncs every message, resolves LIDs to phone
numbers at the source, and reports the real sender of a group message. Reading
from it removes the browser, the second device link, and the QR dance.

## Shape

```
wacli sync --follow --webhook
        │  POST message JSON
        ▼
transcriber HTTP endpoint  ──filter──▶  wacli --read-only media download
                                                    │  .ogg
                                                    ▼
                                              Deepgram
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                            markdown note                  bridge /v1/send/text
```

## Components

**whatsapp-store** gains webhook flags on its `wacli sync --follow` line in
`supervise.sh`:

```
--webhook http://whatsapp-transcriber:8080/hook
--webhook-secret <shared secret>
--webhook-allow-private
```

`--webhook-allow-private` is required because the target resolves to a private
docker network address.

**transcriber** becomes an HTTP service rather than a WhatsApp client:

- Joins `whatsapp-bridge-net` so wacli can reach it and it can reach the bridge.
- Mounts the store read-only: `/mnt/ssd/data/whatsapp:/whatsapp:ro`.
- Carries the wacli binary, pinned to the version the store runs (0.18.2,
  `wacli_0.18.2_linux_amd64.tar.gz`, verified against the release
  `checksums.txt`). yeats is x86_64.

## Data flow

1. wacli stores a message, then POSTs
   `{Chat, ID, SenderJID, Timestamp, FromMe, Text, ChatName}` to `/hook`.
2. Verify `X-Wacli-Signature: sha256=<hmac>` against the shared secret. Reject
   anything that fails.
3. The payload carries no media type, so read the message row back out of the
   store by `Chat` + `ID`. wacli only posts messages it has already stored, so
   the row is there. Voice notes have `MediaType: "audio"` and
   `MimeType: "audio/ogg; codecs=opus"`. Anything else is ignored.
4. Apply the filter (below). Log and drop anything that fails it.
5. Fetch the audio:
   `wacli --read-only --store /whatsapp media download --chat <Chat> --id <ID> --output <tmp>`.
   `--read-only` with an explicit `--output` takes no store lock, so this works
   while `sync --follow` holds the store.
6. Deepgram, as now, including the existing single retry.
7. Write the markdown note, as now.
8. POST the transcript to the bridge at `/v1/send/text` with a bearer token.

## Filter

`config.yaml` grows a `groups` list alongside the existing `whitelist`:

```yaml
whitelist:
  - name: Sophie
    number: "447535983823"

groups:
  - name: Nexa
    jid: "120363428390959185@g.us"
```

A voice note is transcribed if its `SenderJID` matches a whitelisted number, or
its `Chat` matches a listed group — in a listed group, everyone is transcribed.
Attribution always comes from `SenderJID`/`SenderName`, never the chat name, so
group notes are credited to whoever actually spoke. (The Nexa group currently
reports a `ChatName` of "Sophie Deen", which is reason enough not to trust it.)

wacli resolves known LIDs to phone JIDs before the webhook fires, so the
`lid:` field added to whitelist entries this morning is no longer needed.
Leave it parsed but undocumented until the group work has run for a while, then
remove it.

## Missed notes

Webhook delivery is explicitly best-effort — wacli logs failures and full-queue
drops as warnings and does not retry. So anything arriving while the transcriber
is down is lost, which is exactly the failure that went unnoticed for four
months.

On startup the transcriber reads the timestamp of the last note it processed
from a small state file, then runs
`wacli --read-only messages list --after <ts> --limit 500 --json`, keeps the
rows with `MediaType: "audio"` that pass the filter, and processes them oldest
first. The state file is updated after each note is written, so a crash
mid-batch resumes rather than repeats.

Dedupe on message ID as well as timestamp — a webhook and the catch-up scan can
both deliver the same note across a restart.

## Error handling

- **Bad signature** — 401, log, drop.
- **Message row missing** — log and drop; wacli posts after storing, so this
  means something is wrong rather than merely late.
- **Media download fails** — log; the note is left for the next catch-up scan
  rather than being lost.
- **Deepgram fails twice** — keep the existing behaviour: write the audio to
  `data/failed/` for manual processing.
- **Bridge send fails** — the markdown note is already written, so log and
  carry on. The transcript is not lost, only the WhatsApp copy.

## What goes away

`whatsapp-web.js`, puppeteer, Chromium, the `data/auth` volume,
`removeChromiumLockFiles`, `resolveSenderNumber`, `sendSelfMessage`, the QR
flow, and the second WhatsApp linked device.

## Testing

Unit: the filter (whitelisted contact, listed group, neither), webhook
signature verification, payload-to-job mapping, catch-up selection and dedupe.

Integration, against the real store and real APIs — no mocks: read a known
message row, download its media, and transcribe it. There is a real voice note
in the Nexa group from 14 September 13:55 (`3A83CAACF24A282D3458`, from Sophie)
to test against.

## Setup this needs on yeats

- A bearer token for the transcriber in `/mnt/ssd/data/whatsapp/bridge.yaml`,
  with Ben's own JID in that token's `allowed_recipients`.
- The shared webhook secret, in both the transcriber's environment and the
  `whatsapp-store` sync flags.
- `whatsapp-transcriber` attached to `whatsapp-bridge-net`.
