import type { NostrEvent } from "../protocol/index.js";
import { verifyEvent } from "nostr-tools/pure";
import { copyNostrEvent } from "./verified-events.js";

export const COMMUNITY_CANVAS_KIND = 40_100;
export const COMMUNITY_CANVAS_MAX_BYTES = 65_536;

export function channelCanvasKey(communityId: string, roomId: string): string {
  return JSON.stringify([communityId, roomId]);
}

export function canvasReadingAllowed(
  events: readonly NostrEvent[],
  groupId: string,
  pubkey?: string,
): boolean {
  const valid = events
    .filter(
      (event) =>
        verifyEvent(copyNostrEvent(event)) &&
        event.tags.some(([name, value]) => name === "d" && value === groupId),
    )
    .toSorted(
      (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
    );
  const metadata = valid.find((event) => event.kind === 39_000);
  if (!metadata) return false;
  let privateChannel = metadata.tags.some(
    ([name]) => name === "private" || name === "hidden",
  );
  try {
    const content = JSON.parse(metadata.content || "{}");
    privateChannel ||= content.private === true || content.hidden === true;
  } catch {
    return false;
  }
  return (
    !privateChannel ||
    (!!pubkey &&
      valid
        .find(
          (event) => event.kind === 39_002 && event.pubkey === metadata.pubkey,
        )
        ?.tags.some(([name, value]) => name === "p" && value === pubkey) ===
        true)
  );
}

export function canvasEditingAllowed(
  events: readonly NostrEvent[],
  groupId: string,
  pubkey: string,
): boolean {
  const state = (kind: number) =>
    events
      .filter(
        (event) =>
          event.kind === kind &&
          verifyEvent(copyNostrEvent(event)) &&
          event.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
      )
      .toSorted(
        (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
      )[0];
  const metadata = state(39_000);
  const members = state(39_002);
  const admins = state(39_001);
  let archived = metadata?.tags.some((tag) => tag[0] === "archived") === true;
  try {
    archived ||= JSON.parse(metadata?.content || "{}").archived === true;
  } catch {
    return false;
  }
  return (
    !!metadata &&
    !archived &&
    members?.pubkey === metadata.pubkey &&
    admins?.pubkey === metadata.pubkey &&
    members.tags.some((tag) => tag[0] === "p" && tag[1] === pubkey) &&
    admins.tags.some((tag) => tag[0] === "p" && tag[1] === pubkey)
  );
}

/** One full-document snapshot, admitted by the channel's owning relay. */
export interface CommunityChannelCanvasModel {
  roomId: string;
  groupId: string;
  content: string;
  eventId: string | null;
  author: string | null;
  updatedAt: number | null;
  loading: boolean;
  canEdit: boolean;
  error?: string;
}

export class CommunityCanvasConflictError extends Error {
  constructor(readonly head: NostrEvent | null) {
    super(
      "The canvas changed. Review the latest version before saving your draft.",
    );
    this.name = "CommunityCanvasConflictError";
  }
}

export function validateCanvasContent(content: string): void {
  if (new TextEncoder().encode(content).byteLength > COMMUNITY_CANVAS_MAX_BYTES)
    throw new Error("Canvas content must be at most 64 KiB.");
}

/** Input must come from the owning relay, whose channel ACL admits snapshots. */
export function latestChannelCanvas(
  events: readonly NostrEvent[],
  groupId: string,
): NostrEvent | null {
  return (
    events
      .filter((event) => {
        const channels = event.tags.filter((tag) => tag[0] === "h");
        return (
          event.kind === COMMUNITY_CANVAS_KIND &&
          verifyEvent(copyNostrEvent(event)) &&
          channels.length === 1 &&
          channels[0]?.length === 2 &&
          channels[0][1] === groupId &&
          new TextEncoder().encode(event.content).byteLength <=
            COMMUNITY_CANVAS_MAX_BYTES
        );
      })
      .toSorted(
        (left, right) =>
          right.created_at - left.created_at || left.id.localeCompare(right.id),
      )[0] ?? null
  );
}
