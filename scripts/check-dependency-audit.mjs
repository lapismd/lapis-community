import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function findings(report) {
  assert(
    report &&
      !report.error &&
      typeof report.advisories === "object" &&
      report.advisories,
  );
  assert(!Array.isArray(report.advisories));
  assert(Array.isArray(report.muted) && report.muted.length === 0);
  const counts = report.metadata?.vulnerabilities;
  assert(
    counts &&
      ["info", "low", "moderate", "high", "critical"].every(
        (key) => Number.isInteger(counts[key]) && counts[key] >= 0,
      ),
  );
  const entries = Object.values(report.advisories);
  assert.equal(
    Object.values(counts).reduce((a, b) => a + b, 0),
    entries.length,
  );
  return entries;
}

export function validateAudit(full, production) {
  assert.equal(
    findings(production).length,
    0,
    "Production audit must be clean",
  );
  for (const advisory of findings(full)) {
    assert.equal(advisory.github_advisory_id, "GHSA-gcqx-w48m-w2h4");
    assert.equal(advisory.module_name, "deepmerge");
    assert.equal(advisory.severity, "low");
    assert.equal(
      advisory.patched_versions,
      "<0.0.0",
      "A fix ends this exception",
    );
    assert(Array.isArray(advisory.findings) && advisory.findings.length > 0);
    for (const finding of advisory.findings) {
      assert.equal(finding.version, "4.3.1");
      assert(Array.isArray(finding.paths) && finding.paths.length > 0);
      assert(
        finding.paths.every(
          (path) => path === ".>@sveltejs/vite-plugin-svelte>deepmerge",
        ),
        "Only the reviewed development tooling path is accepted",
      );
    }
  }
}

function audit(args) {
  const result = spawnSync("pnpm", ["audit", ...args, "--json"], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  assert([0, 1].includes(result.status), "Audit process failed");
  process.stdout.write(result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, findings(report).length ? 1 : 0);
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validateAudit(audit([]), audit(["--prod"]));
  console.log(
    "Audit passed with only the explicitly approved development exception, if present.",
  );
}
