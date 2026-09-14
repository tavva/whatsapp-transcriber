// ABOUTME: Decides which voice notes to transcribe and who to credit them to.
// ABOUTME: Accepts whitelisted contacts anywhere, and anyone posting in a listed group.

const normalise = (value) => String(value).replace(/^\+/, "");
const numberFrom = (jid) => normalise(jid).replace(/@.*$/, "");

export function createFilter({ whitelist = [], groups = [] }) {
  const names = new Map(whitelist.map((c) => [normalise(c.number), c.name]));
  const listedGroups = new Set(groups.map((g) => g.jid));

  return {
    nameFor({ chat, senderJid, senderName }) {
      const configured = names.get(numberFrom(senderJid));
      if (configured) return configured;
      if (listedGroups.has(chat)) return senderName || "Unknown";
      return null;
    },
  };
}
