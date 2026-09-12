import { bytesToHex } from "@noble/hashes/utils.js";
import { nip19 } from "nostr-tools";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

import {
  CommunityKeytrError,
  createCommunityKeytrLoginIntegration,
  validateCommunityKeytrEvent,
  type CommunityKeytrLibrary,
} from "./keytr.js";
import { SecretKeyRegistrySigner } from "./signer.js";
import { encodeBase64Url } from "./webauthn.js";

const credentialId = new Uint8Array([1, 2, 3, 4]);
const dTag = encodeBase64Url(credentialId);
const gateway = { id: "keytr", label: "Keytr", rpId: "keytr.org" };

function template(rpId = gateway.rpId): NostrEventTemplate {
  return {
    kind: 31_777,
    created_at: 1_800_000_000,
    content: "encrypted-key",
    tags: [
      ["d", dTag],
      ["rp", rpId],
      ["algo", "aes-256-gcm"],
      ["kdf", "hkdf-sha256"],
      ["v", "1"],
      ["transports", "internal"],
    ],
  };
}

function signedEvent(
  secret: Uint8Array,
  overrides: Partial<NostrEventTemplate> = {},
): NostrEvent {
  return finalizeEvent({ ...template(), ...overrides }, secret);
}

function keytrLibrary(
  secret: Uint8Array,
  overrides: Partial<CommunityKeytrLibrary> = {},
): CommunityKeytrLibrary {
  return {
    checkCapabilities: vi.fn(async () => ({
      webauthn: true,
      platformAuthenticator: true,
      prf: true,
      relatedOrigins: true,
      signalApi: true,
    })),
    setup: vi.fn(async () => ({
      credential: {
        credentialId,
        credentialIdBase64url: dTag,
        rpId: gateway.rpId,
        transports: ["internal"],
      },
      eventTemplate: template(),
      nsecBytes: secret,
    })),
    addBackupGateway: vi.fn(async () => ({
      credential: {
        credentialId,
        credentialIdBase64url: dTag,
        rpId: gateway.rpId,
        transports: ["internal"],
      },
      eventTemplate: template(),
    })),
    discoverPasskey: vi.fn(async () => ({
      keyMaterial: new Uint8Array(32).fill(9),
      credentialId,
      mode: "prf" as const,
      pubkey: getPublicKey(secret),
    })),
    authenticatePasskey: vi.fn(async () => new Uint8Array(32).fill(9)),
    fetchKeytrEvents: vi.fn(async () => [signedEvent(secret)]),
    parseKeytrEvent: vi.fn(() => ({
      credentialIdBase64url: dTag,
      credentialId,
      rpId: gateway.rpId,
      encryptedBlob: "encrypted-key",
      version: 1,
      algorithm: "aes-256-gcm",
      kdf: "hkdf-sha256",
      transports: ["internal"],
    })),
    decryptNsec: vi.fn(() => secret.slice()),
    publishKeytrEvent: vi.fn(async () => undefined),
    signalUnknownCredential: vi.fn(async () => true),
    ...overrides,
  };
}

function integration(
  library: CommunityKeytrLibrary,
  options: {
    allowLocalKeyMethods?: boolean;
    relayUrls?: readonly string[];
  } = {},
) {
  return createCommunityKeytrLoginIntegration({
    library,
    relayUrls: options.relayUrls ?? ["wss://keys.example/nostr"],
    gateways: [gateway],
    ...(options.allowLocalKeyMethods === undefined
      ? {}
      : { allowLocalKeyMethods: options.allowLocalKeyMethods }),
  });
}

