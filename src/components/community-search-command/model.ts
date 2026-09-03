import type { CommunitySearchResult } from "../../community/contracts.js";
import type { NostrEvent } from "../../protocol/index.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
} from "../community-workspace/model.js";

const SEARCH_MESSAGE_KINDS = new Set([9, 11, 1_111]);

export interface CommunitySearchProjection {
  messages: readonly CommunityMessageModel[];
  members: readonly CommunityMemberModel[];
}

export function projectCommunitySearchResults(
  results: readonly CommunitySearchResult[],
): CommunitySearchProjection {
  const messages: CommunityMessageModel[] = [];
  const profiles = new Map<
    string,
    { event: NostrEvent; member: CommunityMemberModel }
  >();

  for (const { event } of results) {
    if (SEARCH_MESSAGE_KINDS.has(event.kind)) {
      messages.push({
        id: event.id,
        authorId: event.pubkey,
        content: event.content,
        timestamp: new Date(event.created_at * 1_000)
          .toISOString()
          .slice(11, 16),
      });
      continue;
    }

    const member = communityMemberFromProfileEvent(event);
    if (member === undefined) continue;
    const current = profiles.get(event.pubkey);
    if (current === undefined || newer(event, current.event)) {
      profiles.set(event.pubkey, { event, member });
    }
  }

  return {
    messages,
    members: [...profiles.values()].map(({ member }) => member),
  };
}

function communityMemberFromProfileEvent(
  event: NostrEvent,
): CommunityMemberModel | undefined {
  if (event.kind !== 0) return undefined;
  const content = parseJsonObject(event.content);
  const name =
    (typeof content.display_name === "string" && content.display_name.trim()) ||
    (typeof content.name === "string" && content.name.trim()) ||
    event.pubkey.slice(0, 12);
  const picture =
    typeof content.picture === "string" && content.picture.trim() !== ""
      ? content.picture.trim()
      : undefined;

  return {
    id: event.pubkey,
    name,
    handle: event.pubkey.slice(0, 12),
    initials: name.slice(0, 2).toUpperCase(),
    ...(picture === undefined ? {} : { avatarUrl: picture }),
    presence: "offline",
  };
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function newer(left: NostrEvent, right: NostrEvent): boolean {
  return (
    left.created_at > right.created_at ||
    (left.created_at === right.created_at && left.id > right.id)
  );
}
