#!/usr/bin/env node
/**
 * Collects the output of every security step into a single report.
 *
 * Reads security-report/<step>.log plus security-report/<step>.status
 * (the step's exit code), builds a findings list, writes
 * security-report/report.json + report.md for the CI artifact, optionally
 * posts the run to the app's scan-history endpoint, and exits non-zero when
 * any step failed so the PR is blocked.
 */
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), "security-report");
const logs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".log")).sort() : [];

const findings = [];
const chunks = [];

for (const file of logs) {
  const step = file.replace(/\.log$/, "");
  const output = readFileSync(path.join(dir, file), "utf8");
  const statusFile = path.join(dir, `${step}.status`);
  const code = existsSync(statusFile) ? Number(readFileSync(statusFile, "utf8").trim() || "0") : 0;

  chunks.push(`===== ${step} (exit ${code}) =====\n${output.trim()}\n`);

  if (code !== 0) {
    const detail = output.trim().split("\n").slice(-60).join("\n");
    findings.push({
      id: `step:${step}`,
      title: `${step} failed (exit ${code})`,
      level: step === "dependency-audit" ? "warning" : "critical",
      detail,
      source: step,
    });
  }
}

const status = findings.length > 0 ? "failed" : "passed";
const payload = {
  source: "github-actions",
  trigger: process.env.SCAN_TRIGGER || process.env.GITHUB_EVENT_NAME || "push",
  branch: process.env.GITHUB_REF_NAME || null,
  commit_sha: process.env.GITHUB_SHA || null,
  run_url:
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
  status,
  duration_ms: Number(process.env.SCAN_DURATION_MS || 0) || undefined,
  findings,
  logs: chunks.join("\n").slice(0, 190_000),
};

writeFileSync(path.join(dir, "report.json"), JSON.stringify(payload, null, 2));
writeFileSync(
  path.join(dir, "report.md"),
  [
    `# Security scan — ${status.toUpperCase()}`,
    ``,
    `- Branch: ${payload.branch ?? "n/a"}`,
    `- Commit: ${payload.commit_sha ?? "n/a"}`,
    `- Trigger: ${payload.trigger}`,
    ``,
    findings.length === 0
      ? "No findings. All security invariants hold."
      : findings.map((f) => `## [${f.level}] ${f.title}\n\n\`\`\`\n${f.detail}\n\`\`\``).join("\n\n"),
  ].join("\n"),
);

const endpoint = process.env.SCAN_INGEST_URL;
const secret = process.env.SECURITY_SCAN_INGEST_SECRET;
if (endpoint && secret) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scan-signature": signature },
      body,
    });
    console.log(`scan history ingest: ${res.status}`);
  } catch (e) {
    console.log(`scan history ingest failed: ${e.message}`);
  }
} else {
  console.log("scan history ingest skipped (no SCAN_INGEST_URL / secret)");
}

console.log(`security scan ${status} with ${findings.length} finding(s)`);
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `status=${status}\nfindings=${findings.length}\n`, { flag: "a" });
}
process.exit(status === "failed" ? 1 : 0);
