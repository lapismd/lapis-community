import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { readCommunityPublicConfiguration } from "./community-public-config.mjs";

it("loads only approved public fields, preserving explicit test overrides", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "community-config-"));
  try {
    fs.writeFileSync(
      path.join(directory, "public.env"),
      "VITE_COMMUNITY_KEYTR_GATEWAYS='community.example=Local Community'\nVITE_COMMUNITY_LIVE_RELAY_URL='wss://relay.example'\nLAPIS_RELAY_SECRET=not-public\nVITE_UNAPPROVED_SECRET=not-public\n",
    );
    fs.writeFileSync(
      path.join(directory, "relay.env"),
      "VITE_REGISTRY_PUBLISHER_PUBKEYS=must-not-read",
    );
    expect(
      readCommunityPublicConfiguration({
        LAPIS_COMMUNITY_DIR: directory,
        VITE_COMMUNITY_LIVE_RELAY_URL: "ws://test.localhost",
      }),
    ).toEqual({
      VITE_COMMUNITY_KEYTR_GATEWAYS: "community.example=Local Community",
      VITE_COMMUNITY_LIVE_RELAY_URL: "ws://test.localhost",
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
