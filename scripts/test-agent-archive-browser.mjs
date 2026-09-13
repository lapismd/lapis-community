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
    saved: 3,
    cleared: 0,
    offset: 3,
    notBefore: 600,
  });
  console.log(
    "Browser cache replay, atomic agent checkpoint, suppression, pagination and reload passed.",
  );
} finally {
  await browser.close();
}
