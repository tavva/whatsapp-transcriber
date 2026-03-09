// ABOUTME: Tests for YAML config loading and validation.
// ABOUTME: Covers whitelist parsing, defaults, env var overrides, and error cases.

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
      `deepgram_api_key: test-key
output_dir: /data/transcriptions
whitelist:
  - name: Alice
    number: "447700900000"
`
    );

    const config = loadConfig(configPath);
    expect(config.deepgramApiKey).toBe("test-key");
    expect(config.outputDir).toBe("/data/transcriptions");
    expect(config.whitelist).toEqual([
      { name: "Alice", number: "447700900000" },
    ]);
  });

  it("uses DEEPGRAM_API_KEY env var over config file value", () => {
    fs.writeFileSync(
      configPath,
      `deepgram_api_key: file-key
output_dir: /data/transcriptions
whitelist:
  - name: Alice
    number: "447700900000"
`
    );

    process.env.DEEPGRAM_API_KEY = "env-key";
    const config = loadConfig(configPath);
    expect(config.deepgramApiKey).toBe("env-key");
  });

  it("throws if config file does not exist", () => {
    expect(() => loadConfig("/nonexistent/config.yaml")).toThrow();
  });

  it("throws if whitelist is empty", () => {
    fs.writeFileSync(
      configPath,
      `deepgram_api_key: test-key
output_dir: /tmp
whitelist: []
`
    );
    expect(() => loadConfig(configPath)).toThrow("whitelist");
  });

  it("throws if deepgram_api_key is missing and env var not set", () => {
    fs.writeFileSync(
      configPath,
      `output_dir: /tmp
whitelist:
  - name: Alice
    number: "447700900000"
`
    );
    expect(() => loadConfig(configPath)).toThrow("deepgram");
  });
});
