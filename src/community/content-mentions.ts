import { decode, npubEncode } from "nostr-tools/nip19";

export const CONTENT_MENTION_SOURCE =
  "nostr:((?:npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+)";

export interface ContentMentionMatch {
  value: string;
  pubkey: string;
  start: number;
  end: number;
}

export interface ContentMentionMember {
  id: string;
  name: string;
  handle: string;
  initials: string;
}

export function decodeContentMention(token: string): string | undefined {
  const encoded = token.startsWith("nostr:")
    ? token.slice("nostr:".length)
    : token;
  try {
    const entity = decode(encoded);
    if (entity.type === "npub") return entity.data;
    if (entity.type === "nprofile") return entity.data.pubkey;
  } catch {
    return undefined;
  }
}

export function contentMentionMatches(content: string): ContentMentionMatch[] {
  const matches: ContentMentionMatch[] = [];
  for (const match of content.matchAll(
    new RegExp(CONTENT_MENTION_SOURCE, "gu"),
  )) {
    const pubkey = decodeContentMention(match[1]!);
    if (!pubkey || match.index === undefined) continue;
    matches.push({
      value: match[0],
      pubkey,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return matches;
}

export function contentMentionPubkeys(content: string): string[] {
  return [
    ...new Set(contentMentionMatches(content).map((item) => item.pubkey)),
  ];
}

export function contentMentionFromHref(
  href: string | undefined,
): Pick<ContentMentionMatch, "value" | "pubkey"> | undefined {
  if (!href) return undefined;
  const match = new RegExp(`^${CONTENT_MENTION_SOURCE}$`, "u").exec(href);
  if (!match) return undefined;
  const pubkey = decodeContentMention(match[1]!);
  if (!pubkey) return undefined;
  return { value: match[0], pubkey };
}

export function truncatedContentMention(
  source: string,
  pubkey?: string,
): string {
  const hex = pubkey?.trim().toLowerCase();
  const encoded =
    hex && /^[0-9a-f]{64}$/u.test(hex)
      ? npubEncode(hex)
      : source.trim().replace(/^nostr:/u, "");
  return encoded.length <= 16
    ? encoded
    : `${encoded.slice(0, 12)}…${encoded.slice(-4)}`;
}

export function contentMentionFallbackMember(
  pubkey: string,
  source: string,
): ContentMentionMember | undefined {
  const id = pubkey.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(id)) return undefined;
  const handle = truncatedContentMention(source, id);
  return {
    id,
    name: handle,
    handle,
    initials: handle.replace(/^npub/iu, "").slice(0, 2).toUpperCase() || "?",
  };
}

export function contentMentionLabel(
  pubkey: string,
  source: string,
  members: readonly { id: string; name: string }[],
): string {
  const id = pubkey.trim().toLowerCase();
  const member = members.find((item) => item.id.trim().toLowerCase() === id);
  const name = member?.name.trim() ?? "";
  if (isUsableMentionName(name, id)) return `@${name}`;
  return `@${truncatedContentMention(source, id)}`;
}

function isUsableMentionName(name: string, pubkey: string): boolean {
  if (name === "") return false;
  const lower = name.toLowerCase();
  if (
    lower.startsWith("npub1") ||
    lower.startsWith("nprofile1") ||
    lower.startsWith("nostr:")
  ) {
    return false;
  }
  if (lower === pubkey) return false;
  if (name === pubkey.slice(0, 12)) return false;
  return true;
}
