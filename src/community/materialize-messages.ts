import type { CommunityRoomScope } from "./contracts.js";
import type { NostrEvent } from "../protocol/index.js";
import { COMMUNITY_MESSAGE_EDIT_KIND } from "./message-moderation.js";
import type {
  CommunityMessageModel,
  CommunityReactionModel,
  CommunityTopicModel,
} from "./workspace-model.js";
import {
  compareOldest,
  forumActivityTimestamp,
  newer,
  relativeTimestamp,
  timestamp,
  type Profile,
} from "./materialize-shared.js";

const CHANNEL_ACTIVITY_KINDS = new Set([9_000, 9_001, 9_007, 9_021, 9_022]);

export function messageModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  profiles: ReadonlyMap<string, Profile>,
  activeTopicId: string | undefined,
  asOf: number | undefined,
  identityPubkey: string | undefined,
): CommunityMessageModel[] {
  const kinds =
    room.kind === "channel"
      ? new Set([9, ...CHANNEL_ACTIVITY_KINDS])
      : new Set([11, 1_111]);
  const roomEvents = events.filter(
    (event) =>
      kinds.has(event.kind) &&
      event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
  );
  const selected =
    room.kind === "forum" && activeTopicId !== undefined
      ? roomEvents.filter(
          (event) =>
            event.id === activeTopicId ||
            event.tags.some(
              (tag) => tag[0] === "E" && tag[1] === activeTopicId,
            ),
        )
      : roomEvents;
  return selected
    .toSorted(compareOldest)
    .map((event) =>
      CHANNEL_ACTIVITY_KINDS.has(event.kind)
        ? channelActivityMessage(event)
        : eventMessage(event, events, profiles, asOf, identityPubkey),
    );
}

export function channelActivityMessage(
  event: NostrEvent,
): CommunityMessageModel {
  const targetMemberId =
    event.kind === 9_021 || event.kind === 9_022
      ? event.pubkey
      : event.tags.find((tag) => tag[0] === "p")?.[1];
  const type =
    event.kind === 9_007
      ? ("channel-created" as const)
      : event.kind === 9_000
        ? ("member-added" as const)
        : event.kind === 9_001
          ? ("member-removed" as const)
          : event.kind === 9_021
            ? ("member-joined" as const)
            : ("member-left" as const);
  return {
    id: event.id,
    authorId: event.pubkey,
    content: "",
    sourceEvent: event,
    activity: {
      type,
      ...(targetMemberId === undefined ? {} : { targetMemberId }),
    },
    timestamp: timestamp(event.created_at),
    createdAt: new Date(event.created_at * 1_000).toISOString(),
  };
}

export function eventMessage(
  event: NostrEvent,
  events: readonly NostrEvent[],
  _profiles: ReadonlyMap<string, Profile>,
  asOf: number | undefined,
  identityPubkey: string | undefined,
): CommunityMessageModel {
  const edit = latestMessageEdit(event, events);
  const renderedEvent = edit ?? event;
  const parentMessageId =
    event.tags.find((tag) => tag[0] === "e" && tag[3] === "reply")?.[1] ??
    event.tags.find((tag) => tag[0] === "e")?.[1];
  const replyKind = event.kind === 11 ? 1_111 : event.kind;
  const replies = events.filter(
    (candidate) =>
      candidate.kind === replyKind &&
      candidate.tags.some(
        (tag) => (tag[0] === "e" || tag[0] === "E") && tag[1] === event.id,
      ),
  );
  const orderedReplies = replies.toSorted(compareOldest);
  const replyCount = orderedReplies.length;
  const latestReply = orderedReplies.at(-1);
  const reactions = reactionModels(event.id, events, identityPubkey);
  const mentionPubkeys = [
    ...new Set(
      renderedEvent.tags
        .filter(
          (tag) => (tag[0] === "p" || tag[0] === "P") && tag[1] !== undefined,
        )
        .map((tag) => tag[1]!),
    ),
  ];
  return {
    id: event.id,
    authorId: event.pubkey,
    content: renderedEvent.content,
    sourceEvent: event,
    ...(edit === undefined ? {} : { edited: true }),
    ...(mentionPubkeys.length === 0 ? {} : { mentionPubkeys }),
    timestamp: timestamp(event.created_at),
    createdAt: new Date(event.created_at * 1_000).toISOString(),
    ...(parentMessageId === undefined ? {} : { parentMessageId }),
    ...(replyCount === 0
      ? {}
      : {
          replyCount,
          replyLabel: `${replyCount === 1 ? "1 reply" : `${replyCount} replies`}${
            latestReply === undefined || asOf === undefined
              ? ""
              : ` · last reply ${relativeTimestamp(latestReply.created_at, asOf)}`
          }`,
          ...(latestReply === undefined
            ? {}
            : {
                lastReplyAt: new Date(
                  latestReply.created_at * 1_000,
                ).toISOString(),
              }),
          replyParticipantIds: [
            ...new Set(
              orderedReplies.toReversed().map((reply) => reply.pubkey),
            ),
          ].slice(0, 3),
        }),
    ...(reactions.length === 0 ? {} : { reactions }),
  };
}

