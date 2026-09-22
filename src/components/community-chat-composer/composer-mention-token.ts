import { npubEncode } from "nostr-tools/nip19";

const HEX_PUBKEY = /^[0-9a-f]{64}$/u;

export function communityComposerMentionToken(
  pubkey: string,
): string | undefined {
  const id = pubkey.trim().toLowerCase();
  if (!HEX_PUBKEY.test(id)) return undefined;
  return `nostr:${npubEncode(id)}`;
}

export function communityComposerMentionInsert(member: {
  id: string;
  name: string;
}): string {
  const token = communityComposerMentionToken(member.id);
  if (token) return `${token} `;
  const name = member.name.trim();
  return name === "" ? "" : `@${name} `;
}
