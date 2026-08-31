import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createHttpAuthTemplate,
  Nip07RegistrySigner,
  Nip46RegistrySigner,
  parseNip98AuthorizationHeader,
  toNip98AuthorizationHeader,
  verifyHttpAuth,
} from "./index.js";
import type {
  Nip07Provider,
  Nip46RpcClient,
  NostrEventTemplate,
} from "./index.js";

describe("registry signers", () => {
  it("accepts an exact valid NIP-07 result and rejects signer mutation", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const provider: Nip07Provider = {
      getPublicKey: async () => pubkey,
      signEvent: async (template) => finalizeEvent(template, secret),
    };
    const signer = new Nip07RegistrySigner(provider);
    const template: NostrEventTemplate = {
      kind: 1,
      created_at: 1_800_000_000,
      tags: [["t", "registry"]],
      content: "exact template",
    };

    await expect(signer.signEvent(template)).resolves.toMatchObject({
      pubkey,
      kind: template.kind,
      content: template.content,
    });

    const mutatingProvider: Nip07Provider = {
      ...provider,
      signEvent: async (requested) =>
        finalizeEvent({ ...requested, content: "changed" }, secret),
    };
    await expect(
      new Nip07RegistrySigner(mutatingProvider).signEvent(template),
    ).rejects.toThrow("does not match the requested template");
  });

  it("uses the NIP-46 get_public_key and sign_event RPC boundary", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const rpc: Nip46RpcClient = {
      request: async (method, params) => {
        if (method === "get_public_key") return pubkey;
        return JSON.stringify(
          finalizeEvent(JSON.parse(params[0]!) as NostrEventTemplate, secret),
        );
      },
    };
    const template = {
      kind: 30063,
      created_at: 1_800_000_000,
      tags: [["d", "demo@1.0.0"]],
      content: "{}",
    };

    await expect(
      new Nip46RegistrySigner(rpc).signEvent(template),
    ).resolves.toMatchObject({ pubkey, kind: 30063 });
  });
});

describe("NIP-98 HTTP authorization", () => {
  it("round-trips an exact, fresh payload-bound challenge", () => {
    const secret = generateSecretKey();
    const now = 1_800_000_000;
    const request = {
      url: "https://registry.example.test/events?source=community",
      method: "POST",
      body: JSON.stringify({ event: "fixture" }),
      challenge: "one-use-challenge",
      createdAt: now,
    };
    const event = finalizeEvent(createHttpAuthTemplate(request), secret);
    const parsed = parseNip98AuthorizationHeader(
      toNip98AuthorizationHeader(event),
    );

    expect(
      verifyHttpAuth(parsed, {
        ...request,
        now,
      }),
    ).toBe(getPublicKey(secret));
  });

  it("fails closed on request mismatch, replay age, and malformed headers", () => {
    const secret = generateSecretKey();
    const now = 1_800_000_000;
    const event = finalizeEvent(
      createHttpAuthTemplate({
        url: "https://registry.example.test/events",
        method: "POST",
        body: "expected",
        challenge: "expected",
        createdAt: now,
      }),
      secret,
    );

    expect(() =>
      verifyHttpAuth(event, {
        url: "https://registry.example.test/events",
        method: "POST",
        body: "changed",
        challenge: "expected",
        now,
      }),
    ).toThrow("payload does not match");
    expect(() =>
      verifyHttpAuth(event, {
        url: "https://registry.example.test/events",
        method: "POST",
        body: "expected",
        challenge: "expected",
        now: now + 61,
      }),
    ).toThrow("outside the freshness window");
    expect(() => parseNip98AuthorizationHeader("Bearer token")).toThrow(
      "Expected a Nostr authorization scheme",
    );
  });
});
