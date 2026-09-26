import { getPublicKey, finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { blossomServersFromEvents } from "./blossom-server-list.js";

const secret = new Uint8Array(32).fill(3);
const pubkey = getPublicKey(secret);

function serverList(created_at: number, tags: string[][]): NostrEvent {
  return finalizeEvent({ kind: 10_063, created_at, content: "", tags }, secret);
}

describe("Blossom server list", () => {
  it("uses the latest signed list and keeps its server order", () => {
    const old = serverList(10, [["server", "https://old.example"]]);
    const current = serverList(20, [
      ["server", "https://primary.example"],
      ["server", "https://backup.example/path"],
      ["server", "https://primary.example"],
      ["server", "javascript:bad"],
    ]);
    expect(blossomServersFromEvents([old, current], pubkey)).toEqual([
      "https://primary.example",
      "https://backup.example",
    ]);
  });

  it("ignores unsigned changes and other authors", () => {
    const signed = serverList(10, [["server", "https://valid.example"]]);
    const tampered = JSON.parse(
      JSON.stringify(serverList(20, [["server", "https://wrong.example"]])),
    ) as NostrEvent;
    tampered.tags = [["server", "https://tampered.example"]];
    const copiedVerified = {
      ...serverList(30, [["server", "https://copied.example"]]),
      tags: [["server", "https://also-tampered.example"]],
    };
    expect(
      blossomServersFromEvents([signed, tampered, copiedVerified], pubkey),
    ).toEqual(["https://valid.example"]);
    expect(blossomServersFromEvents([signed], "a".repeat(64))).toEqual([]);
  });
});