export function latestMessageEdit(
  target: NostrEvent,
  events: readonly NostrEvent[],
): NostrEvent | undefined {
  const groupId = target.tags.find((tag) => tag[0] === "h")?.[1];
  if (groupId === undefined) return undefined;
  return events
    .filter(
      (event) =>
        event.kind === COMMUNITY_MESSAGE_EDIT_KIND &&
        event.pubkey === target.pubkey &&
        event.content.trim() !== "" &&
        event.tags.some((tag) => tag[0] === "h" && tag[1] === groupId) &&
        event.tags.some((tag) => tag[0] === "e" && tag[1] === target.id),
    )
    .toSorted(
      (left, right) =>
        right.created_at - left.created_at || right.id.localeCompare(left.id),
    )[0];
}

export function reactionModels(
  eventId: string,
  events: readonly NostrEvent[],
  identityPubkey: string | undefined,
): CommunityReactionModel[] {
  const latest = new Map<string, NostrEvent>();
  for (const event of events) {
    if (
      event.kind !== 7 ||
      !event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId)
    ) {
      continue;
    }
    const key = `${event.pubkey}:${event.content}`;
    const current = latest.get(key);
    if (current === undefined || newer(event, current)) latest.set(key, event);
  }
  const groups = new Map<
    string,
    { count: number; selected: boolean; customEmojiUrl?: string }
  >();
  for (const event of latest.values()) {
    const current = groups.get(event.content) ?? { count: 0, selected: false };
    const customEmojiUrl = event.tags.find(
      (tag) => tag[0] === "emoji" && tag[1] === event.content,
    )?.[2];
    groups.set(event.content, {
      count: current.count + 1,
      selected: current.selected || event.pubkey === identityPubkey,
      ...((customEmojiUrl ?? current.customEmojiUrl)
        ? { customEmojiUrl: customEmojiUrl ?? current.customEmojiUrl }
        : {}),
    });
  }
  return [...groups]
    .map(([emoji, value]) => ({
      emoji: emoji === "+" ? "❤" : emoji,
      count: value.count,
      ...(value.selected ? { selected: true } : {}),
      ...(value.customEmojiUrl === undefined
        ? {}
        : { customEmojiUrl: value.customEmojiUrl }),
    }))
    .toSorted(
      (left, right) =>
        right.count - left.count || left.emoji.localeCompare(right.emoji),
    );
}

export function topicModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  _profiles: ReadonlyMap<string, Profile>,
  asOf: number | undefined,
): CommunityTopicModel[] {
  return events
    .filter(
      (event) =>
        event.kind === 11 &&
        event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
    )
    .toSorted((left, right) => compareOldest(right, left))
    .map((event) => {
      const replies = events.filter(
        (candidate) =>
          candidate.kind === 1_111 &&
          candidate.tags.some((tag) => tag[0] === "E" && tag[1] === event.id),
      );
      const orderedReplies = replies.toSorted(compareOldest);
      const lastActivityAt =
        orderedReplies.at(-1)?.created_at ?? event.created_at;
      return {
        id: event.id,
        title:
          event.tags.find((tag) => tag[0] === "title")?.[1] ??
          event.content.split(/\r?\n/u)[0]?.slice(0, 120) ??
          "Discussion",
        excerpt: event.content,
        authorId: event.pubkey,
        tags: event.tags
          .filter((tag) => tag[0] === "t")
          .flatMap((tag) => tag.slice(1)),
        replyCount: replies.length,
        participantIds: [
          ...new Set(orderedReplies.toReversed().map((reply) => reply.pubkey)),
        ].slice(0, 3),
        lastActivityLabel: forumActivityTimestamp(lastActivityAt, asOf),
      };
    });
}
