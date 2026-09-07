import { verifyEvent } from "nostr-tools/pure";

import { COMMUNITY_MESSAGE_EDIT_KIND } from "../../community/message-moderation.js";
import type { RelayCountResult } from "../../nostr/index.js";
import { NIP29_KINDS, type NostrEvent } from "../../protocol/index.js";

export function selectRelayCount(
  results: readonly RelayCountResult[],
): RelayCountResult | undefined {
  const exact = results.filter((result) => !result.approximate);
  const candidates = exact.length > 0 ? exact : results;
  return candidates.toSorted(
    (left, right) =>
      right.count - left.count ||
      (left.hyperLogLog ?? "").localeCompare(right.hyperLogLog ?? ""),
  )[0];
}

export function parseRelayUrls(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => {
        try {
          const url = new URL(entry);
          return url.protocol === "ws:" || url.protocol === "wss:"
            ? url.toString()
            : undefined;
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is string => entry !== undefined)
      .filter((entry, index, entries) => entries.indexOf(entry) === index);
  } catch {
    return [];
  }
}

export function anyRelayPublished(
  results: readonly PromiseSettledResult<unknown>[],
): boolean {
  return results.some((result) => result.status === "fulfilled");
}

export function relayPublishFailureMessage(
  results: readonly PromiseSettledResult<unknown>[],
): string {
  const reasons = [
    ...new Set(
      results.flatMap((result) => {
        if (result.status !== "rejected") return [];
        return [
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        ];
      }),
    ),
  ].filter((reason) => reason.trim() !== "");
  return reasons.length === 0
    ? "No community relay accepted the signed event."
    : `No community relay accepted the signed event: ${reasons.join("; ")}`;
}

export function isValidNativeEmojiReaction(value: string): boolean {
  const reaction = value.trim();
  if (reaction === "") return false;
  const graphemes = [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      reaction,
    ),
  ];
  return (
    graphemes.length === 1 &&
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(reaction)
  );
}

export function parseProfiles(
  events: readonly NostrEvent[],
): CommunityProfile[] {
  const profiles = new Map<
    string,
    { event: NostrEvent; profile: CommunityProfile }
  >();
  for (const event of events) {
    if (event.kind !== 0) continue;
    let content: unknown;
    try {
      content = JSON.parse(event.content) as unknown;
    } catch {
      continue;
    }
    if (
      content === null ||
      Array.isArray(content) ||
      typeof content !== "object"
    ) {
      continue;
    }
    const candidate = content as {
      display_name?: unknown;
      name?: unknown;
      picture?: unknown;
      about?: unknown;
    };
    const displayName =
      typeof candidate.display_name === "string"
        ? candidate.display_name.trim()
        : "";
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";
    const selected = displayName || name;
    if (selected.length === 0 || selected.length > 100) continue;
    const picture = optionalProfileValue(candidate.picture, 2_048);
    const about = optionalProfileValue(candidate.about, 500);
    const current = profiles.get(event.pubkey);
    if (
      current === undefined ||
      event.created_at > current.event.created_at ||
      (event.created_at === current.event.created_at &&
        event.id > current.event.id)
    ) {
      profiles.set(event.pubkey, {
        event,
        profile: {
          pubkey: event.pubkey,
          name: selected,
          ...(picture === undefined ? {} : { picture }),
          ...(about === undefined ? {} : { about }),
        },
      });
    }
  }
  return [...profiles.values()]
    .map((entry) => entry.profile)
    .toSorted((left, right) => left.pubkey.localeCompare(right.pubkey));
}

export function displayName(
  pubkey: string,
  profiles: ReadonlyMap<string, CommunityProfile>,
): string {
  return profiles.get(pubkey)?.name ?? `nostr:${shortKey(pubkey)}`;
}

