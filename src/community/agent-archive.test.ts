import "fake-indexeddb/auto";
import { openDB } from "idb";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import type { CommunityAgentArchiveRecord } from "./agent-contracts.js";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";
import { agentArchiveRow } from "./agent-archive.js";

const ownerKey = new Uint8Array(32).fill(61);
const agentKey = new Uint8Array(32).fill(62);
const relayKey = new Uint8Array(32).fill(63);
const ownerPubkey = getPublicKey(ownerKey);
const agentPubkey = getPublicKey(agentKey);
const relayPubkey = getPublicKey(relayKey);
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
    content: '{"name":"Research"}',
    tags: [["auth", ownerPubkey, "", credential]],
  },
  agentKey,
);
const managedProfile = finalizeEvent(
  {
    kind: 0,
    created_at: 100,
    content: '{"name":"Managed research"}',
    tags: [["lapis-managed", ownerPubkey, relayPubkey]],
  },
  agentKey,
);
const managedInstance = finalizeEvent(
  {
    kind: 30177,
    created_at: 100,
    content: '{"name":"Managed research"}',
    tags: [["d", agentPubkey]],
  },
  ownerKey,
);
function record(time = 100): CommunityAgentArchiveRecord {
  return {
    profile,
    receivedAt: time,
    event: finalizeEvent(
      {
        kind: 24200,
        created_at: time,
        content: "A".repeat(132),
        tags: [
          ["p", ownerPubkey],
          ["agent", agentPubkey],
          ["frame", "telemetry"],
          ["h", "general"],
        ],
      },
      agentKey,
    ),
  };
}

function managedRecord(time = 100): CommunityAgentArchiveRecord {
  return {
    ...record(time),
    profile: managedProfile,
    instance: managedInstance,
  };
}

for (const backend of ["memory", "indexeddb"])
  describe(`agent archive ${backend}`, () => {
    const create = () =>
      backend === "memory"
        ? createMemoryCommunityEventStore({ maxBytes: 1 })
        : createIndexedDbCommunityEventStore({
            databaseName: `agents-${crypto.randomUUID()}`,
            maxBytes: 1,
          });
    it("deduplicates encrypted records and pages independently of message cache pruning", async () => {
      const store = create();
      await store.open();
      expect(store.agentActivity).toBeDefined();
      const archive = store.agentActivity!;
      await archive.append(scope, [
        record(100),
        record(100),
        record(101),
        record(102),
      ]);
      await store.prune();
      await store.clear();
      const first = await archive.page({ scope, limit: 2 });
      expect(first.records.map((row) => row.event.created_at)).toEqual([
        102, 101,
      ]);
      expect(first.hasOlder).toBe(true);
      expect(first.records[0]?.event.content).toBe("A".repeat(132));
      expect(
        (await archive.page({ scope, before: first.cursor! })).records,
      ).toHaveLength(1);
      expect((await archive.agents(scope))[0]?.name).toBe("Research");
      await store.close();
    });
    it("isolates owners, relay configurations, communities, channels, and explicit clears", async () => {
      const store = create();
      await store.open();
      const archive = store.agentActivity!;
      await archive.append(scope, [record()]);
      for (const foreign of [
        { ...scope, communityId: "other" },
        { ...scope, relayUrls: ["wss://other.example"] },
        { ...scope, ownerPubkey: getPublicKey(new Uint8Array(32).fill(64)) },
      ]) {
        expect((await archive.page({ scope: foreign })).records).toEqual([]);
        await archive.clear(foreign);
      }
      expect(
        (await archive.page({ scope, channelId: "other" })).records,
      ).toEqual([]);
      expect((await archive.page({ scope })).records).toHaveLength(1);
      await archive.clear(scope, agentPubkey);
      expect((await archive.page({ scope })).records).toEqual([]);
      expect(await archive.agents(scope)).toEqual([]);
      await store.close();
    });
    it("rejects a forged recipient and preserves all previously archived data", async () => {
      const store = create();
      await store.open();
      const archive = store.agentActivity!;
      await archive.append(scope, [record()]);
      const bad = record(101);
      bad.event = { ...bad.event, content: "tampered" };
      await expect(archive.append(scope, [bad])).rejects.toThrow(
        "Invalid encrypted",
      );
      expect((await archive.page({ scope })).records).toHaveLength(1);
      await store.close();
    });
    it("requires the current relay identity before archiving managed-agent telemetry", async () => {
      const store = create();
      await store.open();
      const archive = store.agentActivity!;
      await expect(archive.append(scope, [managedRecord()])).rejects.toThrow(
        "Invalid encrypted",
      );
      await archive.append({ ...scope, relayPubkey }, [managedRecord()]);
      expect(
        (await archive.page({ scope: { ...scope, relayPubkey } })).records,
      ).toHaveLength(1);
      expect((await archive.agents({ ...scope, relayPubkey }))[0]?.name).toBe(
        "Managed research",
      );
      const { instance: _instance, ...unlinked } = managedRecord(101);
      await expect(
        archive.append({ ...scope, relayPubkey }, [unlinked]),
      ).rejects.toThrow("Invalid encrypted");
      await expect(
        archive.append(
          {
            ...scope,
            relayPubkey: getPublicKey(new Uint8Array(32).fill(64)),
          },
          [managedRecord(101)],
        ),
      ).rejects.toThrow("Invalid encrypted");
      await store.close();
    });
    it("commits replay pages with per-context checkpoints and retains them when history is cleared", async () => {
      const store = create();
      await store.open();
      const archive = store.agentActivity!;
      const context = { kind: "channel" as const, channelId: "general" };
      await archive.commitSyncPage(scope, agentPubkey, context, [record(101)], {
        streamId: "stream-1",
        offset: 7,
        updatedAt: 101,
      });
      expect(await archive.checkpoint(scope, agentPubkey, context)).toEqual({
        streamId: "stream-1",
        offset: 7,
        updatedAt: 101,
      });
      await archive.clear(scope, agentPubkey);
      expect((await archive.page({ scope })).records).toEqual([]);
      expect(await archive.checkpoint(scope, agentPubkey, context)).toEqual({
        streamId: "stream-1",
        offset: 7,
        updatedAt: 101,
      });
      await archive.suppressBefore(scope, agentPubkey, 200);
      expect(await archive.checkpoint(scope, agentPubkey, context)).toEqual({
        streamId: "stream-1",
        offset: 7,
        notBefore: 200,
        updatedAt: 200,
      });
      await store.close();
    });
  });

