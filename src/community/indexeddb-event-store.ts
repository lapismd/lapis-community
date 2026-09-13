import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type {
  CommunityCacheAudience,
  CommunityCachedScope,
  CommunityScope,
  CommunitySyncCheckpoint,
  CommunityVerifiedEventBatch,
} from "./contracts.js";
import {
  BaseCommunityEventStore,
  communityCacheAudienceKey,
  communityCacheScopeKey,
  communityEventBytes,
  type CommunityEventStoreOptions,
} from "./event-store.js";
import { isVerifiedNostrEvent, verifiedNostrEvent } from "./verified-events.js";
import type {
  CommunityAgentActivityCheckpoint,
  CommunityAgentActivityStore,
} from "./agent-contracts.js";
import {
  agentActivityCheckpointKey,
  agentActivityContextKey,
  agentArchiveIdentityRecord,
  agentArchiveIdentityVersion,
  agentArchiveLimit,
  agentArchiveRow,
  agentArchiveScopeKey,
  archivePage,
  archiveIdentity,
  type AgentArchiveRow,
  validateActivityCheckpoint,
} from "./agent-archive.js";

interface IndexedEventRow {
  key: string;
  scopeKey: string;
  partitionKey: string;
  eventId: string;
  event: CommunityVerifiedEventBatch["records"][number]["event"];
  relayUrl: string;
  roomId?: string;
  createdAt: number;
  lastAccessedAt: number;
  bytes: number;
}

interface IndexedCheckpointRow extends CommunitySyncCheckpoint {
  key: string;
  scopeKey: string;
}

interface CommunityCacheDb extends DBSchema {
  agentActivitySync: {
    key: string;
    value: {
      key: string;
      scopeKey: string;
      agentPubkey: string;
      contextKey: string;
      checkpoint: CommunityAgentActivityCheckpoint;
    };
    indexes: { scope: string };
  };
  agentActivity: {
    key: string;
    value: AgentArchiveRow;
    indexes: { scope: string; chronological: [string, string, number, string] };
  };
  agentIdentities: {
    key: string;
    value: {
      key: string;
      scopeKey: string;
      profile: AgentArchiveRow["record"]["profile"];
      instance?: NonNullable<AgentArchiveRow["record"]["instance"]>;
    };
    indexes: { scope: string };
  };
  events: {
    key: string;
    value: IndexedEventRow;
    indexes: {
      scope: string;
      partition: string;
      access: number;
    };
  };
  checkpoints: {
    key: string;
    value: IndexedCheckpointRow;
    indexes: { scope: string };
  };
}

export interface IndexedDbCommunityEventStoreOptions
  extends CommunityEventStoreOptions {
  databaseName?: string;
}

const DEFAULT_MAX_BYTES = 64 * 1_024 * 1_024;

export function createIndexedDbCommunityEventStore(
  options: IndexedDbCommunityEventStoreOptions = {},
) {
  return new IndexedDbCommunityEventStore(options);
}

