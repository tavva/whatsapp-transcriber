// ABOUTME: Tests for remembering which voice notes have already been transcribed.
// ABOUTME: Covers the catch-up watermark, duplicate detection, and a missing or corrupt file.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createProgress } from "../src/progress.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("createProgress", () => {
  let tmpDir;
  let file;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-progress-"));
    file = path.join(tmpDir, "progress.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("starts with no watermark when the file does not exist", () => {
    expect(createProgress(file).lastTimestamp()).toBeNull();
  });

  it("reports a note as unseen before it is recorded", () => {
    expect(createProgress(file).seen("3A83CAACF24A282D3458")).toBe(false);
  });

  it("reports a note as seen once recorded", () => {
    const progress = createProgress(file);
    progress.record({ id: "3A83CAACF24A282D3458", timestamp: "2026-09-14T13:55:47Z" });
    expect(progress.seen("3A83CAACF24A282D3458")).toBe(true);
  });

  it("remembers what it recorded across restarts", () => {
    createProgress(file).record({ id: "3A83CAACF24A282D3458", timestamp: "2026-09-14T13:55:47Z" });

    const reopened = createProgress(file);
    expect(reopened.seen("3A83CAACF24A282D3458")).toBe(true);
    expect(reopened.lastTimestamp()).toBe("2026-09-14T13:55:47Z");
  });

  it("keeps the latest timestamp when notes arrive out of order", () => {
    const progress = createProgress(file);
    progress.record({ id: "b", timestamp: "2026-09-14T13:55:47Z" });
    progress.record({ id: "a", timestamp: "2026-09-14T09:00:00Z" });
    expect(progress.lastTimestamp()).toBe("2026-09-14T13:55:47Z");
  });

  it("forgets ids beyond the most recent few hundred", () => {
    const progress = createProgress(file);
    for (let i = 0; i < 250; i++) {
      progress.record({ id: `id-${i}`, timestamp: "2026-09-14T13:55:47Z" });
    }
    expect(progress.seen("id-249")).toBe(true);
    expect(progress.seen("id-0")).toBe(false);
  });

  it("starts clean when the file contains junk rather than crashing", () => {
    fs.writeFileSync(file, "not json at all");
    const progress = createProgress(file);
    expect(progress.lastTimestamp()).toBeNull();
    expect(progress.seen("anything")).toBe(false);
  });
});
