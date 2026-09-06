import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureEnvironmentPath = path.join(
  packageDirectory,
  ".local/registry-fixture/fixture.env",
);

function fixtureValue(name: string): string {
  const configured = process.env[`VITE_${name}`]?.trim();
  if (configured) return configured;
  if (!fs.existsSync(fixtureEnvironmentPath)) return "";
  const line = fs
    .readFileSync(fixtureEnvironmentPath, "utf8")
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() ?? "";
}

const relayUrl =
  process.env.VITE_COMMUNITY_LIVE_RELAY_URL?.trim() ||
  "ws://registry.localhost:8281";
const registryRelays = process.env.VITE_REGISTRY_RELAYS?.trim() || relayUrl;

export default defineConfig({
  root: path.join(packageDirectory, "dev/community"),
  plugins: [tailwindcss(), svelte()],
  define: {
    "import.meta.env.VITE_COMMUNITY_LIVE_RELAY_URL": JSON.stringify(relayUrl),
    "import.meta.env.VITE_REGISTRY_RELAYS": JSON.stringify(registryRelays),
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
  worker: { format: "es" },
  server: {
    host: "127.0.0.1",
    port: 7036,
    strictPort: true,
    fs: { allow: [packageDirectory] },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
