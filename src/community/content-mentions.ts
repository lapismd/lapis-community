import { decode } from "nostr-tools/nip19";

export const CONTENT_MENTION_SOURCE =
  "nostr:((?:npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+)";

export interface ContentMentionMatch {
  value: string;
  pubkey: string;
  start: number;
  end: number;
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

export function contentMentionLabel(
  pubkey: string,
  source: string,
  members: readonly { id: string; name: string }[],
): string {
  const member = members.find((item) => item.id === pubkey);
  return member ? `@${member.name}` : source;
}
