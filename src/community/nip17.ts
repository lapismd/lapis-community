import { v2 as nip44 } from "nostr-tools/nip44";
import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  verifyEvent,
} from "nostr-tools/pure";

import type { NostrEvent, NostrTag } from "../protocol/index.js";

import type { CommunityIdentity, CommunityPrivateEvent } from "./contracts.js";

export interface CreateNip17GiftWrapsOptions {
  identity: CommunityIdentity;
  recipients: readonly string[];
  content: string;
  createdAt: number;
  conversationTitle?: string;
  replyToEventId?: string;
  eventKind?: 5 | 7 | 14;
  targetEventId?: string;
  customEmoji?: { shortcode: string; url: string };
  randomOffsetSeconds?: () => number;
}

interface Nip17Rumor {
  id: string;
  pubkey: string;
  created_at: number;
  kind: 5 | 7 | 14;
  tags: NostrTag[];
  content: string;
}

export async function createNip17GiftWraps(
  options: CreateNip17GiftWrapsOptions,
): Promise<NostrEvent[]> {
  const encryption = options.identity.nip44;
  if (encryption === undefined) {
    throw new Error("NIP-44 encryption is required for direct messages");
  }
  const sender = await options.identity.getPublicKey();
  const recipients = [...new Set(options.recipients)]
    .filter((pubkey) => pubkey !== sender)
    .toSorted();
  if (recipients.length === 0) {
    throw new Error("A direct message requires at least one recipient");
  }
  const tags: NostrTag[] = recipients.map((pubkey) => ["p", pubkey]);
  if (options.conversationTitle !== undefined) {
    tags.push(["subject", options.conversationTitle]);
  }
  if (options.replyToEventId !== undefined) {
    tags.push(["e", options.replyToEventId]);
  }
  if (options.targetEventId !== undefined) {
    tags.push(["e", options.targetEventId]);
  }
  if (options.customEmoji !== undefined) {
    tags.push([
      "emoji",
      options.customEmoji.shortcode,
      options.customEmoji.url,
    ]);
  }
  const rumorBase = {
    pubkey: sender,
    created_at: options.createdAt,
    kind: options.eventKind ?? 14,
    tags,
    content: options.content,
  };
  const rumor: Nip17Rumor = {
    ...rumorBase,
    id: getEventHash(rumorBase),
  };
  const deliveries = [...recipients, sender];
  const randomOffset =
    options.randomOffsetSeconds ??
    (() => Math.floor(Math.random() * 2 * 24 * 60 * 60));
  const wraps: NostrEvent[] = [];
  for (const recipient of deliveries) {
    const seal = await options.identity.signEvent({
      kind: 13,
      created_at: options.createdAt - randomOffset(),
      content: await encryption.encrypt(recipient, JSON.stringify(rumor)),
      tags: [],
    });
    const ephemeralKey = generateSecretKey();
    const conversationKey = nip44.utils.getConversationKey(
      ephemeralKey,
      recipient,
    );
    wraps.push(
      finalizeEvent(
        {
          kind: 1_059,
          created_at: options.createdAt - randomOffset(),
          content: nip44.encrypt(JSON.stringify(seal), conversationKey),
          tags: [["p", recipient]],
        },
        ephemeralKey,
      ),
    );
  }
  return wraps;
}

export async function unwrapNip17GiftWrap(
  identity: CommunityIdentity,
  wrap: NostrEvent,
): Promise<CommunityPrivateEvent> {
  if (identity.nip44 === undefined) {
    throw new Error("NIP-44 decryption is required for direct messages");
  }
  if (wrap.kind !== 1_059 || !verifyEvent(plainEvent(wrap))) {
    throw new Error("Invalid NIP-17 gift wrap");
  }
  const recipient = await identity.getPublicKey();
  if (!wrap.tags.some((tag) => tag[0] === "p" && tag[1] === recipient)) {
    throw new Error("NIP-17 gift wrap is addressed to another recipient");
  }
  const seal = parseSignedEvent(
    await identity.nip44.decrypt(wrap.pubkey, wrap.content),
  );
  if (seal.kind !== 13 || !verifyEvent(plainEvent(seal))) {
    throw new Error("Invalid NIP-17 seal");
  }
  const rumor = parseRumor(
    await identity.nip44.decrypt(seal.pubkey, seal.content),
  );
  if (rumor.pubkey !== seal.pubkey) {
    throw new Error("NIP-17 rumor author does not match its seal");
  }
  return {
    id: rumor.id,
    pubkey: rumor.pubkey,
    created_at: rumor.created_at,
    kind: rumor.kind,
    tags: rumor.tags,
    content: rumor.content,
    wrapId: wrap.id,
    recipientPubkey: recipient,
  };
}

function parseSignedEvent(value: string): NostrEvent {
  const parsed = JSON.parse(value) as unknown;
  if (!isEventShape(parsed) || typeof parsed.sig !== "string") {
    throw new Error("Malformed NIP-17 seal");
  }
  return parsed as NostrEvent;
}

function parseRumor(value: string): Nip17Rumor {
  const parsed = JSON.parse(value) as unknown;
  if (
    !isEventShape(parsed) ||
    ![5, 7, 14].includes(parsed.kind) ||
    typeof parsed.id !== "string" ||
    getEventHash({
      pubkey: parsed.pubkey,
      created_at: parsed.created_at,
      kind: parsed.kind,
      tags: parsed.tags,
      content: parsed.content,
    }) !== parsed.id
  ) {
    throw new Error("Malformed NIP-17 rumor");
  }
  return parsed as Nip17Rumor;
}

function isEventShape(value: unknown): value is {
  id?: string;
  sig?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
} {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event.pubkey === "string" &&
    typeof event.created_at === "number" &&
    typeof event.kind === "number" &&
    typeof event.content === "string" &&
    Array.isArray(event.tags) &&
    event.tags.every(
      (tag) =>
        Array.isArray(tag) && tag.every((entry) => typeof entry === "string"),
    )
  );
}

function plainEvent(event: NostrEvent): NostrEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    sig: event.sig,
  };
}
