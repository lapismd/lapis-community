import { describe, expect, it, vi } from "vitest";

import { uploadCommunityProfileImage } from "./profile-image-upload.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

function event(template: NostrEventTemplate): NostrEvent {
  return {
    ...template,
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    sig: "c".repeat(128),
  };
}

function imageFile(bytes = [137, 80, 78, 71]): File {
  return new File([new Uint8Array(bytes)], "avatar.png", {
    type: "image/png",
  });
}

const IMAGE_HASH =
  "0f4636c78f65d3639ece5a064b5ae753e3408614a14fb18ab4d7540d2c248543";

describe("Community profile image upload", () => {
  it("uploads image bytes to the relay Blossom endpoint", async () => {
    const signed: NostrEventTemplate[] = [];
    let request: Request | undefined;
    const fetcher = vi.fn(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        request = new Request(input, init);
        return Response.json({
          url: `https://relay.example/${IMAGE_HASH}.png`,
          sha256: IMAGE_HASH,
          size: 4,
          type: "image/png",
        });
      },
    );

    const url = await uploadCommunityProfileImage(imageFile(), {
      relayUrl: "wss://relay.example/nostr",
      now: () => 1_700_000_000,
      fetch: fetcher as typeof globalThis.fetch,
      identity: {
        getPublicKey: async () => "b".repeat(64),
        signEvent: async (template) => {
          signed.push(template);
          return event(template);
        },
      },
    });

    expect(url).toBe(`https://relay.example/${IMAGE_HASH}.png`);
    expect(request?.url).toBe("https://relay.example/upload");
    expect(request?.method).toBe("PUT");
    expect(request?.headers.get("Content-Type")).toBe("image/png");
    expect(request?.headers.get("X-SHA-256")).toBe(IMAGE_HASH);
    expect(request?.headers.get("Authorization")).toMatch(/^Nostr /u);
    expect(signed).toEqual([
      {
        kind: 24_242,
        created_at: 1_700_000_000,
        content: "Upload Lapis profile image",
        tags: [
          ["t", "upload"],
          ["x", IMAGE_HASH],
          ["expiration", "1700000300"],
          ["server", "relay.example"],
        ],
      },
    ]);
  });

  it("rejects non-image files before upload", async () => {
    const fetcher = vi.fn();
    await expect(
      uploadCommunityProfileImage(
        new File(["text"], "note.txt", { type: "text/plain" }),
        {
          relayUrl: "wss://relay.example",
          fetch: fetcher as typeof globalThis.fetch,
          identity: {
            getPublicKey: async () => "b".repeat(64),
            signEvent: async (template) => event(template),
          },
        },
      ),
    ).rejects.toThrow("Choose a PNG, JPEG, GIF, or WebP image.");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects unverified upload descriptors", async () => {
    await expect(
      uploadCommunityProfileImage(imageFile(), {
        relayUrl: "wss://relay.example",
        fetch: (async () =>
          Response.json({
            url: "https://relay.example/media/avatar.txt",
            sha256: "0".repeat(64),
            size: 4,
            type: "text/plain",
          })) as typeof globalThis.fetch,
        identity: {
          getPublicKey: async () => "b".repeat(64),
          signEvent: async (template) => event(template),
        },
      }),
    ).rejects.toThrow("descriptor failed verification");
  });
});
