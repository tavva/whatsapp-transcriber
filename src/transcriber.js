// ABOUTME: Wraps the Deepgram SDK to transcribe audio buffers.
// ABOUTME: Returns the transcript text or throws on failure.

export function createTranscriber(deepgramClient) {
  return async function transcribe(audioBuffer) {
    const { result, error } =
      await deepgramClient.listen.prerecorded.transcribeFile(audioBuffer, {
        model: "nova-3",
        smart_format: true,
        detect_language: true,
      });

    if (error) {
      throw new Error(error.message || "Deepgram transcription failed");
    }

    const channels = result?.results?.channels;
    if (!channels || channels.length === 0) {
      throw new Error("No transcription channels in Deepgram response");
    }

    return channels[0].alternatives[0].transcript;
  };
}
