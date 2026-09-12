import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, loadConfigFromFile } from "vite";
import { expect, it } from "vitest";

it("cold-starts the public Vite configuration with explicit hosts and no credential serving", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "community-public-vite-"),
  );
  const previous = process.env.LAPIS_COMMUNITY_DIR;
  process.env.LAPIS_COMMUNITY_DIR = directory;
  const configFile = fileURLToPath(
    new URL("../../vite.community.config.ts", import.meta.url),
  );
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await writeFile(
      path.join(directory, "public.env"),
      "VITE_COMMUNITY_PUBLIC_URL=https://local-community.lapis.md\nVITE_COMMUNITY_LIVE_RELAY_URL=wss://local-relay.lapis.md\nVITE_COMMUNITY_RELAY_AUTH_URL=https://local-relay.lapis.md\nVITE_COMMUNITY_KEYTR_RELAYS=wss://local-relay.lapis.md\nVITE_COMMUNITY_KEYTR_GATEWAYS=local-community.lapis.md=Local Community\n",
    );
    await writeFile(
      path.join(directory, "relay.env"),
      "PRIVATE_SENTINEL=must-never-be-served\n",
    );
    const loaded = await loadConfigFromFile(
      { command: "serve", mode: "development" },
      configFile,
    );
    expect(loaded?.config.server).toMatchObject({
      host: "0.0.0.0",
      port: 7036,
      strictPort: true,
      allowedHosts: ["local-community.lapis.md"],
      origin: "https://local-community.lapis.md",
      hmr: {
        protocol: "wss",
        host: "local-community.lapis.md",
        clientPort: 443,
      },
    });
    expect(JSON.stringify(loaded?.config.server?.fs)).not.toContain(directory);
    expect(JSON.stringify(loaded?.config.define)).not.toContain(
      "must-never-be-served",
    );
    server = await createServer({
      configFile,
      logLevel: "silent",
      server: { port: 0, open: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await server.listen();
    const address = server.httpServer!.address();
    if (address === null || typeof address === "string")
      throw new Error("Vite did not bind a port");
    const origin = `http://127.0.0.1:${address.port}`;
    const accepted = await fetch(origin, {
      headers: { host: "local-community.lapis.md" },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("cross-origin-opener-policy")).toBe(
      "same-origin",
    );
    expect(accepted.headers.get("cross-origin-embedder-policy")).toBe(
      "credentialless",
    );
    const rejectedHost = await new Promise<number | undefined>(
      (resolve, reject) => {
        http
          .get(
            origin,
            { headers: { Host: "unapproved.invalid" } },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          )
          .on("error", reject);
      },
    );
    expect(rejectedHost).toBe(403);
    const privateFile = await fetch(`${origin}/@fs${directory}/relay.env`, {
      headers: { host: "local-community.lapis.md" },
    });
    expect([403, 404]).toContain(privateFile.status);
    expect(await privateFile.text()).not.toContain("must-never-be-served");
  } finally {
    await server?.close();
    if (previous === undefined) delete process.env.LAPIS_COMMUNITY_DIR;
    else process.env.LAPIS_COMMUNITY_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
