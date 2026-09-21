#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { isMainModule } from "../shared/entrypoint.mjs";

const execFileAsync = promisify(execFile);

const RULES = [
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}\b/gu],
  ["GitHub token", /\bgh[opsu]_[A-Za-z0-9]{20,}\b/gu],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/gu],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/gu],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gu],
  ["credential-bearing URL", /https?:\/\/[^\s/:]+:[^\s/@]+@[^\s/]+/gu],
  ["macOS user home path", /\/Users\/[^/\s]+\//gu],
  ["Windows user home path", /[A-Za-z]:\\Users\\[^\\\s]+\\/gu],
];

const SENSITIVE_FILENAMES = [
  /(^|\/)\.env(?:\.|$)/u,
  /(^|\/)credentials\.env$/u,
  /(^|\/)kaiyun-video\.env$/u,
  /(^|\/)kaiyun-tools\.env$/u,
  /(^|\/)(?:id_rsa|id_ed25519)$/u,
  /\.(?:pem|p12|pfx)$/u,
];

export function scanContent(path, source) {
  const findings = [];
  for (const [label, pattern] of RULES) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      findings.push({ path, line: source.slice(0, match.index).split("\n").length, label });
    }
  }
  return findings;
}

export async function scanTrackedFiles({ cwd = process.cwd() } = {}) {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], { cwd, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 });
  const paths = stdout.toString("utf8").split("\0").filter(Boolean);
  const findings = [];
  for (const path of paths) {
    if (SENSITIVE_FILENAMES.some((pattern) => pattern.test(path)) && path !== ".env.example") {
      findings.push({ path, line: 1, label: "sensitive filename" });
    }
    const data = await readFile(resolve(cwd, path));
    if (data.includes(0)) continue;
    findings.push(...scanContent(path, data.toString("utf8")));
  }
  return findings;
}

if (isMainModule(import.meta.url)) {
  try {
    const findings = await scanTrackedFiles();
    if (findings.length) {
      for (const finding of findings) console.error(`${finding.path}:${finding.line}: ${finding.label}`);
      console.error(`Sensitive-data check failed with ${findings.length} finding(s).`);
      process.exitCode = 1;
    } else {
      console.log("No high-confidence secrets, credential files, or personal home paths found in tracked files.");
    }
  } catch (error) {
    console.error(`Sensitive-data check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
