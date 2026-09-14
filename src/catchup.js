// ABOUTME: Picks up voice notes that arrived while the service was down.
// ABOUTME: Webhook delivery is best-effort and never retried, so this runs on every startup.

export function createCatchUp({ store, progress, handle }) {
  return {
    async run() {
      const notes = await store.notesSince(progress.lastTimestamp());
      const missed = notes.filter((note) => !progress.seen(note.id));

      for (const note of missed) {
        try {
          await handle(note);
        } catch (err) {
          console.error(`Catch-up failed for ${note.id}:`, err.message);
        }
      }

      return missed.length;
    },
  };
}
