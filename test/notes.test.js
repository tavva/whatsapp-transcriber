// ABOUTME: Tests for markdown note writing from voice note transcriptions.
// ABOUTME: Covers file creation, content format, and directory auto-creation.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeNote } from "../src/notes.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("writeNote", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-notes-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("writes a markdown file with the correct content", () => {
    const filePath = writeNote({
      outputDir: tmpDir,
      senderName: "Alice",
      timestamp: new Date("2026-03-09T15:30:42Z"),
      duration: 83,
      transcript: "Hey, just wanted to check in about tomorrow.",
    });

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("# Voice Note — Alice");
    expect(content).toContain("**From:** Alice");
    expect(content).toContain("**Duration:** 1m 23s");
    expect(content).toContain("Hey, just wanted to check in about tomorrow.");
  });

  it("generates a filename from date, time, and sender", () => {
    const filePath = writeNote({
      outputDir: tmpDir,
      senderName: "Bob",
      timestamp: new Date("2026-03-09T08:05:00Z"),
      duration: 10,
      transcript: "Hello",
    });

    const filename = path.basename(filePath);
    expect(filename).toMatch(/^2026-03-09_\d{2}-\d{2}-\d{2}_Bob\.md$/);
  });

  it("creates the output directory if it does not exist", () => {
    const nested = path.join(tmpDir, "sub", "dir");
    const filePath = writeNote({
      outputDir: nested,
      senderName: "Alice",
      timestamp: new Date(),
      duration: 5,
      transcript: "Test",
    });

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("formats duration correctly for seconds only", () => {
    const filePath = writeNote({
      outputDir: tmpDir,
      senderName: "Alice",
      timestamp: new Date("2026-03-09T12:00:00Z"),
      duration: 45,
      transcript: "Short note",
    });

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("**Duration:** 0m 45s");
  });
});