it("migrates the v1 IndexedDB cache additively and keeps history after reopen", async () => {
  const databaseName = `agents-migrate-${crypto.randomUUID()}`;
  const old = await openDB(databaseName, 1, {
    upgrade(db) {
      const events = db.createObjectStore("events", { keyPath: "key" });
      events.createIndex("partition", "partitionKey");
      events.createIndex("scope", "scopeKey");
      events.createIndex("access", "lastAccessedAt");
      const checkpoints = db.createObjectStore("checkpoints", {
        keyPath: "key",
      });
      checkpoints.createIndex("scope", "scopeKey");
    },
  });
  old.close();
  const store = createIndexedDbCommunityEventStore({ databaseName });
  await store.open();
  await store.agentActivity!.append(scope, [record()]);
  await store.close();
  await store.open();
  expect((await store.agentActivity!.page({ scope })).records).toHaveLength(1);
  await store.close();
});

it("clears pre-v2 IndexedDB activity while preserving identities and ordinary events", async () => {
  const databaseName = `agents-contract-migrate-${crypto.randomUUID()}`;
  const row = agentArchiveRow(scope, record());
  const old = await openDB(databaseName, 3, {
    upgrade(db) {
      const events = db.createObjectStore("events", { keyPath: "key" });
      events.createIndex("partition", "partitionKey");
      events.createIndex("scope", "scopeKey");
      events.createIndex("access", "lastAccessedAt");
      const checkpoints = db.createObjectStore("checkpoints", {
        keyPath: "key",
      });
      checkpoints.createIndex("scope", "scopeKey");
      const activity = db.createObjectStore("agentActivity", {
        keyPath: "key",
      });
      activity.createIndex("scope", "scopeKey");
      activity.createIndex("chronological", [
        "scopeKey",
        "agentPubkey",
        "createdAt",
        "eventId",
      ]);
      const identities = db.createObjectStore("agentIdentities", {
        keyPath: "key",
      });
      identities.createIndex("scope", "scopeKey");
      const sync = db.createObjectStore("agentActivitySync", {
        keyPath: "key",
      });
      sync.createIndex("scope", "scopeKey");
    },
  });
  const tx = old.transaction(
    ["events", "agentActivity", "agentIdentities", "agentActivitySync"],
    "readwrite",
  );
  await tx.objectStore("events").put({
    key: "ordinary-event",
    scopeKey: "scope",
    partitionKey: "partition",
    eventId: "event",
    event: profile,
    relayUrl: "wss://relay.example/",
    createdAt: 100,
    lastAccessedAt: 100,
    bytes: 1,
  });
  await tx.objectStore("agentActivity").put(row);
  await tx.objectStore("agentIdentities").put({
    key: JSON.stringify([row.scopeKey, row.agentPubkey]),
    scopeKey: row.scopeKey,
    profile,
  });
  await tx.objectStore("agentActivitySync").put({
    key: "checkpoint",
    scopeKey: row.scopeKey,
    agentPubkey,
    contextKey: JSON.stringify({ kind: "dm" }),
    checkpoint: { streamId: "old", offset: 4, updatedAt: 100 },
  });
  await tx.done;
  old.close();

  const store = createIndexedDbCommunityEventStore({ databaseName });
  await store.open();
  expect((await store.agentActivity!.page({ scope })).records).toEqual([]);
  expect(
    await store.agentActivity!.checkpoint(scope, agentPubkey, { kind: "dm" }),
  ).toBeUndefined();
  expect((await store.agentActivity!.agents(scope))[0]?.name).toBe("Research");
  await store.close();
  const migrated = await openDB(databaseName);
  expect(migrated.version).toBe(6);
  expect(await migrated.count("events")).toBe(1);
  migrated.close();
});