describe("Community Keytr integration", () => {
  it("is opt-in and validates gateways and storage relays", () => {
    const library = keytrLibrary(generateSecretKey());

    expect(() =>
      createCommunityKeytrLoginIntegration({ library, relayUrls: [] }),
    ).toThrow(CommunityKeytrError);
    expect(() =>
      createCommunityKeytrLoginIntegration({
        library,
        relayUrls: ["ws://relay.example"],
      }),
    ).toThrow("not configured");
    expect(() =>
      createCommunityKeytrLoginIntegration({
        library,
        relayUrls: ["wss://keys.example"],
        gateways: [{ id: "bad", label: "Bad", rpId: "https://keytr.org" }],
      }),
    ).toThrow("not configured");

    const configured = createCommunityKeytrLoginIntegration({
      library,
      relayUrls: ["ws://keys.community.localhost:7447"],
    });
    expect(configured.gateways).toEqual([
      { id: "keytr.org", label: "Keytr", rpId: "keytr.org" },
    ]);
    expect(configured.method).toMatchObject({
      kind: "keytr",
      label: "Continue with Keytr",
      description: "Use a passkey-protected Nostr key",
      keytr: { allowSetup: true, allowImport: false },
    });
  });

  it("recovers a discovered identity only after validating its signed record", async () => {
    const secret = generateSecretKey();
    const material = new Uint8Array(32).fill(7);
    const library = keytrLibrary(secret, {
      discoverPasskey: vi.fn(async () => ({
        keyMaterial: material,
        credentialId,
        mode: "prf" as const,
        pubkey: getPublicKey(secret),
      })),
    });
    const configured = integration(library);

    const signer = await configured.connect("keytr", {
      keytr: { action: "login", gatewayId: gateway.id },
    });

    await expect(signer.getPublicKey()).resolves.toBe(getPublicKey(secret));
    expect(material).toEqual(new Uint8Array(32));
    expect(library.decryptNsec).toHaveBeenCalledOnce();
  });

  it("requires the restored account pubkey during targeted reconnection", async () => {
    const expectedSecret = generateSecretKey();
    const otherSecret = generateSecretKey();
    const library = keytrLibrary(expectedSecret);
    const configured = integration(library);

    await expect(
      configured.connect(
        "keytr",
        { keytr: { action: "login", gatewayId: gateway.id } },
        { expectedPubkey: getPublicKey(expectedSecret) },
      ),
    ).resolves.toMatchObject({ dispose: expect.any(Function) });
    expect(library.discoverPasskey).not.toHaveBeenCalled();
    expect(library.fetchKeytrEvents).toHaveBeenCalledWith(
      getPublicKey(expectedSecret),
      ["wss://keys.example/nostr"],
    );

    const mismatched = keytrLibrary(otherSecret, {
      fetchKeytrEvents: vi.fn(async () => [signedEvent(otherSecret)]),
    });
    await expect(
      integration(mismatched).connect(
        "keytr",
        { keytr: { action: "login", gatewayId: gateway.id } },
        { expectedPubkey: getPublicKey(expectedSecret) },
      ),
    ).rejects.toMatchObject({ code: "invalid_event" });
  });

  it("signs and publishes new identity records before returning the local signer", async () => {
    const sourceSecret = generateSecretKey();
    const pubkey = getPublicKey(sourceSecret);
    const publish = vi.fn(async (event: NostrEvent, relays: string[]) => {
      expect(verifyEvent(event)).toBe(true);
      expect(event.pubkey).toBe(pubkey);
      expect(event.kind).toBe(31_777);
      expect(relays).toEqual(["wss://keys.example/nostr"]);
    });
    const library = keytrLibrary(sourceSecret, {
      publishKeytrEvent: publish,
    });

    const signer = await integration(library).connect("keytr", {
      keytr: {
        action: "create",
        gatewayId: gateway.id,
        passkeyLabel: "My Community key",
      },
    });

    expect(sourceSecret).toEqual(new Uint8Array(32));
    expect(library.setup).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: "My Community key",
        userDisplayName: "My Community key",
      }),
    );
    expect(publish).toHaveBeenCalledOnce();
    await expect(signer.getPublicKey()).resolves.toBe(pubkey);
  });

  it("protects an imported nsec only when local-key methods are enabled", async () => {
    const secret = generateSecretKey();
    const encoded = nip19.nsecEncode(secret);
    const disabled = integration(keytrLibrary(secret));
    await expect(
      disabled.connect("keytr", {
        keytr: {
          action: "import",
          gatewayId: gateway.id,
          privateKey: encoded,
        },
      }),
    ).rejects.toMatchObject({ code: "invalid_action" });

    const library = keytrLibrary(secret);
    const signer = await integration(library, {
      allowLocalKeyMethods: true,
    }).connect("keytr", {
      keytr: {
        action: "import",
        gatewayId: gateway.id,
        passkeyLabel: "Imported key",
        privateKey: encoded,
      },
    });

    expect(library.addBackupGateway).toHaveBeenCalledOnce();
    await expect(signer.getPublicKey()).resolves.toBe(getPublicKey(secret));
  });

  it("accepts hexadecimal imports and reports malformed keys before WebAuthn", async () => {
    const secret = generateSecretKey();
    const library = keytrLibrary(secret);
    const enabled = integration(library, { allowLocalKeyMethods: true });

    const signer = await enabled.connect("keytr", {
      keytr: {
        action: "import",
        gatewayId: gateway.id,
        passkeyLabel: "Imported hex key",
        privateKey: bytesToHex(secret),
      },
    });
    await expect(signer.getPublicKey()).resolves.toBe(getPublicKey(secret));

    await expect(
      enabled.connect("keytr", {
        keytr: {
          action: "import",
          gatewayId: gateway.id,
          privateKey: "not-a-private-key",
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_private_key",
      message: "Use an nsec or a 64-character hexadecimal private key.",
    });
    expect(library.addBackupGateway).toHaveBeenCalledOnce();
  });

  it("reports sanitized authenticator failures separately from invalid actions", async () => {
    const secret = generateSecretKey();
    const library = keytrLibrary(secret, {
      addBackupGateway: vi.fn(async () => {
        const error = new Error("credential id 123");
        error.name = "WebAuthnError";
        throw error;
      }),
    });

    await expect(
      integration(library, { allowLocalKeyMethods: true }).connect("keytr", {
        keytr: {
          action: "import",
          gatewayId: gateway.id,
          privateKey: nip19.nsecEncode(secret),
        },
      }),
    ).rejects.toMatchObject({
      code: "authenticator_failed",
      message: "The authenticator could not create or use this Keytr passkey.",
    });
  });

  it("clears the key and requests best-effort cleanup when every relay rejects setup", async () => {
    const sourceSecret = generateSecretKey();
    const cleanup = vi.fn(async () => true);
    const library = keytrLibrary(sourceSecret, {
      publishKeytrEvent: vi.fn(async () => {
        const error = new Error("sensitive relay response");
        error.name = "RelayError";
        throw error;
      }),
      signalUnknownCredential: cleanup,
    });

    await expect(
      integration(library).connect("keytr", {
        keytr: { action: "create", gatewayId: gateway.id },
      }),
    ).rejects.toMatchObject({ code: "publish_failed" });
    expect(sourceSecret).toEqual(new Uint8Array(32));
    expect(cleanup).toHaveBeenCalledWith(gateway.rpId, credentialId);
  });

  it("maps browser, PRF, and relay failures without exposing upstream text", async () => {
    const secret = generateSecretKey();
    const cancelled = new DOMException("credential id 123", "NotAllowedError");
    await expect(
      integration(
        keytrLibrary(secret, {
          discoverPasskey: vi.fn(async () => {
            throw cancelled;
          }),
        }),
      ).connect("keytr", {
        keytr: { action: "login", gatewayId: gateway.id },
      }),
    ).rejects.toMatchObject({ code: "cancelled" });

    const unsupported = keytrLibrary(secret, {
      checkCapabilities: vi.fn(async () => ({
        webauthn: true,
        platformAuthenticator: false,
        prf: false,
        relatedOrigins: null,
        signalApi: false,
      })),
    });
    await expect(
      integration(unsupported).connect("keytr", {
        keytr: { action: "login", gatewayId: gateway.id },
      }),
    ).rejects.toMatchObject({ code: "unsupported" });

    const relayError = new Error("wss://private.invalid/token");
    relayError.name = "RelayError";
    await expect(
      integration(
        keytrLibrary(secret, {
          fetchKeytrEvents: vi.fn(async () => {
            throw relayError;
          }),
        }),
      ).connect(
        "keytr",
        { keytr: { action: "login", gatewayId: gateway.id } },
        { expectedPubkey: getPublicKey(secret) },
      ),
    ).rejects.toMatchObject({
      code: "relay_unavailable",
      message: "Keytr storage relays are temporarily unavailable.",
    });
  });

  it("supports local event signing and NIP-44, then fails closed after disposal", async () => {
    const secret = generateSecretKey();
    const signer = await integration(keytrLibrary(secret)).connect("keytr", {
      keytr: { action: "login", gatewayId: gateway.id },
    });
    const recipient = new SecretKeyRegistrySigner(generateSecretKey());
    const recipientPubkey = await recipient.getPublicKey();
    const event = await signer.signEvent({
      kind: 1,
      created_at: 1_800_000_001,
      content: "hello",
      tags: [],
    });
    expect(verifyEvent(event)).toBe(true);
    const encrypted = await signer.nip44!.encrypt(recipientPubkey, "private");
    await expect(
      recipient.nip44.decrypt(await signer.getPublicKey(), encrypted),
    ).resolves.toBe("private");

    signer.dispose?.();
    await expect(signer.signEvent(template())).rejects.toThrow(
      "no longer available",
    );
  });
});