export function initials(value: string): string {
  const parts = value
    .replace(/^nostr:/u, "")
    .split(/[\s_-]+/u)
    .filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`
      : (parts[0]?.slice(0, 2) ?? "N")
  ).toUpperCase();
}

export function avatarHue(pubkey: string): number {
  return Number.parseInt(pubkey.slice(0, 6), 16) % 360;
}

export function reactionGroups(
  targetEventId: string,
  reactions: readonly ForumReaction[],
): ReactionGroup[] {
  const values = new Map<string, number>();
  for (const reaction of reactions) {
    if (reaction.targetEventId !== targetEventId) continue;
    values.set(reaction.content, (values.get(reaction.content) ?? 0) + 1);
  }
  return [...values.entries()]
    .map(([content, count]) => ({
      content,
      symbol: content === "+" ? "❤" : content,
      count,
    }))
    .toSorted(
      (left, right) =>
        right.count - left.count || left.content.localeCompare(right.content),
    );
}

export function materializeNip29Forum(
  events: readonly NostrEvent[],
  groupId: string,
): ForumPost[] {
  const verified = events.filter((event) => verifyEvent(event));
  const distinct = new Map(
    verified
      .filter(
        (event) =>
          (event.kind === NIP29_KINDS.forumThread ||
            event.kind === NIP29_KINDS.comment) &&
          event.tags.some((tag) => tag[0] === "h" && tag[1] === groupId),
      )
      .map((event) => [event.id, event] as const),
  );
  const deletedEventIds = new Set(
    verified
      .filter(
        (event) =>
          event.kind === 5 &&
          event.tags.some((tag) => tag[0] === "h" && tag[1] === groupId),
      )
      .flatMap((event) =>
        event.tags
          .filter((tag) => tag[0] === "e" && tag[1] !== undefined)
          .map((tag) => ({ eventId: tag[1]!, author: event.pubkey })),
      )
      .filter(({ eventId, author }) => distinct.get(eventId)?.pubkey === author)
      .map(({ eventId }) => eventId),
  );
  return [...distinct.values()]
    .filter((event) => !deletedEventIds.has(event.id))
    .map((event): ForumPost => {
      const edit = verified
        .filter(
          (candidate) =>
            candidate.kind === COMMUNITY_MESSAGE_EDIT_KIND &&
            candidate.pubkey === event.pubkey &&
            candidate.content.trim() !== "" &&
            candidate.tags.some(
              (tag) => tag[0] === "h" && tag[1] === groupId,
            ) &&
            candidate.tags.some((tag) => tag[0] === "e" && tag[1] === event.id),
        )
        .toSorted(
          (left, right) =>
            right.created_at - left.created_at ||
            right.id.localeCompare(left.id),
        )[0];
      const parentEventId =
        event.kind === NIP29_KINDS.comment
          ? event.tags.find((tag) => tag[0] === "e")?.[1]
          : undefined;
      const rootEventId =
        event.kind === NIP29_KINDS.forumThread
          ? event.id
          : (event.tags.find((tag) => tag[0] === "E")?.[1] ??
            parentEventId ??
            event.id);
      return {
        event,
        content: edit?.content ?? event.content,
        rootEventId,
        ...(parentEventId === undefined ? {} : { parentEventId }),
        ...(edit === undefined ? {} : { edited: true }),
      };
    })
    .toSorted(
      (left, right) =>
        left.event.created_at - right.event.created_at ||
        left.event.id.localeCompare(right.event.id),
    );
}

export function materializeNip29Reactions(
  events: readonly NostrEvent[],
  targetEventIds: ReadonlySet<string>,
): ForumReaction[] {
  return [
    ...new Map(
      events
        .filter(
          (event) =>
            event.kind === NIP29_KINDS.reaction &&
            verifyEvent(event) &&
            event.content.trim() !== "",
        )
        .flatMap((event) => {
          const targets = event.tags
            .filter((tag) => tag[0] === "e" && tag[1] !== undefined)
            .map((tag) => tag[1]!);
          return targets.length === 1 && targetEventIds.has(targets[0]!)
            ? [
                [
                  event.id,
                  {
                    event,
                    targetEventId: targets[0]!,
                    content: event.content,
                  },
                ] as const,
              ]
            : [];
        }),
    ).values(),
  ].toSorted(
    (left, right) =>
      left.event.created_at - right.event.created_at ||
      left.event.id.localeCompare(right.event.id),
  );
}

export function latestReactionByAuthor(
  reactions: readonly ForumReaction[],
  targetEventId: string,
): ForumReaction[] {
  const current = new Map<string, ForumReaction>();
  for (const reaction of reactions) {
    if (reaction.targetEventId !== targetEventId) continue;
    const previous = current.get(reaction.event.pubkey);
    if (
      previous === undefined ||
      reaction.event.created_at > previous.event.created_at ||
      (reaction.event.created_at === previous.event.created_at &&
        reaction.event.id > previous.event.id)
    ) {
      current.set(reaction.event.pubkey, reaction);
    }
  }
  return [...current.values()].toSorted((left, right) =>
    left.event.pubkey.localeCompare(right.event.pubkey),
  );
}

export function timelinePosition(index: number, total: number): number {
  if (total <= 1) return 0;
  return (Math.max(0, Math.min(index, total - 1)) / (total - 1)) * 100;
}

export function timelineIndexFromPosition(
  pointerPosition: number,
  trackLength: number,
  total: number,
  handleLength = 50,
): number {
  if (total <= 1 || trackLength <= handleLength) return 0;
  const availableLength = trackLength - handleLength;
  const handleStart = Math.max(
    0,
    Math.min(pointerPosition - handleLength / 2, availableLength),
  );
  return Math.round((handleStart / availableLength) * (total - 1));
}

export function shouldShowTimelineBack(
  currentIndex: number,
  lastReadIndex: number | undefined,
  total: number,
): boolean {
  if (lastReadIndex === undefined || total < 2) return false;
  const currentPost = currentIndex + 1;
  const lastReadPost = lastReadIndex + 1;
  return (
    lastReadPost > 3 &&
    lastReadPost - currentPost > 3 &&
    total - lastReadPost > 1
  );
}

export function timelineMarkersOverlap(
  currentIndex: number,
  markerIndex: number,
  total: number,
  trackLength: number,
  handleLength = 50,
): boolean {
  if (total < 2 || trackLength <= 0) return false;
  const availableLength = Math.max(0, trackLength - handleLength);
  const currentTop =
    (timelinePosition(currentIndex, total) / 100) * availableLength;
  const markerTop =
    (timelinePosition(markerIndex, total) / 100) * availableLength;
  return Math.abs(currentTop - markerTop) < handleLength;
}

export async function seekTimestampForCount(
  targetCount: number,
  latestTimestamp: number,
  totalCount: number,
  countUntil: (timestamp: number) => Promise<number>,
  bounds?: {
    lowerTimestamp: number;
    upperTimestamp: number;
    upperCount: number;
  },
): Promise<CountTimestamp> {
  if (targetCount <= 0 || totalCount <= 0 || latestTimestamp <= 0) {
    return { timestamp: 0, count: 0, probes: 0 };
  }
  if (targetCount >= totalCount) {
    return {
      timestamp: latestTimestamp,
      count: totalCount,
      probes: 0,
    };
  }

  let lower = Math.max(0, Math.floor(bounds?.lowerTimestamp ?? 0));
  let upper = Math.min(
    Math.floor(latestTimestamp),
    Math.floor(bounds?.upperTimestamp ?? latestTimestamp),
  );
  let upperCount = bounds?.upperCount ?? totalCount;
  if (lower > upper || upperCount < targetCount) {
    lower = 0;
    upper = Math.floor(latestTimestamp);
    upperCount = totalCount;
  }
  let probes = 0;
  while (lower < upper) {
    const candidate = lower + Math.floor((upper - lower) / 2);
    const count = await countUntil(candidate);
    probes += 1;
    if (count >= targetCount) {
      upper = candidate;
      upperCount = count;
    } else {
      lower = candidate + 1;
    }
  }
  if (lower !== upper || upperCount < targetCount) {
    upperCount = await countUntil(lower);
    probes += 1;
  }
  return { timestamp: lower, count: upperCount, probes };
}

export function timelineTimestamp(
  index: number,
  total: number,
  firstTimestamp: number,
  lastTimestamp: number,
): number {
  if (total <= 1 || lastTimestamp <= firstTimestamp) return firstTimestamp;
  const ratio = timelinePosition(index, total) / 100;
  return Math.round(firstTimestamp + (lastTimestamp - firstTimestamp) * ratio);
}

function shortKey(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function optionalProfileValue(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const selected = value.trim();
  return selected.length > 0 && selected.length <= maximumLength
    ? selected
    : undefined;
}
export interface CommunityProfile {
  pubkey: string;
  name: string;
  picture?: string;
  about?: string;
}

export interface ForumPost {
  event: NostrEvent;
  content: string;
  rootEventId: string;
  parentEventId?: string | undefined;
  edited?: boolean;
}

export interface ForumReaction {
  event: NostrEvent;
  targetEventId: string;
  content: string;
}

export interface ReactionGroup {
  content: string;
  symbol: string;
  count: number;
}

export interface CountTimestamp {
  timestamp: number;
  count: number;
  probes: number;
}
