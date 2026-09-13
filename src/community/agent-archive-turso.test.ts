import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { expect, it } from "vitest";
import {
  createTursoAgentActivityStore,
  initializeAgentArchiveDatabase,
  type AgentArchiveDatabase,
} from "./agent-archive-turso.js";

it("executes the Turso archive schema, atomic inserts, scoped paging, and clears against SQLite", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database: AgentArchiveDatabase = {
    exec: async (sql) => {
      sqlite.exec(sql);
    },
    all: async <T extends Record<string, unknown>>(
      sql: string,
      ...args: unknown[]
    ): Promise<T[]> =>
      sqlite.prepare(sql).all(...(args as SQLInputValue[])) as T[],
    batch: async (statements) => {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements)
          sqlite
            .prepare(statement.sql)
            .run(...((statement.args ?? []) as SQLInputValue[]));
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  try {
    await initializeAgentArchiveDatabase(database);
    await initializeAgentArchiveDatabase(database);
    const store = createTursoAgentActivityStore(() => database);
    const ownerKey = new Uint8Array(32).fill(71),
      agentKey = new Uint8Array(32).fill(72),
      relayKey = new Uint8Array(32).fill(73);
    const ownerPubkey = getPublicKey(ownerKey),
      agentPubkey = getPublicKey(agentKey),
      relayPubkey = getPublicKey(relayKey);
    const scope = {
      communityId: "test",
      relayUrls: ["wss://relay.example/"],
      ownerPubkey,
    };
    const credential = bytesToHex(
      schnorr.sign(
        sha256(new TextEncoder().encode(`nostr:agent-auth:${agentPubkey}:`)),
        ownerKey,
      ),
    );
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 100,
        tags: [["auth", ownerPubkey, "", credential]],
        content: '{"name":"Research"}',
      },
      agentKey,
    );
    const records = [100, 101, 102].map((created_at) => ({
      profile,
      receivedAt: created_at,
      event: finalizeEvent(
        {
          kind: 24200,
          created_at,
          tags: [
            ["p", ownerPubkey],
            ["agent", agentPubkey],
            ["frame", "telemetry"],
          ],
          content: "A".repeat(132),
        },
        agentKey,
      ),
    }));
    await store.append(scope, [...records, ...records]);
    const page = await store.page({ scope, agentPubkey, limit: 2 });
    expect(page.records.map((record) => record.event.created_at)).toEqual([
      102, 101,
    ]);
    expect(page.hasOlder).toBe(true);
    expect(
      (await store.page({ scope, agentPubkey, before: page.cursor! })).records,
    ).toHaveLength(1);
    expect(await store.agents({ ...scope, communityId: "other" })).toEqual([]);
    expect((await store.agents(scope))[0]?.name).toBe("Research");
    const context = { kind: "dm" as const };
    await store.commitSyncPage(scope, agentPubkey, context, [records[0]!], {
      streamId: "stream-1",
      offset: 4,
      updatedAt: 103,
    });
    await store.clear(scope, agentPubkey);
    expect((await store.page({ scope })).records).toEqual([]);
    expect(await store.agents(scope)).toEqual([]);
    expect(await store.checkpoint(scope, agentPubkey, context)).toEqual({
      streamId: "stream-1",
      offset: 4,
      updatedAt: 103,
    });
    await store.suppressBefore(scope, agentPubkey, 200);
    expect(await store.checkpoint(scope, agentPubkey, context)).toEqual({
      streamId: "stream-1",
      offset: 4,
      notBefore: 200,
      updatedAt: 200,
    });
    const managedProfile = finalizeEvent(
      {
        kind: 0,
        created_at: 201,
        tags: [["lapis-managed", ownerPubkey, relayPubkey]],
        content: '{"name":"Managed research"}',
      },
      agentKey,
    );
    const instance = finalizeEvent(
      {
        kind: 30177,
        created_at: 201,
        tags: [["d", agentPubkey]],
        content: '{"name":"Managed research"}',
      },
      ownerKey,
    );
    await store.append({ ...scope, relayPubkey }, [
      {
        event: finalizeEvent(
          {
            kind: 24200,
            created_at: 201,
            tags: [
              ["p", ownerPubkey],
              ["agent", agentPubkey],
              ["frame", "telemetry"],
            ],
            content: "B".repeat(132),
          },
          agentKey,
        ),
        profile: managedProfile,
        instance,
        receivedAt: 201,
      },
    ]);
    expect((await store.agents({ ...scope, relayPubkey }))[0]?.name).toBe(
      "Managed research",
    );
    sqlite
      .prepare(
        "UPDATE community_agent_activity_meta SET value='1' WHERE key='contract-version'",
      )
      .run();
    await initializeAgentArchiveDatabase(database);
    expect(
      (await store.page({ scope: { ...scope, relayPubkey } })).records,
    ).toEqual([]);
    expect(await store.checkpoint(scope, agentPubkey, context)).toBeUndefined();
    expect((await store.agents({ ...scope, relayPubkey }))[0]?.name).toBe(
      "Managed research",
    );
  } finally {
    sqlite.close();
  }
});
