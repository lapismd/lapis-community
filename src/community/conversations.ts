import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { decode } from "nostr-tools/nip19";
import type {
  CommunityPrivateEvent,
  CommunityReadCursor,
} from "./contracts.js";

/** Transport is part of identity: a Buzz DM never aliases an encrypted history. */
export type CommunityConversationReference =
  | { transport: "nip17"; participants: readonly string[] }
  | { transport: "buzz-dm"; relayUrl: string; groupId: string }
  | {
      transport: "nip29";
      relayUrl: string;
      groupId: string;
      threadId?: string;
    };

export function conversationKey(
  reference: CommunityConversationReference,
): string {
  return reference.transport === "nip17"
    ? JSON.stringify(["nip17", ...[...new Set(reference.participants)].sort()])
    : JSON.stringify([
        reference.transport,
        reference.relayUrl,
        reference.groupId,
        ...(reference.transport === "nip29" && reference.threadId
          ? [reference.threadId]
          : []),
      ]);
}
export function privateConversation(
  event: CommunityPrivateEvent,
): CommunityConversationReference & { transport: "nip17" } {
  return {
    transport: "nip17",
    participants: [
      ...new Set([
        event.pubkey,
        ...event.tags
          .filter((tag) => tag[0] === "p" && tag[1])
          .map((tag) => tag[1]!),
      ]),
    ].sort(),
  };
}
export function afterReadCursor(
  event: { created_at: number; id: string },
  cursor?: CommunityReadCursor,
): boolean {
  return (
    !cursor ||
    event.created_at > cursor.createdAt ||
    (event.created_at === cursor.createdAt && event.id > cursor.eventId)
  );
}
export function contentMentionPubkeys(content: string): string[] {
  const keys = new Set<string>();
  for (const match of content.matchAll(
    /nostr:((?:npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+)/gu,
  )) {
    try {
      const entity = decode(match[1]!);
      if (entity.type === "npub") keys.add(entity.data);
      else if (entity.type === "nprofile") keys.add(entity.data.pubkey);
    } catch {
      /* Ordinary malformed text is not a mention. */
    }
  }
  return [...keys];
}

export function directConversationHash(
  participants: readonly string[],
): string {
  return conversationHash({ transport: "nip17", participants });
}

export function conversationHash(
  reference: CommunityConversationReference,
): string {
  return bytesToHex(sha256(utf8ToBytes(conversationKey(reference))));
}
