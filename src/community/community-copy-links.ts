import {
  buildCommunityChannelLink,
  buildCommunityMessageLink,
  buildCommunityProjectLink,
  buildCommunityRepoLink,
  parseAddressableCoordinate,
  type CommunityLinkBuilder,
} from "./community-links.js";
import { rootCommunityMessageId } from "./workspace-model.js";

export function communityCopiedMessageLink(input: {
  roomId: string;
  eventId: string;
  authorPubkey: string;
  relayUrl: string;
  threadRootId?: string;
  linkBuilder?: CommunityLinkBuilder;
}): string {
  return (
    input.linkBuilder?.message({
      eventId: input.eventId,
      authorPubkey: input.authorPubkey,
      relayUrl: input.relayUrl,
      channel: input.roomId,
      ...(input.threadRootId ? { threadRootId: input.threadRootId } : {}),
    }) ??
    buildCommunityMessageLink({
      roomId: input.roomId,
      eventId: input.eventId,
      ...(input.threadRootId ? { threadRootId: input.threadRootId } : {}),
    })
  );
}

export function communityCopiedRoomLink(input: {
  roomId: string;
  linkBuilder?: CommunityLinkBuilder;
  scope?: { id: string };
  room?: { id: string; kind: "channel" | "forum" };
}): string {
  return (
    (input.linkBuilder &&
      input.scope &&
      input.room &&
      input.linkBuilder.room?.(input.scope, input.room)) ||
    buildCommunityChannelLink(input.roomId)
  );
}

export function communityCopiedMessageLinkFromMessages(input: {
  roomKind: string;
  roomId: string;
  messageId: string;
  messages: readonly {
    id: string;
    authorId: string;
    parentMessageId?: string;
  }[];
  relayUrl?: string;
  linkBuilder?: CommunityLinkBuilder;
}): string | undefined {
  if (input.roomKind === "direct" || !input.relayUrl) return undefined;
  const message = input.messages.find((item) => item.id === input.messageId);
  if (!message) return undefined;
  const root = rootCommunityMessageId(input.messages, message.id);
  return communityCopiedMessageLink({
    roomId: input.roomId,
    eventId: message.id,
    authorPubkey: message.authorId,
    relayUrl: input.relayUrl,
    ...(root !== message.id ? { threadRootId: root } : {}),
    ...(input.linkBuilder ? { linkBuilder: input.linkBuilder } : {}),
  });
}

export function communityCopiedProjectRouteLink(input: {
  kind: "project" | "repository";
  coordinate: string;
  surface: string;
  commitSha?: string;
  revision?: string;
  linkBuilder?: CommunityLinkBuilder;
}): string | undefined {
  const parsed = parseAddressableCoordinate(input.coordinate);
  if (!parsed) return undefined;
  const defaultSurface = input.kind === "project" ? "activity" : "overview";
  const tab = input.surface === defaultSurface ? undefined : input.surface;
  if (input.kind === "project") {
    return (
      input.linkBuilder?.project?.({ owner: parsed.owner, d: parsed.d, tab }) ??
      buildCommunityProjectLink({ owner: parsed.owner, d: parsed.d, tab })
    );
  }
  const branch = input.surface === "files" ? input.revision : undefined;
  return (
    input.linkBuilder?.repo?.({
      owner: parsed.owner,
      d: parsed.d,
      tab,
      commit: input.commitSha,
      branch,
    }) ??
    buildCommunityRepoLink({
      owner: parsed.owner,
      d: parsed.d,
      tab,
      commit: input.commitSha,
      branch,
    })
  );
}
