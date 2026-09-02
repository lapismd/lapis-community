import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import { Nip07RegistrySigner, SecretKeyRegistrySigner } from "./signer.js";
import type { Nip07Provider, NostrEventTemplate } from "./types.js";

describe("NIP-07 registry signer", () => {
  it("signs an exact event template", async () => {
    const secret = generateSecretKey();
    const provider: Nip07Provider = {
      getPublicKey: async () => getPublicKey(secret),
      signEvent: async (template) => finalizeEvent(template, secret),
    };
    const template: NostrEventTemplate = {
      kind: 7,
      created_at: 1_800_000_000,
      content: "⭐",
      tags: [["e", "ab".repeat(32)]],
    };

    await expect(
      new Nip07RegistrySigner(provider).signEvent(template),
    ).resolves.toMatchObject(template);
  });

  it("rejects a signer that mutates the requested event", async () => {
    const secret = generateSecretKey();
    const provider: Nip07Provider = {
      getPublicKey: async () => getPublicKey(secret),
      signEvent: async (template) =>
        finalizeEvent({ ...template, content: "changed" }, secret),
    };

    await expect(
      new Nip07RegistrySigner(provider).signEvent({
        kind: 7,
        created_at: 1_800_000_000,
        content: "⭐",
        tags: [],
      }),
    ).rejects.toThrow("does not match");
  });
});

describe("headless registry signer", () => {
  it("signs NIP-42 templates with a supplied secret key", async () => {
    const secret = generateSecretKey();
    const signer = new SecretKeyRegistrySigner(secret);
    const template: NostrEventTemplate = {
      kind: 22_242,
      created_at: 1_800_000_000,
      content: "challenge",
      tags: [["relay", "wss://relay.example"]],
    };

    await expect(signer.getPublicKey()).resolves.toBe(getPublicKey(secret));
    await expect(signer.signEvent(template)).resolves.toMatchObject(template);
  });

  it("rejects an invalid secret key length", () => {
    expect(() => new SecretKeyRegistrySigner(new Uint8Array(31))).toThrow(
      "exactly 32 bytes",
    );
  });

  it("provides NIP-44 encryption for community state and direct messages", async () => {
    const sender = new SecretKeyRegistrySigner(new Uint8Array(32).fill(91));
    const recipient = new SecretKeyRegistrySigner(new Uint8Array(32).fill(92));
    const ciphertext = await sender.nip44.encrypt(
      await recipient.getPublicKey(),
      "private payload",
    );
    await expect(
      recipient.nip44.decrypt(await sender.getPublicKey(), ciphertext),
    ).resolves.toBe("private payload");
  });
});
