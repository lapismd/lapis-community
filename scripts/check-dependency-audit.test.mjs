import assert from "node:assert/strict";
import { test } from "vitest";
import { validateAudit } from "./check-dependency-audit.mjs";

const clean = () => ({
  advisories: {},
  muted: [],
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
  },
});
const reviewed = () => {
  const report = clean();
  report.metadata.vulnerabilities.low = 1;
  report.advisories.reviewed = {
    github_advisory_id: "GHSA-gcqx-w48m-w2h4",
    module_name: "deepmerge",
    severity: "low",
    patched_versions: "<0.0.0",
    findings: [
      { version: "4.3.1", paths: [".>@sveltejs/vite-plugin-svelte>deepmerge"] },
    ],
  };
  return report;
};
test("accepts clean reports and only the reviewed development finding", () => {
  validateAudit(clean(), clean());
  validateAudit(reviewed(), clean());
});
for (const [name, mutate] of Object.entries({
  "another advisory": (r) => {
    r.advisories.reviewed.github_advisory_id = "GHSA-other";
  },
  "production finding": (r, p) => Object.assign(p, reviewed()),
  "another path": (r) => {
    r.advisories.reviewed.findings[0].paths.push(".>runtime>deepmerge");
  },
  "available fix": (r) => {
    r.advisories.reviewed.patched_versions = ">=4.3.2";
  },
  "higher severity": (r) => {
    r.advisories.reviewed.severity = "high";
  },
  "another version": (r) => {
    r.advisories.reviewed.findings[0].version = "4.2.0";
  },
  "missing findings": (r) => {
    r.advisories.reviewed.findings = [];
  },
  "muted report": (r) => {
    r.muted.push("GHSA-other");
  },
  "truncated report": (r) => {
    delete r.metadata;
  },
  "hidden finding": (r) => {
    r.metadata.vulnerabilities.high = 1;
  },
}))
  test(`rejects ${name}`, () => {
    const full = reviewed(),
      production = clean();
    mutate(full, production);
    assert.throws(() => validateAudit(full, production));
  });
