import { contentMentionPubkeys } from "./conversations.js";
import type { CommunityPrivateEvent } from "./contracts.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "./workspace-model.js";
import {
  initials,
  shortKey,
  timestamp,
  type Profile,
} from "./materialize-shared.js";

export interface DirectConversation {
  id: string;
  participants: readonly string[];
  events: readonly CommunityPrivateEvent[];
}

export function directConversationId(participants: readonly string[]): string {
  return `dm:${[...new Set(participants)].toSorted().join(",")}`;
}
export function directConversationModels(
  privateEvents: readonly CommunityPrivateEvent[],
  identityPubkey: string | undefined,
  pendingParticipants: Readonly<Record<string, readonly string[]>>,
): DirectConversation[] {
  if (identityPubkey === undefined) return [];
  const conversations = new Map<string, CommunityPrivateEvent[]>();
  const participantsById = new Map<string, readonly string[]>();
  for (const event of privateEvents) {
    const participants = [
      ...new Set([
        event.pubkey,
        ...event.tags
          .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
          .map((tag) => tag[1]!),
      ]),
    ].toSorted();
    if (!participants.includes(identityPubkey)) continue;
    const id = directConversationId(
      participants.filter((pubkey) => pubkey !== identityPubkey),
    );
    participantsById.set(id, participants);
    const current = conversations.get(id) ?? [];
    current.push(event);
    conversations.set(id, current);
  }
  for (const [id, participants] of Object.entries(pendingParticipants)) {
    participantsById.set(
      id,
      [...new Set([identityPubkey, ...participants])].toSorted(),
    );
    if (!conversations.has(id)) conversations.set(id, []);
  }
  return [...conversations]
    .map(([id, directEvents]) => ({
      id,
      participants: participantsById.get(id) ?? [identityPubkey],
      events: directEvents.toSorted(
        (left, right) =>
          left.created_at - right.created_at || left.id.localeCompare(right.id),
      ),
    }))
    .toSorted((left, right) => {
      const leftActivity = left.events.at(-1)?.created_at ?? 0;
      const rightActivity = right.events.at(-1)?.created_at ?? 0;
      return rightActivity - leftActivity || left.id.localeCompare(right.id);
    });
}

export function directRoomModel(
  conversation: DirectConversation,
  profiles: ReadonlyMap<string, Profile>,
  identityPubkey: string | undefined,
): CommunityRoomModel {
  const peers = conversation.participants.filter(
    (pubkey) => pubkey !== identityPubkey,
  );
  const displayPeers = peers.length > 0 ? peers : conversation.participants;
  return {
    id: conversation.id,
    name: displayPeers
      .map((pubkey) => profiles.get(pubkey)?.name ?? shortKey(pubkey))
      .join(", "),
    kind: "direct",
    conversation: {
      transport: "nip17",
      participants: conversation.participants,
    },
    participantIds: conversation.participants,
    memberCount: conversation.participants.length,
    private: true,
    membership: "joined",
    memberListCompleteness: "complete",
    lifecycle: "ongoing",
  };
}

export function directMemberModels(
  conversation: DirectConversation,
  profiles: ReadonlyMap<string, Profile>,
  statuses: ReadonlyMap<string, string>,
): CommunityMemberModel[] {
  return conversation.participants.map((pubkey) => {
    const name = profiles.get(pubkey)?.name ?? shortKey(pubkey);
    return {
      id: pubkey,
      name,
      handle: shortKey(pubkey),
      initials: initials(name),
      ...(profiles.get(pubkey)?.picture === undefined
        ? {}
        : { avatarUrl: profiles.get(pubkey)!.picture! }),
      presence: "offline",
      ...(statuses.get(pubkey) === undefined
        ? {}
        : { status: statuses.get(pubkey)! }),
    };
  });
}

export function directDeletedIds(
  conversation: DirectConversation,
): Set<string> {
  const authors = new Map(
    conversation.events.map((event) => [event.id, event.pubkey]),
  );
  return new Set(
    conversation.events
      .filter((event) => event.kind === 5)
      .flatMap((event) =>
        event.tags
          .filter(
            (tag) =>
              tag[0] === "e" &&
              tag[1] !== undefined &&
              authors.get(tag[1]) === event.pubkey,
          )
          .map((tag) => tag[1]!),
      ),
  );
}

export function directMessageModels(
  conversation: DirectConversation,
  identityPubkey: string | undefined,
  limit?: number,
): CommunityMessageModel[] {
  const deleted = directDeletedIds(conversation);
  const reactions = conversation.events.filter(
    (event) => event.kind === 7 && !deleted.has(event.id),
  );
  return conversation.events
    .filter((event) => event.kind === 14 && !deleted.has(event.id))
    .slice(-(limit ?? conversation.events.length))
    .map((event) => {
      const eventReactions = reactions.filter((reaction) =>
        reaction.tags.some((tag) => tag[0] === "e" && tag[1] === event.id),
      );
      const grouped = new Map<
        string,
        { count: number; selected: boolean; customEmojiUrl?: string }
      >();
      for (const reaction of eventReactions) {
        const current = grouped.get(reaction.content) ?? {
          count: 0,
          selected: false,
        };
        const customEmojiUrl = reaction.tags.find(
          (tag) => tag[0] === "emoji" && tag[1] === reaction.content,
        )?.[2];
        grouped.set(reaction.content, {
          count: current.count + 1,
          selected: current.selected || reaction.pubkey === identityPubkey,
          ...((customEmojiUrl ?? current.customEmojiUrl)
            ? { customEmojiUrl: customEmojiUrl ?? current.customEmojiUrl }
            : {}),
        });
      }
      const mentionPubkeys = contentMentionPubkeys(event.content);
      return {
        id: event.id,
        authorId: event.pubkey,
        content: event.content,
        ...(mentionPubkeys.length === 0 ? {} : { mentionPubkeys }),
        timestamp: timestamp(event.created_at),
        createdAt: new Date(event.created_at * 1_000).toISOString(),
        ...(event.tags.find((tag) => tag[0] === "e")?.[1] === undefined
          ? {}
          : {
              parentMessageId: event.tags.find((tag) => tag[0] === "e")![1]!,
            }),
        ...(grouped.size === 0
          ? {}
          : {
              reactions: [...grouped].map(([emoji, value]) => ({
                emoji,
                count: value.count,
                ...(value.selected ? { selected: true } : {}),
                ...(value.customEmojiUrl === undefined
                  ? {}
                  : { customEmojiUrl: value.customEmojiUrl }),
              })),
            }),
      };
    });
}
