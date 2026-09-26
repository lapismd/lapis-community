import { describe, expect, it } from "vitest";

import {
  blossomUploadTags,
  verifiedBlossomImageDescriptor,
  verifiedBlossomImageUrl,
} from "./blossom-upload-contract.js";
import { uploadCommunityProfileImage } from "./profile-image-upload.js";

const hash = "0f4636c78f65d3639ece5a064b5ae753e3408614a14fb18ab4d7540d2c248543";

describe("Blossom upload contract", () => {
  it("binds the server and plugin artwork declaration", () => {
    expect(
      blossomUploadTags(hash, "images.example", 100, {
        purpose: "plugin",
        plugin: "lapis-notes",
        slot: "icon",
      }),
    ).toEqual([
      ["t", "upload"],
      ["x", hash],
      ["expiration", "400"],
      ["server", "images.example"],
      ["lapis-purpose", "plugin"],
      ["lapis-plugin", "lapis-notes"],
      ["lapis-slot", "icon"],
    ]);
    expect(() =>
      blossomUploadTags(hash, "images.example", 100, {
        purpose: "plugin",
      }),
    ).toThrow("plugin identifier");
  });

  it("requires the returned image URL to contain the verified hash", () => {
    const descriptor = {
      url: `https://images.example/${hash}.png`,
      sha256: hash,
      size: 4,
      type: "image/png",
      nip94: [
        ["url", `https://images.example/${hash}.png`],
        ["m", "image/png"],
        ["x", hash],
        ["size", "4"],
        ["dim", "1x1"],
      ],
    };
    expect(verifiedBlossomImageUrl(descriptor, hash, 4)).toBe(descriptor.url);
    expect(verifiedBlossomImageDescriptor(descriptor, hash, 4).nip94).toEqual(
      descriptor.nip94,
    );
    expect(() =>
      verifiedBlossomImageUrl(
        {
          ...descriptor,
          url: "https://images.example/unrelated.png",
        },
        hash,
        4,
      ),
    ).toThrow("descriptor failed verification");
    expect(() =>
      verifiedBlossomImageUrl(
        {
          ...descriptor,
          nip94: descriptor.nip94.map((tag) =>
            tag[0] === "x" ? ["x", "0".repeat(64)] : tag,
          ),
        },
        hash,
        4,
      ),
    ).toThrow("NIP-94 x tag failed verification");
  });

  it("uploads to the first advertised server", async () => {
    let request: Request | undefined;
    await uploadCommunityProfileImage(
      new File([new Uint8Array([137, 80, 78, 71])], "icon.png", {
        type: "image/png",
      }),
      {
        relayUrl: "wss://relay.example",
        serverUrls: ["https://images.example", "https://backup.example"],
        purpose: "plugin",
        plugin: "lapis-notes",
        slot: "icon",
        fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
          request = new Request(input, init);
          return Response.json({
            url: `https://images.example/${hash}.png`,
            sha256: hash,
            size: 4,
            type: "image/png",
          });
        }) as typeof globalThis.fetch,
        identity: {
          getPublicKey: async () => "b".repeat(64),
          signEvent: async (template) => ({
            ...template,
            id: "a".repeat(64),
            pubkey: "b".repeat(64),
            sig: "c".repeat(128),
          }),
        },
      },
    );
    expect(request?.url).toBe("https://images.example/upload");
  });
});
