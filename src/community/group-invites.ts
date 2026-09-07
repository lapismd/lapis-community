import { nip19 } from "nostr-tools";

import type { CommunityGroupInvite } from "./contracts.js";

export interface CommunityGroupInviteInput {
  groupId: string;
  relayUrl: string;
  relayPubkey: string;
  code: string;
}

export function createCommunityInviteCode(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function buildCommunityGroupInvite(
  input: CommunityGroupInviteInput,
): CommunityGroupInvite {
  const groupId = required(input.groupId, "Group ID");
  const code = required(input.code, "Invite code");
  const relayUrl = normalizeInviteRelayUrl(input.relayUrl);
  const relayPubkey = input.relayPubkey.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(relayPubkey)) {
    throw new Error(
      "Invite relay public key must be 64 hexadecimal characters",
    );
  }
  const address = nip19.naddrEncode({
    kind: 39_000,
    pubkey: relayPubkey,
    identifier: groupId,
    relays: [relayUrl],
  });
  return {
    uri: `nostr:${address}?invite=${encodeURIComponent(code)}`,
    code,
    groupId,
    relayUrl,
    relayPubkey,
  };
}

export function parseCommunityGroupInvite(value: string): CommunityGroupInvite {
  const normalized = value.trim().replace(/^nostr:/iu, "");
  const queryIndex = normalized.indexOf("?");
  const address =
    queryIndex === -1 ? normalized : normalized.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : normalized.slice(queryIndex + 1);
  let decoded: ReturnType<typeof nip19.decode>;
  try {
    decoded = nip19.decode(address);
  } catch {
    throw new Error("Enter a valid NIP-29 invite link");
  }
  if (decoded.type !== "naddr") {
    throw new Error("Invite link must contain a Nostr address");
  }
  const code = required(
    new URLSearchParams(query).get("invite") ?? "",
    "Invite code",
  );
  const data = decoded.data;
  if (data.kind !== 39_000) {
    throw new Error("Invite link does not reference a NIP-29 group");
  }
  const relayUrl = (data.relays ?? []).map(normalizeInviteRelayUrl)[0];
  if (relayUrl === undefined) {
    throw new Error("Invite link must include its community relay");
  }
  return buildCommunityGroupInvite({
    groupId: required(data.identifier, "Group ID"),
    relayUrl,
    relayPubkey: data.pubkey,
    code,
  });
}

export function normalizeInviteRelayUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invite link contains an invalid relay URL");
  }
  if (
    url.protocol !== "ws:" &&
    url.protocol !== "wss:" &&
    url.protocol !== "memory:"
  ) {
    throw new Error("Invite relay must use ws:// or wss://");
  }
  return url.toString();
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === "") throw new Error(`${label} is required`);
  return normalized;
}