describe("Keytr event validation", () => {
  it("accepts the padded base64url credential IDs emitted by Keytr", () => {
    const secret = generateSecretKey();
    const padded = signedEvent(secret, {
      tags: template().tags.map((tag) =>
        tag[0] === "d" ? ["d", `${dTag}==`] : tag,
      ),
    });

    expect(() =>
      validateCommunityKeytrEvent(padded, {
        expectedPubkey: getPublicKey(secret),
        rpId: gateway.rpId,
      }),
    ).not.toThrow();
  });

  it("accepts a valid signed PRF record", () => {
    const secret = generateSecretKey();
    expect(() =>
      validateCommunityKeytrEvent(signedEvent(secret), {
        expectedPubkey: getPublicKey(secret),
        rpId: gateway.rpId,
      }),
    ).not.toThrow();
  });

  it.each([
    ["wrong kind", { kind: 1 }],
    ["wrong RP ID", { tags: template("other.example").tags }],
    ["duplicate required tag", { tags: [...template().tags, ["v", "1"]] }],
    [
      "unsupported version",
      {
        tags: template().tags.map((tag) => (tag[0] === "v" ? ["v", "3"] : tag)),
      },
    ],
    ["oversized ciphertext", { content: "x".repeat(4_097) }],
  ])("rejects %s", (_label, mutation) => {
    const secret = generateSecretKey();
    expect(() =>
      validateCommunityKeytrEvent(signedEvent(secret, mutation), {
        expectedPubkey: getPublicKey(secret),
        rpId: gateway.rpId,
      }),
    ).toThrow(CommunityKeytrError);
  });

  it("rejects a bad signature and a different expected author", () => {
    const secret = generateSecretKey();
    const event = signedEvent(secret);
    const tampered = { ...event, content: "tampered" };
    expect(() =>
      validateCommunityKeytrEvent(tampered, { rpId: gateway.rpId }),
    ).toThrow(CommunityKeytrError);
    expect(() =>
      validateCommunityKeytrEvent(event, {
        expectedPubkey: getPublicKey(generateSecretKey()),
        rpId: gateway.rpId,
      }),
    ).toThrow(CommunityKeytrError);
  });
});
