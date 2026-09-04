import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(packageDirectory, "dev/community"),
  plugins: [tailwindcss(), svelte()],
  resolve: { dedupe: ["svelte"] },
  optimizeDeps: {
    include: ["nostr-tools/filter", "nostr-tools/nip44"],
    exclude: [
      "@lapismd/design-core",
      "@lapismd/design-core/ai/chat",
      "@lapismd/design-core/ai/experimental",
      "@lapismd/design-core/shell",
      "@tursodatabase/database-wasm/vite",
      "@tursodatabase/database-wasm-common",
    ],
    esbuildOptions: { target: "esnext" },
  },
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
