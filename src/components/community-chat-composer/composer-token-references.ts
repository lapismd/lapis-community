import { npubEncode } from "nostr-tools/nip19";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { isSafeCommunityEmojiUrl } from "./model.js";

export interface CommunityComposerReferenceToken {
  token: string;
  kind: "mention" | "channel" | "emoji";
  memberId?: string;
}

export function communityComposerReferenceTokens(
  members: readonly CommunityMemberModel[],
  rooms: readonly CommunityRoomModel[],
  emojis: readonly CommunityCustomEmoji[],
  preferredMemberIds: readonly string[] = [],
): CommunityComposerReferenceToken[] {
  const mentions = new Map<string, CommunityMemberModel[]>();
  for (const member of members) {
    const token = `@${member.name.trim()}`;
    if (token.length <= 1) continue;
    const key = token.toLocaleLowerCase();
    mentions.set(key, [...(mentions.get(key) ?? []), member]);
  }

  const preferred = new Set(
    preferredMemberIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  const mentionTokens = [...mentions.entries()].flatMap(([, candidates]) => {
    const member = resolveComposerMentionMember(candidates, preferred);
    return member
      ? [
          {
            token: `@${member.name.trim()}`,
            kind: "mention" as const,
            memberId: member.id,
          },
        ]
      : [];
  });

  const otherTokens = [
    ...rooms
      .filter((room) => room.kind !== "direct" && room.archived !== true)
      .map((room) => ({
        token: `#${room.name.trim()}`,
        kind: "channel" as const,
      })),
    ...emojis
      .filter((emoji) => isSafeCommunityEmojiUrl(emoji.url))
      .map((emoji) => ({
        token: `:${emoji.shortcode.trim()}:`,
        kind: "emoji" as const,
      })),
  ].filter((candidate) => candidate.token.length > 1);

  const counts = new Map<string, number>();
  for (const candidate of otherTokens) {
    const key = candidate.token.toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [
    ...mentionTokens,
    ...communityComposerPublishedMentionTokens(members),
    ...otherTokens.filter(
      (candidate) => counts.get(candidate.token.toLocaleLowerCase()) === 1,
    ),
  ];
}

function communityComposerPublishedMentionTokens(
  members: readonly CommunityMemberModel[],
): CommunityComposerReferenceToken[] {
  return members.flatMap((member) => {
    const id = member.id.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/u.test(id)) return [];
    return [
      {
        token: `nostr:${npubEncode(id)}`,
        kind: "mention" as const,
        memberId: member.id,
      },
    ];
  });
}

export function composerPreferredMemberIds(
  selectedMentionPubkeys: readonly string[],
  lockedAgentPubkeys: readonly string[],
): string[] {
  return [
    ...new Set(
      [...selectedMentionPubkeys, ...lockedAgentPubkeys]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

export function composerTokenModelSignature(
  members: readonly CommunityMemberModel[],
  rooms: readonly CommunityRoomModel[],
  emojis: readonly CommunityCustomEmoji[],
  preferredMemberIds: readonly string[],
): string {
  return [
    ...members.map((member) => `member:${member.id}:${member.name}`),
    ...rooms.map(
      (room) =>
        `room:${room.id}:${room.name}:${room.kind}:${room.archived === true}`,
    ),
    ...emojis.map((emoji) => `emoji:${emoji.shortcode}:${emoji.url}`),
    ...preferredMemberIds.map((id) => `prefer:${id}`),
  ].join("\u0000");
}

export function resolveComposerMentionMember(
  candidates: readonly CommunityMemberModel[],
  preferredMemberIds: ReadonlySet<string>,
): CommunityMemberModel | undefined {
  if (candidates.length === 1) return candidates[0];
  const preferredHits = candidates.filter((member) =>
    preferredMemberIds.has(member.id.trim().toLowerCase()),
  );
  if (preferredHits.length === 1) return preferredHits[0];
  const pool = preferredHits.length > 0 ? preferredHits : candidates;
  const agents = pool.filter((member) => member.kind === "agent");
  return agents.length === 1 ? agents[0] : undefined;
}
