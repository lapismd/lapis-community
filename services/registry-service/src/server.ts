import { createServer } from "node:http";

import { Pool } from "pg";

import { handleRegistryRequest } from "./app.js";
import { PostgresAuthChallengeStore } from "./challenges.js";
import { loadRegistryServiceConfig } from "./config.js";
import { PostgresRegistryEventStore } from "./event-store.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");

const config = loadRegistryServiceConfig(process.env);
const pool = new Pool({ connectionString: databaseUrl });
const events = new PostgresRegistryEventStore(pool);
const challenges = new PostgresAuthChallengeStore(pool);
await events.migrate();

const port = Number(process.env.PORT ?? "8787");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 1_048_576) {
        outgoing.writeHead(413, { "content-type": "application/json" });
        outgoing.end(JSON.stringify({ error: { code: "body-too-large" } }));
        return;
      }
      chunks.push(bytes);
    }

    const requestUrl = new URL(
      incoming.url ?? "/",
      config.publicBaseUrl,
    ).toString();
    const method = incoming.method ?? "GET";
    const request = new Request(requestUrl, {
      method,
      headers: Object.entries(incoming.headers).flatMap(([name, value]) =>
        value === undefined
          ? []
          : Array.isArray(value)
            ? value.map((item) => [name, item] as [string, string])
            : [[name, value] as [string, string]],
      ),
      ...(method === "GET" || method === "HEAD"
        ? {}
        : { body: new Uint8Array(Buffer.concat(chunks)) }),
    });
    const response = await handleRegistryRequest(request, {
      config,
      events,
      challenges,
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end(
      JSON.stringify({
        error: { code: "internal", message: "Internal error" },
      }),
    );
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Registry service listening on port ${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
