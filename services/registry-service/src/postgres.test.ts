import { generateSecretKey, finalizeEvent } from "nostr-tools/pure";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import type { NostrEvent } from "@lapismd/registry-protocol";

import { newChallenge, PostgresAuthChallengeStore } from "./challenges.js";
import { PostgresRegistryEventStore } from "./event-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(databaseUrl === undefined);

integration("Postgres registry persistence", () => {
  let pool: Pool;
  let events: PostgresRegistryEventStore;
  let challenges: PostgresAuthChallengeStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      "DROP TABLE IF EXISTS registry_auth_challenges; DROP TABLE IF EXISTS registry_events;",
    );
    events = new PostgresRegistryEventStore(pool);
    challenges = new PostgresAuthChallengeStore(pool);
    await events.migrate();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists event envelopes and consumes challenges atomically", async () => {
    const event: NostrEvent = finalizeEvent(
      { kind: 1, created_at: 1_800_000_000, tags: [], content: "postgres" },
      generateSecretKey(),
    );
    await expect(
      events.put({
        event,
        source: "api",
        receivedAt: "2026-08-31T16:00:00.000Z",
      }),
    ).resolves.toBe(true);
    await expect(
      events.put({
        event,
        source: "api",
        receivedAt: "2026-08-31T16:00:00.000Z",
      }),
    ).resolves.toBe(false);
    await expect(events.get(event.id)).resolves.toMatchObject({ event });
    await expect(events.list()).resolves.toHaveLength(1);

    const now = new Date("2026-08-31T16:00:00.000Z");
    const challenge = newChallenge("https://registry.test/events", "POST", now);
    await challenges.create(challenge);
    await expect(
      challenges.consume(
        challenge.token,
        challenge.actionUrl,
        challenge.method,
        now.toISOString(),
      ),
    ).resolves.toBe(true);
    await expect(
      challenges.consume(
        challenge.token,
        challenge.actionUrl,
        challenge.method,
        now.toISOString(),
      ),
    ).resolves.toBe(false);
  });
});
