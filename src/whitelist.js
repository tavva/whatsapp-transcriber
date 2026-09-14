// ABOUTME: Builds the sender whitelist from config entries.
// ABOUTME: Matches senders by phone number or WhatsApp LID and maps them to names.

const normalise = (value) => String(value).replace(/^\+/, "");

export function createWhitelist(entries) {
  const names = new Map();

  for (const entry of entries) {
    names.set(normalise(entry.number), entry.name);
    if (entry.lid) names.set(normalise(entry.lid), entry.name);
  }

  return {
    allows: (number) => names.has(normalise(number)),
    nameFor: (number) => names.get(normalise(number)),
  };
}
