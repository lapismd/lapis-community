#!/usr/bin/env node
import { spawn } from "node:child_process";
import { watchFile, unwatchFile } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { publicConfigurationPath } from "./community-public-config.mjs";

import {
  resolveCommunityDevLane,
  stopCommunityDevLane,
} from "./community-dev-process.mjs";
import {
  listenerPids,
  partitionCheckoutListeners,
  processCwd,
  processIsAlive,
  readStorybookOwner,
  releaseStorybookOwner,
  terminateProcessTrees,
  writeStorybookOwner,
} from "./storybook-process.mjs";

const lane = resolveCommunityDevLane();
const fixtureEnvironmentPath = path.join(
  lane.root,
  ".local",
  "registry-fixture",
  "fixture.env",
);
const configurationPaths = [fixtureEnvironmentPath, publicConfigurationPath()];

if (process.env.COMMUNITY_DEV_REPLACE === "1") {
  await stopCommunityDevLane(lane);
}

const existing = readStorybookOwner(lane);
if (
  existing?.supervisorPid &&
  processIsAlive(existing.supervisorPid) &&
  processCwd(existing.supervisorPid) === lane.root
) {
  console.log(
    `[community-dev] already running for ${lane.root} :${lane.port} as supervisor ${existing.supervisorPid}`,
  );
  process.exit(0);
}

const listeners = partitionCheckoutListeners(lane, listenerPids(lane.port));
if (listeners.foreign.length > 0) {
  const details = listeners.foreign
    .map(({ pid, cwd }) => `pid ${pid}${cwd ? ` (${cwd})` : " (unknown cwd)"}`)
    .join(", ");
  throw new Error(
    `Refusing to replace another checkout's listener on :${lane.port}: ${details}`,
  );
}
if (listeners.owned.length > 0) {
  await terminateProcessTrees(listeners.owned.map(({ pid }) => pid));
}
releaseStorybookOwner(lane, existing?.supervisorPid);

const owner = {
  version: 1,
  root: lane.root,
  port: lane.port,
  supervisorPid: process.pid,
  childPid: null,
  startedAt: Date.now(),
};
writeStorybookOwner(lane, owner, { exclusive: true });

const require = createRequire(import.meta.url);
const viteRoot = path.dirname(require.resolve("vite/package.json"));
const viteBin = path.join(viteRoot, "bin", "vite.js");
let child;
let stopping = false;
let restarting = false;
let restartTimer;

function startChild() {
  child = spawn(
    process.execPath,
    [
      viteBin,
      "--config",
      path.join(lane.root, "vite.community.config.ts"),
      ...process.argv.slice(2),
    ],
    { cwd: lane.root, env: process.env, stdio: "inherit" },
  );
  writeStorybookOwner(lane, { ...owner, childPid: child.pid });
  child.once("error", (error) => {
    console.error(`[community-dev] could not start Vite: ${error.message}`);
  });
  child.once("exit", (code, signal) => {
    if (stopping || restarting) return;
    stopping = true;
    for (const filename of configurationPaths)
      unwatchFile(filename, scheduleFixtureRestart);
    releaseStorybookOwner(lane, process.pid);
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

async function restartForFixture() {
  if (stopping || !child) return;
  restarting = true;
  const previous = child;
  child = undefined;
  await terminateProcessTrees([previous.pid]);
  if (stopping) return;
  console.log("[community-dev] fixture environment changed; restarting Vite");
  restarting = false;
  startChild();
}

function scheduleFixtureRestart(current, previous) {
  if (current.mtimeMs === previous.mtimeMs) return;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = undefined;
    void restartForFixture();
  }, 150);
}

async function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  for (const filename of configurationPaths)
    unwatchFile(filename, scheduleFixtureRestart);
  if (child) await terminateProcessTrees([child.pid]);
  releaseStorybookOwner(lane, process.pid);
  if (signal === "SIGINT") process.exitCode = 130;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void stop(signal));
}

for (const filename of configurationPaths)
  watchFile(filename, { interval: 500 }, scheduleFixtureRestart);
startChild();
console.log(
  `[community-dev] supervisor ${process.pid} owns ${lane.root} :${lane.port}`,
);

await new Promise((resolve) => {
  process.once("beforeExit", resolve);
});
