import assert from "node:assert/strict";
import test from "node:test";
import { scanContent, scanTrackedFiles } from "../scripts/check-sensitive.mjs";

test("sensitive-data scanner catches release-blocking credential formats without storing them", () => {
  const candidates = [
    ["OpenAI-style API key", "sk-" + "A".repeat(32)],
    ["GitHub token", "ghp_" + "B".repeat(36)],
    ["AWS access key", "AKIA" + "C".repeat(16)],
    ["private key", "-----BEGIN " + "PRIVATE KEY-----"],
    ["macOS user home path", "/Users/" + "release-user/private.txt"],
  ];
  for (const [label, value] of candidates) {
    assert.deepEqual(scanContent("fixture.txt", value).map((finding) => finding.label), [label]);
  }
  assert.deepEqual(scanContent("fixture.txt", "secret-test-key and [REDACTED] are safe fixtures"), []);
});

test("tracked release files contain no high-confidence sensitive data", async () => {
  assert.deepEqual(await scanTrackedFiles(), []);
});