class IndexedDbCommunityEventStore extends BaseCommunityEventStore {
  readonly agentActivity: CommunityAgentActivityStore = {
    append: async (scope, records) => {
      const rows = records.map((record) => agentArchiveRow(scope, record));
      const tx = this.#requireDatabase().transaction(
        ["agentActivity", "agentIdentities"],
        "readwrite",
      );
      for (const row of rows) {
        const activities = tx.objectStore("agentActivity");
        if ((await activities.getKey(row.key)) === undefined)
          await activities.put(row);
        const identities = tx.objectStore("agentIdentities");
        const key = JSON.stringify([row.scopeKey, row.agentPubkey]);
        const old = await identities.get(key);
        const identity = agentArchiveIdentityRecord(row.record);
        const next = agentArchiveIdentityVersion(identity);
        const previous = old ? agentArchiveIdentityVersion(old) : undefined;
        if (
          !old ||
          next.createdAt > previous!.createdAt ||
          (next.createdAt === previous!.createdAt &&
            next.eventId < previous!.eventId)
        )
          await identities.put({ key, scopeKey: row.scopeKey, ...identity });
      }
      await tx.done;
    },
    page: async (query) => {
      const scopeKey = agentArchiveScopeKey(query.scope);
      const tx = this.#requireDatabase().transaction(
        "agentActivity",
        "readonly",
      );
      const rows: AgentArchiveRow[] = [];
      // Agent history is indexed, so paging never restores the full journal.
      const agent = query.agentPubkey;
      if (agent) {
        const upper: [string, string, number, string] = [
          scopeKey,
          agent,
          query.before?.createdAt ?? Number.MAX_SAFE_INTEGER,
          query.before?.eventId ?? "~",
        ];
        const range = IDBKeyRange.bound(
          [scopeKey, agent, 0, ""],
          upper,
          false,
          query.before !== undefined,
        );
        let cursor = await tx.store
          .index("chronological")
          .openCursor(range, "prev");
        while (cursor && rows.length <= agentArchiveLimit(query)) {
          if (!query.channelId || cursor.value.channelId === query.channelId)
            rows.push(cursor.value);
          cursor = await cursor.continue();
        }
      } else {
        // The UI pages one selected agent; all-agent reads are bounded too.
        let cursor = await tx.store.index("scope").openCursor(scopeKey);
        while (cursor) {
          const row = cursor.value;
          if (
            (!query.channelId || row.channelId === query.channelId) &&
            (!query.before ||
              row.createdAt < query.before.createdAt ||
              (row.createdAt === query.before.createdAt &&
                row.eventId < query.before.eventId))
          )
            rows.push(row);
          rows.sort(
            (a, b) =>
              b.createdAt - a.createdAt || b.eventId.localeCompare(a.eventId),
          );
          if (rows.length > agentArchiveLimit(query) + 1) rows.pop();
          cursor = await cursor.continue();
        }
      }
      await tx.done;
      return archivePage(rows, query);
    },
    agents: async (scope) => {
      const rows = await this.#requireDatabase().getAllFromIndex(
        "agentIdentities",
        "scope",
        agentArchiveScopeKey(scope),
      );
      return rows.flatMap((row) => {
        const identity = archiveIdentity(
          row.profile,
          scope.ownerPubkey,
          scope.relayPubkey,
          row.instance,
        );
        return identity ? [identity] : [];
      });
    },
    clear: async (scope, agent) => {
      const key = agentArchiveScopeKey(scope);
      const tx = this.#requireDatabase().transaction(
        ["agentActivity", "agentIdentities"],
        "readwrite",
      );
      let cursor = await tx
        .objectStore("agentActivity")
        .index("scope")
        .openCursor(key);
      while (cursor) {
        if (!agent || cursor.value.agentPubkey === agent) await cursor.delete();
        cursor = await cursor.continue();
      }
      if (agent)
        await tx
          .objectStore("agentIdentities")
          .delete(JSON.stringify([key, agent]));
      else {
        const identities = tx.objectStore("agentIdentities");
        for (const id of await identities.index("scope").getAllKeys(key))
          await identities.delete(id);
      }
      await tx.done;
    },
    checkpoint: async (scope, agent, context) => {
      const database = this.#requireDatabase();
      const [exact, suppression] = await Promise.all([
        database.get(
          "agentActivitySync",
          agentActivityCheckpointKey(scope, agent, context),
        ),
        database.get(
          "agentActivitySync",
          agentActivityCheckpointKey(scope, agent, "*"),
        ),
      ]);
      if (!exact && !suppression) return;
      const checkpoint = { ...(exact ?? suppression!).checkpoint };
      if (suppression?.checkpoint.notBefore !== undefined)
        checkpoint.notBefore = Math.max(
          checkpoint.notBefore ?? 0,
          suppression.checkpoint.notBefore,
        );
      checkpoint.updatedAt = Math.max(
        checkpoint.updatedAt,
        suppression?.checkpoint.updatedAt ?? 0,
      );
      return checkpoint;
    },
    commitSyncPage: async (scope, agent, context, records, checkpoint) => {
      const rows = records.map((record) => agentArchiveRow(scope, record));
      if (rows.some((row) => row.agentPubkey !== agent))
        throw new Error("Activity page contains a different agent");
      const next = validateActivityCheckpoint(checkpoint);
      const tx = this.#requireDatabase().transaction(
        ["agentActivity", "agentIdentities", "agentActivitySync"],
        "readwrite",
      );
      for (const row of rows) {
        const activities = tx.objectStore("agentActivity");
        if ((await activities.getKey(row.key)) === undefined)
          await activities.put(row);
        const identities = tx.objectStore("agentIdentities");
        const identityKey = JSON.stringify([row.scopeKey, row.agentPubkey]);
        const old = await identities.get(identityKey);
        const identity = agentArchiveIdentityRecord(row.record);
        const next = agentArchiveIdentityVersion(identity);
        const previous = old ? agentArchiveIdentityVersion(old) : undefined;
        if (
          !old ||
          next.createdAt > previous!.createdAt ||
          (next.createdAt === previous!.createdAt &&
            next.eventId < previous!.eventId)
        )
          await identities.put({
            key: identityKey,
            scopeKey: row.scopeKey,
            ...identity,
          });
      }
      await tx.objectStore("agentActivitySync").put({
        key: agentActivityCheckpointKey(scope, agent, context),
        scopeKey: agentArchiveScopeKey(scope),
        agentPubkey: agent,
        contextKey: agentActivityContextKey(context),
        checkpoint: next,
      });
      await tx.done;
    },
    suppressBefore: async (scope, agent, timestamp) => {
      const database = this.#requireDatabase();
      const key = agentActivityCheckpointKey(scope, agent, "*");
      const existing = await database.get("agentActivitySync", key);
      await database.put("agentActivitySync", {
        key,
        scopeKey: agentArchiveScopeKey(scope),
        agentPubkey: agent,
        contextKey: "*",
        checkpoint: {
          ...(existing?.checkpoint.streamId
            ? { streamId: existing.checkpoint.streamId }
            : {}),
          offset: existing?.checkpoint.offset ?? 0,
          notBefore: Math.max(existing?.checkpoint.notBefore ?? 0, timestamp),
          updatedAt: timestamp,
        },
      });
    },
  };
  readonly mode = "indexeddb" as const;
  readonly #databaseName: string;
  readonly #maxBytes: number;
  #database: IDBPDatabase<CommunityCacheDb> | undefined;

  constructor(options: IndexedDbCommunityEventStoreOptions) {
    super();
    this.#databaseName =
      options.databaseName ?? "lapismd-community-event-cache-v1";
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  async open(): Promise<void> {
    if (this.#database !== undefined) return;
    this.#database = await openDB<CommunityCacheDb>(this.#databaseName, 3, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const events = database.createObjectStore("events", {
            keyPath: "key",
          });
          events.createIndex("scope", "scopeKey");
          events.createIndex("partition", "partitionKey");
          events.createIndex("access", "lastAccessedAt");
          const checkpoints = database.createObjectStore("checkpoints", {
            keyPath: "key",
          });
          checkpoints.createIndex("scope", "scopeKey");
        }
        if (oldVersion < 2) {
          const activity = database.createObjectStore("agentActivity", {
            keyPath: "key",
          });
          activity.createIndex("scope", "scopeKey");
          activity.createIndex("chronological", [
            "scopeKey",
            "agentPubkey",
            "createdAt",
            "eventId",
          ]);
          const identities = database.createObjectStore("agentIdentities", {
            keyPath: "key",
          });
          identities.createIndex("scope", "scopeKey");
        }
        if (oldVersion < 3) {
          const sync = database.createObjectStore("agentActivitySync", {
            keyPath: "key",
          });
          sync.createIndex("scope", "scopeKey");
        }
      },
      blocking: () => {
        this.#database?.close();
        this.#database = undefined;
      },
    });
  }

  async restore(
    scope: CommunityScope,
    audience: CommunityCacheAudience = { type: "public" },
  ): Promise<CommunityCachedScope> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const partitionKey = `${scopeKey}:${communityCacheAudienceKey(audience)}`;
    const [rows, checkpoints] = await Promise.all([
      database.getAllFromIndex("events", "partition", partitionKey),
      database.getAllFromIndex("checkpoints", "scope", scopeKey),
    ]);
    const validRows = rows
      .flatMap((row) => {
        const event = verifiedNostrEvent(row.event);
        return event === undefined ? [] : [{ ...row, event }];
      })
      .toSorted(
        (left, right) =>
          left.createdAt - right.createdAt ||
          left.eventId.localeCompare(right.eventId),
      );
    return {
      events: validRows.map((row) => row.event),
      checkpoints: checkpoints.map((checkpoint) => ({
        relayUrl: checkpoint.relayUrl,
        stream: checkpoint.stream,
        createdAt: checkpoint.createdAt,
        synchronizedAt: checkpoint.synchronizedAt,
        ...(checkpoint.cursorEventId === undefined
          ? {}
          : { cursorEventId: checkpoint.cursorEventId }),
        ...(checkpoint.complete === undefined
          ? {}
          : { complete: checkpoint.complete }),
      })),
      approximateBytes: validRows.reduce((total, row) => total + row.bytes, 0),
    };
  }

  async commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(batch.scope);
    const transaction = database.transaction(
      ["events", "checkpoints"],
      "readwrite",
    );
    for (const record of batch.records) {
      if (!isVerifiedNostrEvent(record.event)) continue;
      const audience = communityCacheAudienceKey(record.audience);
      const partitionKey = `${scopeKey}:${audience}`;
      const key = `${partitionKey}:${record.event.id}`;
      const current = await transaction.objectStore("events").get(key);
      await transaction.objectStore("events").put({
        key,
        scopeKey,
        partitionKey,
        eventId: record.event.id,
        event: record.event,
        relayUrl: record.relayUrl,
        ...(record.roomId === undefined ? {} : { roomId: record.roomId }),
        createdAt: record.event.created_at,
        lastAccessedAt: Math.max(
          record.lastAccessedAt ?? Date.now(),
          current?.lastAccessedAt ?? 0,
        ),
        bytes: communityEventBytes(record),
      });
    }
    for (const checkpoint of batch.checkpoints ?? []) {
      await transaction
        .objectStore("checkpoints")
        .put(checkpointRow(scopeKey, checkpoint));
    }
    await transaction.done;
    await this.prune();
  }

  async markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const transaction = database.transaction("checkpoints", "readwrite");
    for (const checkpoint of checkpoints) {
      await transaction.store.put(checkpointRow(scopeKey, checkpoint));
    }
    await transaction.done;
  }

  async prune(): Promise<void> {
    const database = this.#requireDatabase();
    const rows = await database.getAllFromIndex("events", "access");
    let total = rows.reduce((sum, row) => sum + row.bytes, 0);
    if (total <= this.#maxBytes) return;
    const transaction = database.transaction("events", "readwrite");
    for (const row of rows) {
      await transaction.store.delete(row.key);
      total -= row.bytes;
      if (total <= this.#maxBytes) break;
    }
    await transaction.done;
  }

  async clear(scope?: CommunityScope): Promise<void> {
    const database = this.#requireDatabase();
    if (scope === undefined) {
      const transaction = database.transaction(
        ["events", "checkpoints"],
        "readwrite",
      );
      await transaction.objectStore("events").clear();
      await transaction.objectStore("checkpoints").clear();
      await transaction.done;
      return;
    }
    const scopeKey = communityCacheScopeKey(scope);
    const transaction = database.transaction(
      ["events", "checkpoints"],
      "readwrite",
    );
    const eventKeys = await transaction
      .objectStore("events")
      .index("scope")
      .getAllKeys(scopeKey);
    const checkpointKeys = await transaction
      .objectStore("checkpoints")
      .index("scope")
      .getAllKeys(scopeKey);
    await Promise.all([
      ...eventKeys.map((key) => transaction.objectStore("events").delete(key)),
      ...checkpointKeys.map((key) =>
        transaction.objectStore("checkpoints").delete(key),
      ),
    ]);
    await transaction.done;
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = undefined;
  }

  #requireDatabase(): IDBPDatabase<CommunityCacheDb> {
    if (this.#database === undefined) {
      throw new Error("Community event store is not open");
    }
    return this.#database;
  }
}

function checkpointRow(
  scopeKey: string,
  checkpoint: CommunitySyncCheckpoint,
): IndexedCheckpointRow {
  return {
    ...checkpoint,
    relayUrl: normalizeRelayUrl(checkpoint.relayUrl),
    scopeKey,
    key: `${scopeKey}:${normalizeRelayUrl(checkpoint.relayUrl)}:${checkpoint.stream}`,
  };
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString();
}
