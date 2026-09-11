import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer, normalizePath } from "vite";
import { expect, it } from "vitest";

it("serves the real Turso bundle through the Community development pipeline", async () => {
  const server = await createServer({
    configFile: fileURLToPath(
      new URL("../../vite.community.config.ts", import.meta.url),
    ),
    logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
  });
  try {
    const bundlePath = normalizePath(
      createRequire(import.meta.url).resolve(
        "@tursodatabase/database-wasm/bundle",
      ),
    );
    const result = await server
      .transformRequest(`/@fs${bundlePath}?v=cold-turso-regression`)
      .catch((error: unknown) => {
        // Vite attaches the entire embedded WASM to transform errors.
        throw new Error(error instanceof Error ? error.message : String(error));
      });
    // Boolean assertions keep failures from printing the 15 MB WASM payload.
    expect(result?.code.includes("data:application/wasm;base64,")).toBe(true);
    expect(
      result?.code.includes('new URL("data:application/wasm;base64,'),
    ).toBe(false);
    expect(result?.code.includes("export")).toBe(true);
  } finally {
    await server.close();
  }
}, 20_000);
