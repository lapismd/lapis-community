import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import {
  createBlossomUri,
  parseBlossomUri,
  resolveBlossomUri,
} from "./blossom-uri.js";

const bytes = new TextEncoder().encode("verified blossom payload");
const hash = bytesToHex(sha256(bytes));
const author = "a".repeat(64);

describe("Blossom URI", () => {
  it("creates and parses ordered discovery hints", () => {
    const uri = createBlossomUri({
      sha256: hash,
      extension: "png",
      serverHints: ["cdn.example", "https://backup.example"],
      authors: [author],
      size: bytes.byteLength,
    });
    expect(parseBlossomUri(uri)).toEqual({
      sha256: hash,
      extension: "png",
      serverHints: ["cdn.example", "https://backup.example"],
      authors: [author],
      size: bytes.byteLength,
    });
    expect(createBlossomUri({ sha256: hash })).toBe(`blossom:${hash}.bin`);
  });

  it("rejects malformed or ambiguous references", () => {
    expect(() => parseBlossomUri(`https:${hash}.png`)).toThrow("scheme");
    expect(() => parseBlossomUri(`blossom:${hash}?sz=1`)).toThrow("extension");
    expect(() => parseBlossomUri(`blossom:${hash}.png?sz=0`)).toThrow("size");
    expect(() => parseBlossomUri(`blossom:${hash}.png?unknown=1`)).toThrow(
      "Unsupported",
    );
    expect(() =>
      parseBlossomUri(`blossom:${hash}.png?xs=https://user@example.com`),
    ).toThrow("origin");
  });

  it("tries server hints before author lists and verifies downloaded bytes", async () => {
    const calls: string[] = [];
    const resolved = await resolveBlossomUri(
      createBlossomUri({
        sha256: hash,
        extension: "bin",
        serverHints: ["hint.example"],
        authors: [author],
        size: bytes.byteLength,
      }),
      {
        discoverAuthorServers: async (pubkey) => {
          expect(pubkey).toBe(author);
          return ["https://author.example"];
        },
        fetch: (async (input: URL | RequestInfo) => {
          const url = new URL(input instanceof Request ? input.url : input);
          calls.push(url.href);
          if (url.origin !== "https://author.example")
            return new Response("missing", { status: 404 });
          return new Response(bytes, {
            headers: {
              "Content-Length": String(bytes.byteLength),
              "Content-Type": "application/octet-stream",
            },
          });
        }) as typeof globalThis.fetch,
      },
    );
    expect(calls.map((url) => new URL(url).origin)).toEqual([
      "https://hint.example",
      "http://hint.example",
      "https://author.example",
    ]);
    expect(resolved.bytes).toEqual(bytes);
    expect(resolved.url).toBe(`https://author.example/${hash}.bin`);
  });

  it("skips corrupt and wrong-size responses", async () => {
    const corrupt = new TextEncoder().encode("wrong");
    const resolved = await resolveBlossomUri(
      createBlossomUri({
        sha256: hash,
        extension: "bin",
        serverHints: ["https://corrupt.example", "https://valid.example"],
        size: bytes.byteLength,
      }),
      {
        fetch: (async (input: URL | RequestInfo) => {
          const url = new URL(input instanceof Request ? input.url : input);
          if (url.origin === "https://corrupt.example")
            return new Response(corrupt);
          return new Response(bytes);
        }) as typeof globalThis.fetch,
      },
    );
    expect(resolved.url).toBe(`https://valid.example/${hash}.bin`);
  });
});
