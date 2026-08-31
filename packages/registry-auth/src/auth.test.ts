import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  Nip07RegistrySigner,
  Nip46RegistrySigner,
  Nip55RegistrySigner,
  RegistrySignerSession,
} from "./index.js";
import type {
  Nip07Provider,
  Nip46RpcClient,
  Nip55Bridge,
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

  it("uses a constrained NIP-55 bridge and disconnects the native session", async () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const calls: string[] = [];
    const bridge: Nip55Bridge = {
      connect: async (permissions) => {
        calls.push(`connect:${permissions[0]?.kind}`);
        return { pubkey, packageName: "com.example.signer" };
      },
      signEvent: async (request) => {
        calls.push(`sign:${request.packageName}:${request.pubkey}`);
        return finalizeEvent(request.template, secret);
      },
      disconnect: async () => {
        calls.push("disconnect");
      },
    };
    const signer = await Nip55RegistrySigner.connect(bridge, [
      { type: "sign_event", kind: 30063 },
    ]);
    const template = {
      kind: 30063,
      created_at: 1_800_000_000,
      tags: [["d", "demo@1.0.0"]],
      content: "{}",
    };

    await expect(signer.signEvent(template)).resolves.toMatchObject({ pubkey });
    await expect(
      signer.signEvent({ ...template, kind: 64000 }),
    ).rejects.toThrow("did not request kind 64000");
    await signer.close();
    await expect(signer.getPublicKey()).rejects.toThrow("disconnected");
    expect(calls).toEqual([
      "connect:30063",
      `sign:com.example.signer:${pubkey}`,
      "disconnect",
    ]);
  });

  it("does not retain a NIP-55 connection when permission is denied", async () => {
    const bridge: Nip55Bridge = {
      connect: async () => {
        throw new Error("User rejected signer permission");
      },
      signEvent: async () => {
        throw new Error("unexpected signing call");
      },
    };

    await expect(
      Nip55RegistrySigner.connect(bridge, [{ type: "sign_event", kind: 1 }]),
    ).rejects.toThrow("User rejected signer permission");
  });

  it("invalidates an in-flight signer request on logout", async () => {
    const secret = generateSecretKey();
    let finishSigning!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishSigning = resolve;
    });
    const signer = {
      getPublicKey: async () => getPublicKey(secret),
      signEvent: async (template: NostrEventTemplate) => {
        await pending;
        return finalizeEvent(template, secret);
      },
    };
    const session = new RegistrySignerSession(signer, {
      expiresAt: 1_800_000_060,
      now: () => 1_800_000_000,
    });
    const signing = session.signEvent({
      kind: 1,
      created_at: 1_800_000_000,
      tags: [],
      content: "stale after logout",
    });

    await session.close();
    finishSigning();
    await expect(signing).rejects.toThrow("became stale");
  });

  it("expires a signer session before making a request", async () => {
    const signer = {
      getPublicKey: async () => "0".repeat(64),
      signEvent: async () => {
        throw new Error("unexpected signing call");
      },
    };
    const session = new RegistrySignerSession(signer, {
      expiresAt: 1_800_000_000,
      now: () => 1_800_000_000,
    });

    await expect(session.getPublicKey()).rejects.toThrow("has expired");
  });
});
