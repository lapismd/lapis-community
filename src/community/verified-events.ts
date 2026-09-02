import { verifiedSymbol, verifyEvent } from "nostr-tools/pure";

import type { NostrEvent } from "../protocol/index.js";

type MemoizedNostrEvent = NostrEvent & { [verifiedSymbol]?: boolean };

export function copyNostrEvent(event: NostrEvent): NostrEvent {
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

/**
 * Verify an event without mutating an immutable caller-owned value. Events
 * accepted at the controller/runtime boundary keep nostr-tools' verification
 * marker, so later materializers can reuse the result without hashing again.
 */
export function verifiedNostrEvent(event: NostrEvent): NostrEvent | undefined {
  if ((event as MemoizedNostrEvent)[verifiedSymbol] === true) return event;
  const candidate = Object.isExtensible(event) ? event : copyNostrEvent(event);
  return verifyEvent(candidate) ? candidate : undefined;
}

export function isVerifiedNostrEvent(event: NostrEvent): boolean {
  if ((event as MemoizedNostrEvent)[verifiedSymbol] === true) return true;
  return verifyEvent(copyNostrEvent(event));
}
