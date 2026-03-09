// ABOUTME: Loads and validates the YAML config file.
// ABOUTME: Deepgram API key is read from the DEEPGRAM_API_KEY env var.

import fs from "fs";
import yaml from "js-yaml";

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf-8");
  const doc = yaml.load(raw);

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    throw new Error(
      "Missing DEEPGRAM_API_KEY environment variable"
    );
  }

  const whitelist = doc.whitelist || [];
  if (whitelist.length === 0) {
    throw new Error("Config whitelist must contain at least one contact");
  }

  return {
    deepgramApiKey,
    outputDir: doc.output_dir || "/data/transcriptions",
    whitelist,
  };
}
