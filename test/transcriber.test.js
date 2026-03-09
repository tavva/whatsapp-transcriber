// ABOUTME: Tests for the Deepgram transcription wrapper.
// ABOUTME: Verifies transcript extraction and error handling using a mock SDK.

import { describe, it, expect, vi } from "vitest";
import { createTranscriber } from "../src/transcriber.js";

function makeMockDeepgram(response) {
  return {
    listen: {
      prerecorded: {
        transcribeFile: vi.fn().mockResolvedValue(response),
      },
    },
  };
}

describe("createTranscriber", () => {
  it("returns the transcript text from a successful response", async () => {
    const mockClient = makeMockDeepgram({
      result: {
        metadata: { duration: 5.2 },
        results: {
          channels: [
            { alternatives: [{ transcript: "Hello from the voice note" }] },
          ],
        },
      },
      error: null,
    });

    const transcribe = createTranscriber(mockClient);
    const result = await transcribe(Buffer.from("fake-audio"));

    expect(result.transcript).toBe("Hello from the voice note");
    expect(result.duration).toBe(5.2);
    expect(mockClient.listen.prerecorded.transcribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ model: "nova-3", smart_format: true })
    );
  });

  it("throws when Deepgram returns an error", async () => {
    const mockClient = makeMockDeepgram({
      result: null,
      error: { message: "Invalid audio" },
    });

    const transcribe = createTranscriber(mockClient);
    await expect(transcribe(Buffer.from("bad"))).rejects.toThrow(
      "Invalid audio"
    );
  });

  it("throws when response has no transcript", async () => {
    const mockClient = makeMockDeepgram({
      result: { results: { channels: [] } },
      error: null,
    });

    const transcribe = createTranscriber(mockClient);
    await expect(transcribe(Buffer.from("empty"))).rejects.toThrow();
  });
});
