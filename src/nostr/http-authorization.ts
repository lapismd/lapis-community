import type { NostrEvent } from "../protocol/index.js";

export function encodeNostrHttpAuthorization(event: NostrEvent): string {
  const bytes = new TextEncoder().encode(JSON.stringify(event));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Nostr ${globalThis.btoa(binary)}`;
}
