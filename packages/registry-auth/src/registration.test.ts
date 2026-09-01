import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type {
  RegistryRelay,
  RelayAuthSigner,
  RelayFilter,
  RelayPublishResult,
} from "@lapismd/registry-nostr";
import {
  TEST_MEMBERSHIP_KINDS,
  type NostrEvent,
  type NostrEventTemplate,
} from "@lapismd/registry-protocol";

import { Nip07RegistrySigner, registerRelayMember } from "./index.js";

class AuthenticatedTestRelay implements RegistryRelay {
  readonly url = "wss://relay.example";
  readonly events: NostrEvent[] = [];
  authenticatedPubkey = "";

  async authenticate(signEvent: RelayAuthSigner): Promise<RelayPublishResult> {
    const event = await signEvent({
      kind: 22242,
      created_at: 1_800_000_000,
      tags: [
        ["relay", this.url],
        ["challenge", "fixture"],
      ],
      content: "",
    });
    this.authenticatedPubkey = event.pubkey;
    return { accepted: true, message: "authenticated" };
  }

  async query(_filter: RelayFilter): Promise<NostrEvent[]> {
    return [...this.events];
  }

  async publish(event: NostrEvent): Promise<RelayPublishResult> {
    if (event.pubkey !== this.authenticatedPubkey) {
      throw new Error("auth-required: author mismatch");
    }
    this.events.push(event);
    return { accepted: true, message: "saved" };
  }

  close(): void {}
}

describe("relay membership registration", () => {
  it("uses the same signer for NIP-42 and the relay-native registration", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const signer = new Nip07RegistrySigner({
      getPublicKey: async () => pubkey,
      signEvent: async (template: NostrEventTemplate) =>
        finalizeEvent(template, secret),
    });
    const relay = new AuthenticatedTestRelay();

    const result = await registerRelayMember({
      relay,
      signer,
      kinds: TEST_MEMBERSHIP_KINDS,
      createdAt: 1_800_000_001,
    });

    expect(relay.authenticatedPubkey).toBe(pubkey);
    expect(result.event).toMatchObject({
      pubkey,
      kind: TEST_MEMBERSHIP_KINDS.registration,
      tags: [["d", "lapis-membership"]],
    });
    expect(relay.events).toEqual([result.event]);
  });
});
