// ABOUTME: Loads and validates the YAML config file.
// ABOUTME: Supports env var override for the Deepgram API key.

import fs from "fs";
import yaml from "js-yaml";

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf-8");
  const doc = yaml.load(raw);

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY || doc.deepgram_api_key;
  if (!deepgramApiKey) {
    throw new Error(
      "Missing deepgram API key: set deepgram_api_key in config or DEEPGRAM_API_KEY env var"
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
