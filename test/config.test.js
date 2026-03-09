// ABOUTME: Tests for YAML config loading and validation.
// ABOUTME: Covers whitelist parsing, defaults, env var requirements, and error cases.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("loadConfig", () => {
  let tmpDir;
  let configPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
    configPath = path.join(tmpDir, "config.yaml");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    delete process.env.DEEPGRAM_API_KEY;
  });

  it("loads a valid config file", () => {
    fs.writeFileSync(
      configPath,
      `output_dir: /data/transcriptions
whitelist:
  - name: Alice
    number: "447700900000"
`
    );

    process.env.DEEPGRAM_API_KEY = "test-key";
    const config = loadConfig(configPath);
    expect(config.deepgramApiKey).toBe("test-key");
    expect(config.outputDir).toBe("/data/transcriptions");
    expect(config.whitelist).toEqual([
      { name: "Alice", number: "447700900000" },
    ]);
  });

  it("throws if config file does not exist", () => {
    expect(() => loadConfig("/nonexistent/config.yaml")).toThrow();
  });

  it("throws if whitelist is empty", () => {
    process.env.DEEPGRAM_API_KEY = "test-key";
    fs.writeFileSync(
      configPath,
      `output_dir: /tmp
whitelist: []
`
    );
    expect(() => loadConfig(configPath)).toThrow("whitelist");
  });

  it("throws if DEEPGRAM_API_KEY env var is not set", () => {
    fs.writeFileSync(
      configPath,
      `output_dir: /tmp
whitelist:
  - name: Alice
    number: "447700900000"
`
    );
    expect(() => loadConfig(configPath)).toThrow("DEEPGRAM_API_KEY");
  });
});
