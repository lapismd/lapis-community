import { describe, expect, it, vi } from "vitest";

import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import {
  CommunityAssetRequestError,
  createCommunityAssetManagement,
} from "./asset-management.js";

const owner = "b".repeat(64);
const hash = "a".repeat(64);

function signedEvent(template: NostrEventTemplate): NostrEvent {
  return {
    ...template,
    id: "c".repeat(64),
    pubkey: owner,
    sig: "d".repeat(128),
  };
}

function reportEvent(): NostrEvent {
  return {
    id: "e".repeat(64),
    pubkey: "f".repeat(64),
    created_at: 1_700_000_010,
    kind: 1_984,
    tags: [["x", hash]],
    content: "malware",
    sig: "1".repeat(128),
  };
}

describe("Community asset management", () => {
  it("signs owner list and lifecycle requests and exposes stable cursors", async () => {
    const signed: NostrEventTemplate[] = [];
    const requests: Request[] = [];
    const fetcher = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push(request);
        if (request.url.includes("/list/"))
          return Response.json([
            {
              url: `https://relay.example/${hash}.png`,
              sha256: hash,
              size: 42,
              type: "image/png",
              uploaded: 1_700_000_000,
              nip94: [["x", hash]],
              lapis: { purpose: ["avatar"] },
            },
          ]);
        return Response.json({
          items: [
            {
              cursor: "1700000000:2",
              owner,
              sha256: hash,
              action: "uploaded",
              occurred_at: 1_700_000_000,
            },
          ],
          next_cursor: "1700000000:2",
        });
      },
    );
    const client = createCommunityAssetManagement({
      relayUrl: "wss://relay.example/nostr",
      now: () => 1_700_000_000,
      fetch: fetcher as typeof globalThis.fetch,
      identity: {
        getPublicKey: async () => owner,
        signEvent: async (template) => {
          signed.push(template);
          return signedEvent(template);
        },
      },
    });

    await expect(client.listAssets("avatar", { limit: 1 })).resolves.toEqual({
      items: [expect.objectContaining({ sha256: hash, size: 42 })],
      nextCursor: hash,
    });
    await expect(client.listHistory({ limit: 1 })).resolves.toEqual({
      items: [expect.objectContaining({ action: "uploaded", sha256: hash })],
      nextCursor: "1700000000:2",
    });
    expect(requests[0]?.url).toBe(
      `https://relay.example/list/${owner}?limit=1&tag.purpose=avatar`,
    );
    expect(requests[1]?.url).toBe(
      "https://relay.example/api/assets/history?limit=1",
    );
    expect(
      requests.every((request) => request.headers.has("Authorization")),
    ).toBe(true);
    expect(signed).toEqual([
      {
        kind: 24_242,
        created_at: 1_700_000_000,
        content: "List Lapis assets",
        tags: [
          ["t", "list"],
          ["expiration", "1700000300"],
          ["server", "relay.example"],
        ],
      },
      {
        kind: 24_242,
        created_at: 1_700_000_000,
        content: "Read Lapis asset history",
        tags: [
          ["t", "list"],
          ["expiration", "1700000300"],
          ["server", "relay.example"],
        ],
      },
    ]);
  });

  it("parses the manager report queue and reports blocked deletion", async () => {
    const signed: NostrEventTemplate[] = [];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([{ event: reportEvent(), status: "open" }]),
      )
      .mockResolvedValueOnce(
        new Response(
          "asset is retained by an active profile picture reference",
          {
            status: 409,
          },
        ),
      );
    const client = createCommunityAssetManagement({
      relayUrl: "https://relay.example",
      now: () => 1_700_000_000,
      fetch: fetcher as typeof globalThis.fetch,
      identity: {
        getPublicKey: async () => owner,
        signEvent: async (template) => {
          signed.push(template);
          return signedEvent(template);
        },
      },
    });

    await expect(client.listReports({ limit: 1 })).resolves.toEqual({
      items: [expect.objectContaining({ status: "open" })],
      nextCursor: "e".repeat(64),
    });
    await expect(client.deleteAsset(hash)).rejects.toMatchObject({
      status: 409,
      message: "asset is retained by an active profile picture reference",
    } satisfies Partial<CommunityAssetRequestError>);
    const deleteRequest = new Request(
      fetcher.mock.calls[1]?.[0],
      fetcher.mock.calls[1]?.[1],
    );
    expect(deleteRequest.method).toBe("DELETE");
    expect(deleteRequest.url).toBe(`https://relay.example/${hash}`);
    expect(signed).toEqual([
      {
        kind: 24_242,
        created_at: 1_700_000_000,
        content: "Review Lapis asset reports",
        tags: [
          ["t", "list"],
          ["expiration", "1700000300"],
          ["server", "relay.example"],
        ],
      },
      {
        kind: 24_242,
        created_at: 1_700_000_000,
        content: "Delete Lapis asset",
        tags: [
          ["t", "delete"],
          ["x", hash],
          ["expiration", "1700000300"],
          ["server", "relay.example"],
        ],
      },
    ]);
  });

  it("rejects malformed relay payloads", async () => {
    const client = createCommunityAssetManagement({
      relayUrl: "https://relay.example",
      fetch: (async () =>
        Response.json([{ sha256: "not-a-hash" }])) as typeof globalThis.fetch,
      identity: {
        getPublicKey: async () => owner,
        signEvent: async (template) => signedEvent(template),
      },
    });
    await expect(client.listAssets("emoji")).rejects.toThrow(
      "invalid asset list",
    );
  });
});
