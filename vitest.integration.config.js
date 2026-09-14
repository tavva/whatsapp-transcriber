// ABOUTME: Integration test run against the real wacli store and real Deepgram.
// ABOUTME: Only meaningful on a host with the store mounted, so it is a separate command.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["integration/**/*.test.js"],
    testTimeout: 120000,
  },
});
