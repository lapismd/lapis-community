import type { NostrEvent } from "../../protocol/index.js";
import type { CommunityMessageModel } from "../../community/workspace-model.js";
export const eventTag = (event: NostrEvent, key: string) =>
  event.tags.find(([name]) => name === key)?.[1];
export function eventRoot(event: NostrEvent): string {
  return (
    event.tags.find(
      ([key, , , marker]) => key === "e" && marker === "root",
    )?.[1] ??
    eventTag(event, "E") ??
    event.id
  );
}
export function visibleEvents(events: readonly NostrEvent[]) {
  return events.filter(
    (event) =>
      !events.some(
        (deletion) =>
          deletion.kind === 5 &&
          deletion.pubkey === event.pubkey &&
          deletion.tags.some(([key, id]) => key === "e" && id === event.id),
      ),
  );
}
export function conversationMessage(
  event: NostrEvent,
  events: readonly NostrEvent[],
  memberId?: string,
): CommunityMessageModel {
  const active = visibleEvents(events);
  const reactions = new Map<
    string,
    { emoji: string; count: number; selected: boolean }
  >();
  const seen = new Set<string>();
  for (const reaction of active.filter(
    (item) =>
      item.kind === 7 &&
      item.tags.some(([key, id]) => key === "e" && id === event.id),
  )) {
    const key = `${reaction.pubkey}:${reaction.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = reactions.get(reaction.content) ?? {
      emoji: reaction.content,
      count: 0,
      selected: false,
    };
    group.count++;
    group.selected ||= reaction.pubkey === memberId;
    reactions.set(group.emoji, group);
  }
  const replies = active.filter(
    (item) =>
      [9, 1111, 1].includes(item.kind) &&
      item.tags.some(
        ([key, id, , marker]) =>
          key === "e" &&
          id === event.id &&
          (item.kind === 1111 || marker === "reply"),
      ),
  );
  return {
    id: event.id,
    authorId: event.pubkey,
    sourceEvent: event,
    content: event.content,
    createdAt: new Date(event.created_at * 1000).toISOString(),
    timestamp: new Date(event.created_at * 1000).toLocaleTimeString(),
    reactions: [...reactions.values()],
    replyCount: replies.length,
    ...(event.tags.find(
      ([key, , , marker]) =>
        key === "e" && (event.kind === 1111 || marker === "reply"),
    )?.[1]
      ? {
          parentMessageId: event.tags.find(
            ([key, , , marker]) =>
              key === "e" && (event.kind === 1111 || marker === "reply"),
          )![1]!,
        }
      : {}),
  };
}
