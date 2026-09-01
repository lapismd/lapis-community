import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { createWrap } from "nostr-tools/nip59";
import { getEventHash, verifyEvent } from "nostr-tools/pure";

import {
  canonicalJson,
  type JsonObject,
  type NostrEvent,
} from "@lapismd/registry-protocol";

import type { RegistryPrivateSigner } from "./types.js";

const hex64 = /^[0-9a-f]{64}$/u;

export interface PrivateAttachmentDescriptor {
  name: string;
  mediaType: string;
  size: number;
  encryptedUrl: string;
  encryptedSha256: string;
  encryption: {
    algorithm: "xchacha20-poly1305";
    key: string;
    nonce: string;
  };
}

export interface PrivateSecurityMessage {
  schema: "lapis.registry.private-security-message/1";
  conversationId: string;
  messageId: string;
  type: "reply" | "report";
  body: string;
  replyToEventId?: string | undefined;
  attachments?: PrivateAttachmentDescriptor[] | undefined;
}

export interface PrivateSecurityEnvelope {
  senderPubkey: string;
  recipientPubkey: string;
  payload: PrivateSecurityMessage;
  rumor: PrivateRumor;
  seal: NostrEvent;
  wrap: NostrEvent;
}

export async function encryptPrivateAttachment(options: {
  bytes: Uint8Array;
  name: string;
  mediaType: string;
  upload: (encryptedBytes: Uint8Array) => Promise<string>;
  randomBytes?: (length: number) => Uint8Array;
}): Promise<PrivateAttachmentDescriptor> {
  if (options.bytes.length === 0) {
    throw new Error("Private attachment cannot be empty");
  }
  const secureRandom = options.randomBytes ?? randomBytes;
  const key = secureRandom(32);
  const nonce = secureRandom(24);
  if (key.length !== 32 || nonce.length !== 24) {
    throw new Error("Private attachment random source returned invalid bytes");
  }
  const encryptedBytes = xchacha20poly1305(key, nonce).encrypt(options.bytes);
  const encryptedUrl = await options.upload(encryptedBytes);
  const descriptor: PrivateAttachmentDescriptor = {
    name: options.name,
    mediaType: options.mediaType,
    size: options.bytes.length,
    encryptedUrl,
    encryptedSha256: bytesToHex(sha256(encryptedBytes)),
    encryption: {
      algorithm: "xchacha20-poly1305",
      key: base64.encode(key),
      nonce: base64.encode(nonce),
    },
  };
  assertAttachmentDescriptor(descriptor);
  return descriptor;
}

export function decryptPrivateAttachment(
  encryptedBytes: Uint8Array,
  descriptor: PrivateAttachmentDescriptor,
): Uint8Array {
  assertAttachmentDescriptor(descriptor);
  if (bytesToHex(sha256(encryptedBytes)) !== descriptor.encryptedSha256) {
    throw new Error("Private attachment ciphertext hash does not match");
  }
  const plaintext = xchacha20poly1305(
    base64.decode(descriptor.encryption.key),
    base64.decode(descriptor.encryption.nonce),
  ).decrypt(encryptedBytes);
  if (plaintext.length !== descriptor.size) {
    throw new Error("Private attachment plaintext size does not match");
  }
  return plaintext;
}

interface PrivateRumor {
  id: string;
  pubkey: string;
  kind: 14;
  created_at: number;
  tags: string[][];
  content: string;
}

export async function createPrivateSecurityGiftWrap(options: {
  signer: RegistryPrivateSigner;
  recipientPubkey: string;
  payload: PrivateSecurityMessage;
  createdAt?: number;
  random?: () => number;
}): Promise<PrivateSecurityEnvelope> {
  assertPubkey(options.recipientPubkey, "recipient");
  assertPrivateSecurityMessage(options.payload);
  const senderPubkey = await options.signer.getPublicKey();
  assertPubkey(senderPubkey, "sender");
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1_000);
  const rumorBase = {
    pubkey: senderPubkey,
    kind: 14 as const,
    created_at: createdAt,
    tags: [["p", options.recipientPubkey]],
    content: canonicalJson(options.payload as unknown as JsonObject),
  };
  const rumor: PrivateRumor = {
    ...rumorBase,
    id: getEventHash(rumorBase),
  };
  const seal = await options.signer.signEvent({
    kind: 13,
    created_at: obscureTimestamp(createdAt, options.random ?? Math.random),
    tags: [],
    content: await options.signer.nip44Encrypt(
      options.recipientPubkey,
      JSON.stringify(rumor),
    ),
  });
  const wrap = createWrap(seal, options.recipientPubkey);
  return {
    senderPubkey,
    recipientPubkey: options.recipientPubkey,
    payload: options.payload,
    rumor,
    seal,
    wrap,
  };
}

