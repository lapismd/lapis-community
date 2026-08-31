#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { importSignedV1, listUnexpectedPluginFiles } from "./lib/v1-import.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const source = argument("--source");
const output = argument("--output");
const checkOnly = process.argv.includes("--check");
if (source === undefined || (!checkOnly && output === undefined)) {
  throw new Error(
    "usage: import-v1 --source <generated/v1> (--check | --output <plan.json>)",
  );
}

const sourcePath = path.resolve(source);
const imported = await importSignedV1(sourcePath);
const unexpected = await listUnexpectedPluginFiles(
  sourcePath,
  new Set(imported.plan.records.map((record) => record.content.pluginId)),
);
if (unexpected.length > 0) {
  throw new Error(`unindexed plugin detail files: ${unexpected.join(", ")}`);
}
if (!imported.report.parity) {
  throw new Error(`V1 parity failed: ${imported.report.mismatches.join(", ")}`);
}

if (output !== undefined) {
  const outputPath = path.resolve(output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(imported, null, 2)}\n`, "utf8");
}

console.log(
  `Verified ${imported.report.verifiedSignatureCount} signed V1 files; ` +
    `${imported.report.pluginCount} plugins and ${imported.report.releaseCount} releases ` +
    `round-trip at ${imported.report.sourceSemanticRoot}.`,
);
