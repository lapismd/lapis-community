import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { resolveCommunityDevRelayConfiguration } from "./dev/community/config.js";
import { tursoBundleBuildPlugin } from "./scripts/vite-turso-bundle.js";
import { keytrDevelopmentRelay } from "./scripts/vite-keytr-relay.js";
import { readCommunityPublicConfiguration } from "./scripts/community-public-config.mjs";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const communityHost = "community.localhost";
const communityPort = 7036;
const publicEnvironment = readCommunityPublicConfiguration();
const publicUrl = publicEnvironment.VITE_COMMUNITY_PUBLIC_URL
  ? new URL(publicEnvironment.VITE_COMMUNITY_PUBLIC_URL)
  : undefined;
const fixtureEnvironmentPath = path.join(
  packageDirectory,
  ".local/registry-fixture/fixture.env",
);

function fixtureValue(name: string): string {
  const configured = publicEnvironment[`VITE_${name}`]?.trim();
  if (configured) return configured;
  if (!fs.existsSync(fixtureEnvironmentPath)) return "";
  const line = fs
    .readFileSync(fixtureEnvironmentPath, "utf8")
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() ?? "";
}

const { relayUrl, authUrl } =
  resolveCommunityDevRelayConfiguration(publicEnvironment);
const configuredKeytrRelays =
  publicEnvironment.VITE_COMMUNITY_KEYTR_RELAYS?.trim();
const keytrRelays =
  configuredKeytrRelays === "disabled"
    ? ""
    : configuredKeytrRelays ||
      (publicUrl
        ? relayUrl
        : `ws://${communityHost}:${communityPort}/keytr-relay`);
const keytrGateways =
  publicEnvironment.VITE_COMMUNITY_KEYTR_GATEWAYS?.trim() ||
  `${publicUrl?.hostname ?? communityHost}=Community development`;

export default defineConfig({
  root: path.join(packageDirectory, "dev/community"),
  plugins: [
    ...(publicUrl || configuredKeytrRelays
      ? []
      : [
          keytrDevelopmentRelay({
            storagePath: path.join(
              packageDirectory,
              ".local",
              "keytr",
              "events.json",
            ),
          }),
        ]),
    tursoBundleBuildPlugin(),
    tailwindcss(),
    svelte(),
  ],
  define: {
    "import.meta.env.VITE_COMMUNITY_LIVE_RELAY_URL": JSON.stringify(relayUrl),
    "import.meta.env.VITE_COMMUNITY_RELAY_AUTH_URL": JSON.stringify(
      authUrl ?? "",
    ),
    "import.meta.env.VITE_COMMUNITY_KEYTR_RELAYS": JSON.stringify(keytrRelays),
    "import.meta.env.VITE_COMMUNITY_KEYTR_GATEWAYS":
      JSON.stringify(keytrGateways),
    "import.meta.env.VITE_REGISTRY_CURATOR_PUBKEYS": JSON.stringify(
      fixtureValue("REGISTRY_CURATOR_PUBKEYS"),
    ),
    "import.meta.env.VITE_REGISTRY_PUBLISHER_PUBKEYS": JSON.stringify(
      fixtureValue("REGISTRY_PUBLISHER_PUBKEYS"),
    ),
    "import.meta.env.VITE_REGISTRY_AUTHORITY_EPOCH": JSON.stringify(
      fixtureValue("REGISTRY_AUTHORITY_EPOCH"),
    ),
  },
  resolve: { dedupe: ["svelte"] },
  optimizeDeps: {
    include: ["nostr-tools/filter", "nostr-tools/nip44"],
    exclude: [
      "@lapismd/design-core",
      "@lapismd/design-core/ai/chat",
      "@lapismd/design-core/ai/experimental",
      "@lapismd/design-core/shell",
      "@tursodatabase/database-wasm/bundle",
      "@tursodatabase/database-wasm-common",
    ],
    esbuildOptions: { target: "esnext" },
  },
  build: { target: "esnext" },
  worker: {
    format: "es",
    plugins: () => [tursoBundleBuildPlugin()],
  },
  server: {
    host: publicUrl ? "0.0.0.0" : communityHost,
    port: communityPort,
    strictPort: true,
    ...(publicUrl
      ? {
          allowedHosts: [publicUrl.hostname],
          origin: publicUrl.origin,
          hmr: { protocol: "wss", host: publicUrl.hostname, clientPort: 443 },
          open: publicUrl.href,
        }
      : {}),
    fs: { allow: [packageDirectory] },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
