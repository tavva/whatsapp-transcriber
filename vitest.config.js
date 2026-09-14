// ABOUTME: Default test run: unit tests only, no external services required.
// ABOUTME: Integration tests live in integration/ and need the real wacli store.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
  },
});
