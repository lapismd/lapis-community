#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const vitest = path.join(
  path.dirname(require.resolve("vitest/package.json")),
  "vitest.mjs",
);

/** Fresh browser processes avoid long-lived full-suite transport disconnects. */
export function runStorybookSuite(run = spawnSync, log = console.log) {
  for (let shard = 1; shard <= 8; shard += 1) {
    log(`[storybook-tests] Running complete-suite group ${shard}/8`);
    const result = run(
      process.execPath,
      [
        vitest,
        "run",
        "--project",
        "storybook",
        `--shard=${shard}/8`,
        "--maxWorkers=1",
        "--reporter=verbose",
      ],
      { cwd: root, env: process.env, stdio: "inherit" },
    );
    if (result.error) log(`[storybook-tests] ${result.error.message}`);
    if (result.error || result.signal) return 1;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv.length > 2) {
    console.error("Use pnpm test:storybook for filtered tests or CLI options.");
    process.exitCode = 1;
  } else {
    process.exitCode = runStorybookSuite();
  }
}
