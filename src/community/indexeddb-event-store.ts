import {
  COMMUNITY_CACHE_METADATA_KINDS,
  cachedEventPage,
  cachePageLimit,
} from "./history-pages.js";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type {
  CommunityCacheAudience,
  CommunityCachedHistoryPage,
  CommunityHistoryPage,
  CommunityCachedEventQuery,
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
  referencedEventIds,
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
  references: string[];
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
  cacheUsage: {
    key: string;
    value: { key: string; bytes: number };
  };
  historyPages: {
    key: string;
    value: {
      key: string;
      scopeKey: string;
      page: CommunityHistoryPage;
      bytes: number;
      lastAccessedAt: number;
      eventKeys: string[];
    };
    indexes: { scope: string; access: number; eventKeys: string };
  };
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
      references: string;
      chronological: [string, number, number, string];
      roomChronological: [string, string, number, number, string];
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
  #opening: Promise<void> | undefined;

  constructor(options: IndexedDbCommunityEventStoreOptions) {
    super();
    this.#databaseName =
      options.databaseName ?? "lapismd-community-event-cache-v1";
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  open(): Promise<void> {
    if (this.#opening) return this.#opening;
    if (this.#database !== undefined) return Promise.resolve();
    this.#opening = this.#initialize().finally(() => {
      this.#opening = undefined;
    });
    return this.#opening;
  }

  async #initialize(): Promise<void> {
    this.#database = await openDB<CommunityCacheDb>(this.#databaseName, 7, {
      upgrade(database, oldVersion, _newVersion, transaction) {
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
        if (oldVersion < 5) {
          database
            .createObjectStore("historyPages", { keyPath: "key" })
            .createIndex("scope", "scopeKey");
          const events = transaction.objectStore("events");
          events.createIndex("chronological", [
            "partitionKey",
            "event.kind",
            "createdAt",
            "eventId",
          ]);
          events.createIndex("roomChronological", [
            "partitionKey",
            "roomId",
            "event.kind",
            "createdAt",
            "eventId",
          ]);
        }
        if (oldVersion < 7) {
          const events = transaction.objectStore("events");
          events.createIndex("references", "references", { multiEntry: true });
          void (async () => {
            let cursor = await events.openCursor();
            while (cursor) {
              const row = cursor.value;
              const roomId =
                row.roomId ?? row.event.tags.find((tag) => tag[0] === "h")?.[1];
              await cursor.update({
                ...row,
                ...(roomId ? { roomId } : {}),
                references: referencedEventIds(row.event).map(
                  (id) => `${row.partitionKey}:${id}`,
                ),
              });
              cursor = await cursor.continue();
            }
          })().catch(() => transaction.abort());
        }
        if (oldVersion < 6) {
          const usage = database.createObjectStore("cacheUsage", {
            keyPath: "key",
          });
          const pages = transaction.objectStore("historyPages");
          pages.createIndex("access", "lastAccessedAt");
          pages.createIndex("eventKeys", "eventKeys", { multiEntry: true });
          void (async () => {
            const totals = new Map<string, number>();
            let eventCursor = await transaction
              .objectStore("events")
              .openCursor();
            while (eventCursor) {
              const row = eventCursor.value;
              addByteDelta(totals, "total", row.bytes);
              addByteDelta(totals, `partition:${row.partitionKey}`, row.bytes);
              eventCursor = await eventCursor.continue();
            }
            let pageCursor = await pages.openCursor();
            while (pageCursor) {
              const row = pageCursor.value;
              const partition = `${row.scopeKey}:${communityCacheAudienceKey(row.page.audience)}`;
              await pageCursor.update({
                ...row,
                lastAccessedAt: row.page.synchronizedAt * 1000,
                eventKeys: row.page.eventIds.map((id) => `${partition}:${id}`),
              });
              addByteDelta(totals, "total", row.bytes);
              pageCursor = await pageCursor.continue();
            }
            for (const [key, bytes] of totals) await usage.put({ key, bytes });
          })().catch(() => transaction.abort());
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
        if (oldVersion > 0 && oldVersion < 4) {
          transaction.objectStore("agentActivity").clear();
          transaction.objectStore("agentActivitySync").clear();
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
    metadataOnly = false,
  ): Promise<CommunityCachedScope> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const partitionKey = `${scopeKey}:${communityCacheAudienceKey(audience)}`;
    const [rows, checkpoints, usage] = await Promise.all([
      metadataOnly
        ? Promise.all(
            COMMUNITY_CACHE_METADATA_KINDS.map((kind) =>
              database.getAllFromIndex(
                "events",
                "chronological",
                IDBKeyRange.bound(
                  [partitionKey, kind, 0, ""],
                  [partitionKey, kind, Number.MAX_SAFE_INTEGER, "~"],
                ),
              ),
            ),
          ).then((rows) => rows.flat())
        : database.getAllFromIndex("events", "partition", partitionKey),
      database.getAllFromIndex("checkpoints", "scope", scopeKey),
      database.get("cacheUsage", `partition:${partitionKey}`),
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
      approximateBytes: usage?.bytes ?? 0,
    };
  }

  restoreMetadata(scope: CommunityScope) {
    return this.restore(scope, { type: "public" }, true);
  }

  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ) {
    const partition = `${communityCacheScopeKey(scope)}:${communityCacheAudienceKey(query.audience)}`;
    const limit = cachePageLimit(query.limit);
    const database = this.#requireDatabase();
    const pages = await Promise.all(
      query.kinds.map(async (kind) => {
        const prefix = query.groupId
          ? [partition, query.groupId, kind]
          : [partition, kind];
        const range = IDBKeyRange.bound(
          [...prefix, 0, ""],
          [
            ...prefix,
            query.before?.createdAt ?? Number.MAX_SAFE_INTEGER,
            query.before?.eventId ?? "~",
          ],
          false,
          !!query.before,
        );
        const tx = database.transaction("events", "readonly");
        let cursor = await tx.store
          .index(query.groupId ? "roomChronological" : "chronological")
          .openCursor(range, "prev");
        const events = [];
        while (cursor && events.length <= limit) {
          const event = verifiedNostrEvent(cursor.value.event);
          if (event) events.push(event);
          cursor = await cursor.continue();
        }
        await tx.done;
        return events;
      }),
    );
    return cachedEventPage(pages.flat(), limit);
  }

  async readHistoryPage(
    scope: CommunityScope,
    key: string,
  ): Promise<CommunityCachedHistoryPage | undefined> {
    const scopeKey = communityCacheScopeKey(scope);
    const tx = this.#requireDatabase().transaction(
      ["historyPages", "events"],
      "readonly",
    );
    const stored = await tx
      .objectStore("historyPages")
      .get(`${scopeKey}:${key}`);
    if (!stored) {
      await tx.done;
      return undefined;
    }
    const page = stored.page;
    const partition = `${scopeKey}:${communityCacheAudienceKey(page.audience)}`;
    const rows = await Promise.all(
      page.eventIds.map((id) =>
        tx.objectStore("events").get(`${partition}:${id}`),
      ),
    );
    await tx.done;
    const events = rows.flatMap((row) => {
      const event = row && verifiedNostrEvent(row.event);
      return event ? [event] : [];
    });
    return events.length === page.eventIds.length
      ? { page, events }
      : undefined;
  }

  async commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    const scopeKey = communityCacheScopeKey(batch.scope);
    const transaction = this.#requireDatabase().transaction(
      ["events", "checkpoints", "historyPages", "cacheUsage"],
      "readwrite",
    );
    try {
      const deltas = new Map<string, number>();
      for (const record of batch.records) {
        if (!isVerifiedNostrEvent(record.event)) continue;
        const partitionKey = `${scopeKey}:${communityCacheAudienceKey(record.audience)}`;
        const key = `${partitionKey}:${record.event.id}`;
        const current = await transaction.objectStore("events").get(key);
        const bytes = communityEventBytes(record);
        const roomId =
          record.roomId ?? record.event.tags.find((tag) => tag[0] === "h")?.[1];
        await transaction.objectStore("events").put({
          key,
          scopeKey,
          partitionKey,
          eventId: record.event.id,
          event: record.event,
          references: referencedEventIds(record.event).map(
            (id) => `${partitionKey}:${id}`,
          ),
          relayUrl: record.relayUrl,
          ...(roomId === undefined ? {} : { roomId }),
          createdAt: record.event.created_at,
          lastAccessedAt: Math.max(
            record.lastAccessedAt ?? Date.now(),
            current?.lastAccessedAt ?? 0,
          ),
          bytes,
        });
        addByteDelta(deltas, "total", bytes - (current?.bytes ?? 0));
        addByteDelta(
          deltas,
          `partition:${partitionKey}`,
          bytes - (current?.bytes ?? 0),
        );
      }
      for (const page of batch.historyPages ?? []) {
        const key = `${scopeKey}:${page.key}`;
        const pages = transaction.objectStore("historyPages");
        const previous = await pages.get(key);
        const bytes = new TextEncoder().encode(JSON.stringify(page)).byteLength;
        const partition = `${scopeKey}:${communityCacheAudienceKey(page.audience)}`;
        await pages.put({
          key,
          scopeKey,
          page,
          bytes,
          lastAccessedAt: Date.now(),
          eventKeys: page.eventIds.map((id) => `${partition}:${id}`),
        });
        addByteDelta(deltas, "total", bytes - (previous?.bytes ?? 0));
      }
      for (const checkpoint of batch.checkpoints ?? [])
        await transaction
          .objectStore("checkpoints")
          .put(checkpointRow(scopeKey, checkpoint));
      await applyByteDeltas(transaction.objectStore("cacheUsage"), deltas);
      await pruneCacheTransaction(transaction, this.#maxBytes);
      await transaction.done;
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        /* The failed transaction may already be closed. */
      }
      await transaction.done.catch(() => undefined);
      throw cause;
    }
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
    const transaction = this.#requireDatabase().transaction(
      ["events", "historyPages", "cacheUsage"],
      "readwrite",
    );
    await pruneCacheTransaction(transaction, this.#maxBytes);
    await transaction.done;
  }

  async hasPublicEventReferences(
    scope: CommunityScope,
    eventIds: readonly string[],
  ): Promise<boolean> {
    const prefix = `${communityCacheScopeKey(scope)}:public:`;
    const database = this.#requireDatabase();
    for (let offset = 0; offset < eventIds.length; offset += 100) {
      const tx = database.transaction("events", "readonly");
      const found = await Promise.all(
        eventIds
          .slice(offset, offset + 100)
          .flatMap((id) => [
            tx.store.getKey(`${prefix}${id}`),
            tx.store.index("references").getKey(`${prefix}${id}`),
          ]),
      );
      await tx.done;
      if (found.some((key) => key !== undefined)) return true;
    }
    return false;
  }

  async removePublicEvents(
    scope: CommunityScope,
    eventIds: readonly string[],
  ): Promise<void> {
    const partition = `${communityCacheScopeKey(scope)}:public`;
    for (let offset = 0; offset < eventIds.length; offset += 100) {
      const tx = this.#requireDatabase().transaction(
        ["events", "historyPages", "cacheUsage"],
        "readwrite",
      );
      try {
        const deltas = new Map<string, number>();
        for (const id of eventIds.slice(offset, offset + 100)) {
          const key = `${partition}:${id}`,
            record = await tx.objectStore("events").get(key);
          if (!record) continue;
          const pages = tx.objectStore("historyPages");
          for (const pageKey of await pages
            .index("eventKeys")
            .getAllKeys(key)) {
            const page = await pages.get(pageKey);
            if (!page) continue;
            await pages.delete(pageKey);
            addByteDelta(deltas, "total", -page.bytes);
          }
          await tx.objectStore("events").delete(key);
          addByteDelta(deltas, "total", -record.bytes);
          addByteDelta(deltas, `partition:${partition}`, -record.bytes);
        }
        await applyByteDeltas(tx.objectStore("cacheUsage"), deltas);
        await tx.done;
      } catch (cause) {
        try {
          tx.abort();
        } catch {
          /* The transaction may already have aborted. */
        }
        await tx.done.catch(() => undefined);
        throw cause;
      }
      if (offset + 100 < eventIds.length)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  async clear(scope?: CommunityScope): Promise<void> {
    const transaction = this.#requireDatabase().transaction(
      ["events", "checkpoints", "historyPages", "cacheUsage"],
      "readwrite",
    );
    if (scope === undefined) {
      await transaction.objectStore("events").clear();
      await transaction.objectStore("checkpoints").clear();
      await transaction.objectStore("historyPages").clear();
      await transaction.objectStore("cacheUsage").clear();
    } else {
      const scopeKey = communityCacheScopeKey(scope);
      const usage = transaction.objectStore("cacheUsage");
      const prefix = `partition:${scopeKey}:`;
      const partitions = await usage.getAll(
        IDBKeyRange.bound(prefix, `${prefix}\uffff`),
      );
      let removedBytes = 0;
      for (const partition of partitions) {
        removedBytes += partition.bytes;
        await usage.delete(partition.key);
      }
      const pages = transaction.objectStore("historyPages");
      for (const page of await pages.index("scope").getAll(scopeKey)) {
        removedBytes += page.bytes;
        await pages.delete(page.key);
      }
      const events = transaction.objectStore("events");
      for (const key of await events.index("scope").getAllKeys(scopeKey))
        await events.delete(key);
      const checkpoints = transaction.objectStore("checkpoints");
      for (const key of await checkpoints.index("scope").getAllKeys(scopeKey))
        await checkpoints.delete(key);
      await applyByteDeltas(usage, new Map([["total", -removedBytes]]));
    }
    await transaction.done;
  }

  async close(): Promise<void> {
    await this.#opening?.catch(() => undefined);
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

function addByteDelta(
  deltas: Map<string, number>,
  key: string,
  amount: number,
): void {
  deltas.set(key, (deltas.get(key) ?? 0) + amount);
}

interface CacheUsageStore {
  get(key: string): Promise<{ key: string; bytes: number } | undefined>;
  put(value: { key: string; bytes: number }): Promise<unknown>;
}
async function applyByteDeltas(
  store: CacheUsageStore,
  deltas: ReadonlyMap<string, number>,
): Promise<void> {
  for (const [key, delta] of deltas) {
    if (delta === 0) continue;
    const current = await store.get(key);
    await store.put({ key, bytes: (current?.bytes ?? 0) + delta });
  }
}

type CachePruningTransaction = import("idb").IDBPTransaction<
  CommunityCacheDb,
  ("events" | "historyPages" | "cacheUsage" | "checkpoints")[],
  "readwrite"
>;
async function pruneCacheTransaction(
  transaction: CachePruningTransaction,
  maxBytes: number,
): Promise<void> {
  const usage = transaction.objectStore("cacheUsage");
  let total = (await usage.get("total"))?.bytes ?? 0;
  if (total <= maxBytes) return;
  const events = transaction.objectStore("events"),
    pages = transaction.objectStore("historyPages");
  const deltas = new Map<string, number>();
  const removePage = async (key: string) => {
    const page = await pages.get(key);
    if (!page) return;
    await pages.delete(key);
    total -= page.bytes;
  };
  while (total > maxBytes) {
    const [eventCursor, pageCursor] = await Promise.all([
      events.index("access").openCursor(),
      pages.index("access").openCursor(),
    ]);
    if (!eventCursor && !pageCursor) break;
    if (
      pageCursor &&
      (!eventCursor ||
        pageCursor.value.lastAccessedAt < eventCursor.value.lastAccessedAt)
    ) {
      await removePage(pageCursor.value.key);
    } else if (eventCursor) {
      const row = eventCursor.value;
      for (const key of await pages.index("eventKeys").getAllKeys(row.key))
        await removePage(key);
      await eventCursor.delete();
      total -= row.bytes;
      addByteDelta(deltas, `partition:${row.partitionKey}`, -row.bytes);
    }
  }
  await applyByteDeltas(usage, deltas);
  await usage.put({ key: "total", bytes: total });
}