export async function unwrapPrivateSecurityGiftWrap(options: {
  signer: RegistryPrivateSigner;
  wrap: NostrEvent;
}): Promise<PrivateSecurityEnvelope> {
  const recipientPubkey = await options.signer.getPublicKey();
  assertPubkey(recipientPubkey, "recipient");
  if (!verifyEvent(options.wrap) || options.wrap.kind !== 1059) {
    throw new Error("Invalid NIP-59 gift wrap");
  }
  if (!exactRecipientTag(options.wrap.tags, recipientPubkey)) {
    throw new Error("Gift wrap is not addressed only to this signer");
  }

  const seal = parseEvent(
    await options.signer.nip44Decrypt(
      options.wrap.pubkey,
      options.wrap.content,
    ),
    "seal",
  );
  if (seal.kind !== 13 || seal.tags.length !== 0 || !verifyEvent(seal)) {
    throw new Error("Invalid NIP-59 seal");
  }
  const rumor = parseRumor(
    await options.signer.nip44Decrypt(seal.pubkey, seal.content),
  );
  if (
    rumor.pubkey !== seal.pubkey ||
    rumor.kind !== 14 ||
    getEventHash(rumor) !== rumor.id ||
    !exactRecipientTag(rumor.tags, recipientPubkey)
  ) {
    throw new Error("Invalid private security rumor");
  }
  const payload = parsePrivateSecurityMessage(rumor.content);
  return {
    senderPubkey: seal.pubkey,
    recipientPubkey,
    payload,
    rumor,
    seal,
    wrap: options.wrap,
  };
}

function parseEvent(value: string, label: string): NostrEvent {
  const parsed = parseJson(value, label);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid NIP-59 ${label}`);
  }
  return parsed as NostrEvent;
}

function parseRumor(value: string): PrivateRumor {
  return parseEvent(value, "rumor") as PrivateRumor;
}

function parsePrivateSecurityMessage(value: string): PrivateSecurityMessage {
  const parsed = parseJson(value, "private security payload");
  assertPrivateSecurityMessage(parsed);
  return parsed;
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`Invalid ${label} JSON`);
  }
}

function assertPrivateSecurityMessage(
  value: unknown,
): asserts value is PrivateSecurityMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid private security payload");
  }
  const payload = value as Partial<PrivateSecurityMessage>;
  if (
    payload.schema !== "lapis.registry.private-security-message/1" ||
    (payload.type !== "report" && payload.type !== "reply") ||
    !nonEmpty(payload.conversationId, 200) ||
    !nonEmpty(payload.messageId, 200) ||
    !nonEmpty(payload.body, 100_000) ||
    (payload.replyToEventId !== undefined &&
      !hex64.test(payload.replyToEventId)) ||
    (payload.attachments !== undefined &&
      (!Array.isArray(payload.attachments) ||
        payload.attachments.length > 20 ||
        payload.attachments.some(
          (attachment) => !validAttachmentDescriptor(attachment),
        )))
  ) {
    throw new Error("Invalid private security payload");
  }
}

function assertAttachmentDescriptor(
  value: unknown,
): asserts value is PrivateAttachmentDescriptor {
  if (!validAttachmentDescriptor(value)) {
    throw new Error("Invalid private attachment descriptor");
  }
}

function validAttachmentDescriptor(
  value: unknown,
): value is PrivateAttachmentDescriptor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const descriptor = value as Partial<PrivateAttachmentDescriptor>;
  return (
    nonEmpty(descriptor.name, 500) &&
    nonEmpty(descriptor.mediaType, 200) &&
    Number.isSafeInteger(descriptor.size) &&
    (descriptor.size ?? 0) > 0 &&
    nonEmpty(descriptor.encryptedUrl, 4_000) &&
    typeof descriptor.encryptedSha256 === "string" &&
    hex64.test(descriptor.encryptedSha256) &&
    descriptor.encryption?.algorithm === "xchacha20-poly1305" &&
    typeof descriptor.encryption.key === "string" &&
    typeof descriptor.encryption.nonce === "string" &&
    decodeLength(descriptor.encryption.key) === 32 &&
    decodeLength(descriptor.encryption.nonce) === 24
  );
}

function decodeLength(value: string): number {
  try {
    return base64.decode(value).length;
  } catch {
    return -1;
  }
}

function nonEmpty(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximum
  );
}

function assertPubkey(value: string, label: string): void {
  if (!hex64.test(value)) throw new Error(`Invalid ${label} public key`);
}

function exactRecipientTag(tags: string[][], pubkey: string): boolean {
  return tags.length === 1 && tags[0]?.[0] === "p" && tags[0]?.[1] === pubkey;
}

function obscureTimestamp(createdAt: number, random: () => number): number {
  return Math.max(0, Math.round(createdAt - random() * 2 * 24 * 60 * 60));
}
