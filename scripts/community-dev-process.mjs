#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveStorybookLane,
  stopStorybookLane,
} from "./storybook-process.mjs";

export const DEFAULT_COMMUNITY_DEV_PORT = "7036";

export function resolveCommunityDevLane({
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
} = {}) {
  const lane = resolveStorybookLane({
    root,
    env: {
      ...env,
      STORYBOOK_PORT: env.COMMUNITY_DEV_PORT ?? DEFAULT_COMMUNITY_DEV_PORT,
    },
  });
  return {
    ...lane,
    ownerPath: path.join(
      lane.root,
      ".cache",
      "community-dev",
      `${lane.port}.json`,
    ),
  };
}

export async function stopCommunityDevLane(lane = resolveCommunityDevLane()) {
  await stopStorybookLane(lane);
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === "stop"
) {
  await stopCommunityDevLane();
}
