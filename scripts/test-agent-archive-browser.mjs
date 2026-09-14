import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { nip44 } from "nostr-tools";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// An isolated browser profile exercises the real OPFS driver without touching
// the operator's archive or publishing any fixture events to the relay.
const origin =
  process.env.LAPIS_LOCAL_COMMUNITY_URL ?? "https://local-community.lapis.md";
const source = fileURLToPath(new URL("../src/community/", import.meta.url));
const ownerKey = generateSecretKey(),
  agentKey = generateSecretKey();
const owner = getPublicKey(ownerKey),
  agent = getPublicKey(agentKey);
const events = Array.from({ length: 240 }, (_, index) =>
  finalizeEvent(
    {
      kind: 9,
      created_at: 100 + index,
      content: "Cache replay fixture",
      tags: [["h", "general"]],
    },
    ownerKey,
  ),
);
const privateReply = finalizeEvent(
  {
    kind: 1111,
    created_at: 600,
    content: "Private orphan fixture",
    tags: [["E", events[0].id]],
  },
  ownerKey,
);
const credential = bytesToHex(
  schnorr.sign(
    sha256(new TextEncoder().encode(`nostr:agent-auth:${agent}:`)),
    ownerKey,
  ),
);
const profile = finalizeEvent(
  {
    kind: 0,
    created_at: 100,
    content: '{"name":"Archive fixture"}',
    tags: [["auth", owner, "", credential]],
  },
  agentKey,
);
const records = Array.from({ length: 3 }, (_, index) => ({
  profile,
  receivedAt: 400 + index,
  event: finalizeEvent(
    {
      kind: 24200,
      created_at: 400 + index,
      content: nip44.encrypt(
        "Encrypted archive fixture",
        nip44.getConversationKey(agentKey, owner),
      ),
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
      ],
    },
    agentKey,
  ),
}));
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  // Retain the real server's storage security headers without bootstrapping the
  // Storybook manager or application alongside this isolated database contract.
  const document = await page.request.get(origin);
  assert(document.ok(), "The native cache fixture origin must be available");
  const headers = Object.fromEntries(
    Object.entries(document.headers()).filter(([name]) =>
      ["cross-origin-opener-policy", "cross-origin-embedder-policy"].includes(
        name,
      ),
    ),
  );
  await page.route(new URL(origin).href, (route) =>
    route.fulfill({
      status: 200,
      headers,
      contentType: "text/html",
      body: "<!doctype html><html><head><title>Native cache acceptance</title></head><body></body></html>",
    }),
  );
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(
    async ({ source, events, records, owner, agent }) => {
      const { createTursoCommunityEventStore, canUseTursoCommunityEventStore } =
        await import(`/@fs${source}turso-event-store.ts`);
      const { verifiedNostrEvent } = await import(
        `/@fs${source}verified-events.ts`
      );
      if (!canUseTursoCommunityEventStore())
        throw new Error(
          "Local browser does not expose the OPFS database prerequisites",
        );
      const databaseName = `agent-archive-acceptance-${crypto.randomUUID()}.db`;
      const store = createTursoCommunityEventStore({ databaseName });
      let phase = "open";
      const work = async () => {
        await store.open();
        const scope = {
          id: "archive-acceptance",
          name: "Archive acceptance",
          relayUrl: "wss://relay.example",
          rooms: [],
        };
        const batch = {
          scope,
          records: events.map((event) => ({
            event: verifiedNostrEvent(event),
            relayUrl: scope.relayUrl,
            audience: { type: "public" },
            roomId: "general",
          })),
          historyPages: [
            {
              key: "general-head",
              audience: { type: "public" },
              relayUrls: [scope.relayUrl],
              request: {
                collection: "channel-roots",
                groupId: "general",
                limit: 50,
              },
              eventIds: events.slice(-50).map((event) => event.id),
              primaryEventIds: events.slice(-50).map((event) => event.id),
              hasOlder: true,
              synchronizedAt: 500,
            },
          ],
        };
        const archiveScope = {
          communityId: scope.id,
          ownerPubkey: owner,
          relayUrls: [scope.relayUrl],
        };
        phase = "initial cache commit";
        await store.commit(batch);
        phase = "cache replay and archive append";
        await Promise.all([
          store.commit(batch),
          store.agentActivity.append(archiveScope, records.slice(0, 2)),
        ]);
        const context = { kind: "dm" };
        phase = "atomic activity checkpoint";
        await store.agentActivity.commitSyncPage(
          archiveScope,
          agent,
          context,
          [records[2]],
          {
            streamId: "browser-stream",
            offset: 3,
            updatedAt: 500,
          },
        );
        const checkpoint = await store.agentActivity.checkpoint(
          archiveScope,
          agent,
          context,
        );
        phase = "archive page";
        const history = await store.agentActivity.page({
          scope: archiveScope,
          agentPubkey: agent,
          limit: 2,
        });
        const older = await store.agentActivity.page({
          scope: archiveScope,
          agentPubkey: agent,
          limit: 2,
          before: history.cursor,
        });
        await store.close();
        return {
          databaseName,
          first: history.records.length,
          older: older.records.length,
          hasOlder: history.hasOlder,
          checkpoint: checkpoint?.offset,
        };
      };
      let timer;
      try {
        return await Promise.race([
          work(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(new Error(`Encrypted history blocked during ${phase}`)),
              15000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    { source, events, records, owner, agent },
  );
  const { databaseName, ...counts } = result;
  assert.deepEqual(counts, {
    first: 2,
    older: 1,
    hasOlder: true,
    checkpoint: 3,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const reopened = await page.evaluate(
    async ({ source, databaseName, owner, agent }) => {
      const { createTursoCommunityEventStore } = await import(
        `/@fs${source}turso-event-store.ts`
      );
      const store = createTursoCommunityEventStore({ databaseName });
      let timer;
      try {
        return await Promise.race([
          (async () => {
            await store.open();
            const cached = await store.restore({
              id: "archive-acceptance",
              name: "Archive acceptance",
              relayUrl: "wss://relay.example",
              rooms: [],
            });
            const scope = {
              id: "archive-acceptance",
              name: "Archive acceptance",
              relayUrl: "wss://relay.example",
              rooms: [],
            };
            const metadata = await store.restoreMetadata(scope);
            const head = await store.readHistoryPage(scope, "general-head");
            const history = await store.agentActivity.page({
              scope: {
                communityId: "archive-acceptance",
                ownerPubkey: owner,
                relayUrls: ["wss://relay.example"],
              },
              agentPubkey: agent,
              limit: 10,
            });
            const archiveScope = {
              communityId: "archive-acceptance",
              ownerPubkey: owner,
              relayUrls: ["wss://relay.example"],
            };
            await store.agentActivity.suppressBefore(archiveScope, agent, 600);
            await store.agentActivity.clear(archiveScope, agent);
            const checkpoint = await store.agentActivity.checkpoint(
              archiveScope,
              agent,
              { kind: "dm" },
            );
            const cleared = await store.agentActivity.page({
              scope: archiveScope,
              agentPubkey: agent,
              limit: 10,
            });
            await store.close();
            return {
              cached: cached.events.length,
              head: head?.events.length,
              metadataEvents: metadata.events.length,
              accounted:
                metadata.approximateBytes === cached.approximateBytes &&
                metadata.approximateBytes > 0,
              saved: history.records.length,
              cleared: cleared.records.length,
              offset: checkpoint?.offset,
              notBefore: checkpoint?.notBefore,
            };
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Encrypted history blocked after reload")),
              15000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    { source, databaseName, owner, agent },
  );
  assert.deepEqual(reopened, {
    cached: 240,
    head: 50,
    metadataEvents: 0,
    accounted: true,
    saved: 3,
    cleared: 0,
    offset: 3,
    notBefore: 600,
  });
  const privacy = await page.evaluate(
    async ({ source, privateReply, parentId, retained }) => {
      const { createBrowserCommunityEventStore } = await import(
        `/@fs${source}browser-event-store.ts`
      );
      const { verifiedNostrEvent } = await import(
        `/@fs${source}verified-events.ts`
      );
      const databaseName = `privacy-cache-${crypto.randomUUID()}.db`;
      const store = createBrowserCommunityEventStore({ databaseName });
      await Promise.all([store.open(), store.open(), store.open()]);
      if (store.mode !== "turso-opfs")
        throw new Error(
          "Native privacy acceptance requires the Turso browser wrapper",
        );
      try {
        const scope = {
          id: "private-cache",
          name: "Private cache",
          relayUrl: "wss://relay.example",
        };
        const record = (event, audience = { type: "public" }) => ({
          event: verifiedNostrEvent(event),
          relayUrl: scope.relayUrl,
          audience,
        });
        const head = (key, event) => ({
          key,
          audience: { type: "public" },
          relayUrls: [scope.relayUrl],
          request: {
            collection: "channel-roots",
            groupId: "general",
            limit: 50,
          },
          eventIds: [event.id],
          primaryEventIds: [event.id],
          hasOlder: false,
          synchronizedAt: 600,
        });
        await store.commit({
          scope,
          records: [
            record(privateReply),
            record(retained),
            record(privateReply, { type: "inbox", pubkey: "fixture-owner" }),
          ],
          historyPages: [
            head("unsafe", privateReply),
            head("retained", retained),
          ],
        });
        const orphanKnown = await store.hasPublicEventReferences(scope, [
          parentId,
        ]);
        const unrelatedScope = await store.hasPublicEventReferences(
          { ...scope, id: "another" },
          [parentId],
        );
        await store.removePublicEvents(scope, [privateReply.id]);
        return {
          orphanKnown,
          unrelatedScope,
          removed: !(await store.hasPublicEventReferences(scope, [parentId])),
          unsafe: (await store.readHistoryPage(scope, "unsafe")) === undefined,
          retained:
            (await store.readHistoryPage(scope, "retained"))?.events[0]?.id ===
            retained.id,
          inboxPartition: (
            await store.restore(scope, {
              type: "inbox",
              pubkey: "fixture-owner",
            })
          ).events.length,
          publicCount: (await store.restore(scope)).events.length,
        };
      } finally {
        await store.close();
        // A direct opener proves the wrapper released its final driver lock.
        const { createTursoCommunityEventStore } = await import(
          `/@fs${source}turso-event-store.ts`
        );
        const nextOwner = createTursoCommunityEventStore({ databaseName });
        await nextOwner.open();
        await nextOwner.close();
      }
    },
    { source, privateReply, parentId: events[0].id, retained: events.at(-1) },
  );
  assert.deepEqual(privacy, {
    orphanKnown: true,
    unrelatedScope: false,
    removed: true,
    unsafe: true,
    retained: true,
    inboxPartition: 1,
    publicCount: 1,
  });
  const eviction = await page.evaluate(
    async ({ source, events }) => {
      const { createTursoCommunityEventStore } = await import(
        `/@fs${source}turso-event-store.ts`
      );
      const { communityEventBytes } = await import(
        `/@fs${source}event-store.ts`
      );
      const { verifiedNostrEvent } = await import(
        `/@fs${source}verified-events.ts`
      );
      const scope = {
        id: "eviction",
        name: "Eviction",
        relayUrl: "wss://relay.example",
      };
      const records = events.slice(0, 3).map((event, index) => ({
        event: verifiedNostrEvent(event),
        relayUrl: scope.relayUrl,
        audience: { type: "public" },
        lastAccessedAt: index + 1,
      }));
      const head = (key, record) => ({
        key,
        audience: { type: "public" },
        relayUrls: [scope.relayUrl],
        request: { collection: "channel-roots", groupId: "general", limit: 50 },
        eventIds: [record.event.id],
        primaryEventIds: [record.event.id],
        hasOlder: false,
        synchronizedAt: 500,
      });
      const first = head("first", records[0]),
        second = head("second", records[1]);
      const size = (page) =>
        new TextEncoder().encode(JSON.stringify(page)).byteLength;
      const maximum =
        communityEventBytes(records[1]) +
        communityEventBytes(records[2]) +
        size(second) +
        1;
      const store = createTursoCommunityEventStore({
        databaseName: `cache-eviction-${crypto.randomUUID()}.db`,
        maxBytes: maximum,
      });
      let timer;
      try {
        return await Promise.race([
          (async () => {
            await store.open();
            await store.commit({
              scope,
              records: records.slice(0, 2),
              historyPages: [first, second],
            });
            await store.commit({ scope, records: [records[2]] });
            const removed = await store.readHistoryPage(scope, first.key);
            const retained = await store.readHistoryPage(scope, second.key);
            const metadata = await store.restoreMetadata(scope);
            const expected =
              communityEventBytes(records[1]) + communityEventBytes(records[2]);
            await store.clear(scope);
            const cleared = await store.restoreMetadata(scope);
            await store.close();
            return {
              removed: removed === undefined,
              retained: retained?.events[0]?.id === records[1].event.id,
              accounted: metadata.approximateBytes === expected,
              cleared: cleared.approximateBytes === 0,
            };
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Native cache eviction blocked")),
              15000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    { source, events },
  );
  assert.deepEqual(eviction, {
    removed: true,
    retained: true,
    accounted: true,
    cleared: true,
  });
  console.log(
    "Browser cache replay, atomic agent checkpoint, suppression, history pages, accounting, selective eviction and reload passed.",
  );
} finally {
  await browser.close();
}
