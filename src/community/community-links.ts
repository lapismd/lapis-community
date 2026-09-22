export interface CommunityLinkBuilder {
  message(input: {
    eventId: string;
    authorPubkey: string;
    relayUrl: string;
    channel?: string;
    threadRootId?: string;
  }): string;
  room?(
    scope: { id: string },
    room: { id: string; kind: "channel" | "forum" },
  ): string;
  project?(input: { owner: string; d: string; tab?: string }): string;
  repo?(input: {
    owner: string;
    d: string;
    tab?: string;
    commit?: string;
  }): string;
}

export const COMMUNITY_LINK_SCHEME = "lapis-community:";
export const COMMUNITY_PROJECT_KIND = 30_621;
export const COMMUNITY_REPOSITORY_KIND = 30_617;

export type CommunityEntityLink =
  | { kind: "channel"; roomId: string }
  | {
      kind: "message";
      roomId: string;
      eventId: string;
      threadRootId?: string;
    }
  | { kind: "project"; owner: string; d: string; tab?: string }
  | {
      kind: "repo";
      owner: string;
      d: string;
      tab?: string;
      commit?: string;
    };

export type CommunityEntityLinkIcon =
  | "message-circle"
  | "hash"
  | "folder-kanban"
  | "folder-git-2"
  | "git-commit-horizontal"
  | "history";

export type CommunityEntityLinkKindAttr =
  | "message"
  | "channel"
  | "project"
  | "repository"
  | "log"
  | "oplog"
  | "commit";

const HEX64 = /^[a-f0-9]{64}$/u;
const COMMIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const TAB = /^[a-z0-9-]+$/u;

export function buildCommunityChannelLink(roomId: string): string {
  return `${COMMUNITY_LINK_SCHEME}//channel/${encodeURIComponent(requireId(roomId, "roomId"))}`;
}

export function buildCommunityMessageLink(input: {
  roomId: string;
  eventId: string;
  threadRootId?: string;
}): string {
  const params = new URLSearchParams();
  params.set("channel", requireId(input.roomId, "channel"));
  params.set("id", requireHex64(input.eventId, "id"));
  if (input.threadRootId)
    params.set("thread", requireHex64(input.threadRootId, "thread"));
  return `${COMMUNITY_LINK_SCHEME}//message?${params}`;
}

export function buildCommunityProjectLink(input: {
  owner: string;
  d: string;
  tab?: string;
}): string {
  return coordinateLink("project", input);
}

export function buildCommunityRepoLink(input: {
  owner: string;
  d: string;
  tab?: string;
  commit?: string;
}): string {
  return coordinateLink("repo", input);
}

export function communityEntityLinkHref(link: CommunityEntityLink): string {
  if (link.kind === "channel") return buildCommunityChannelLink(link.roomId);
  if (link.kind === "message") return buildCommunityMessageLink(link);
  if (link.kind === "project") return buildCommunityProjectLink(link);
  return buildCommunityRepoLink(link);
}

export function parseCommunityEntityLink(
  value: string,
): CommunityEntityLink | undefined {
  const href = trimLinkCandidate(value.trim());
  if (!href.startsWith(`${COMMUNITY_LINK_SCHEME}//`)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== COMMUNITY_LINK_SCHEME) return undefined;
  if (parsed.hostname === "channel") {
    const roomId = decodeSegment(parsed.pathname.replace(/^\/+/u, ""));
    return roomId && validId(roomId) ? { kind: "channel", roomId } : undefined;
  }
  if (parsed.hostname === "message") {
    const roomId = parsed.searchParams.get("channel") ?? "";
    const eventId = normalizeHex(parsed.searchParams.get("id"));
    const thread = normalizeHex(parsed.searchParams.get("thread"));
    if (!validId(roomId) || !eventId) return undefined;
    return {
      kind: "message",
      roomId,
      eventId,
      ...(thread ? { threadRootId: thread } : {}),
    };
  }
  if (parsed.hostname === "project" || parsed.hostname === "repo") {
    const owner = normalizeHex(parsed.searchParams.get("owner"));
    const d = parsed.searchParams.get("d") ?? "";
    const tab = parsed.searchParams.get("tab") ?? undefined;
    const commit = normalizeCommit(parsed.searchParams.get("commit"));
    if (!owner || !validId(d) || (tab !== undefined && !TAB.test(tab)))
      return undefined;
    if (parsed.hostname === "project") {
      return { kind: "project", owner, d, ...(tab ? { tab } : {}) };
    }
    return {
      kind: "repo",
      owner,
      d,
      ...(tab ? { tab } : {}),
      ...(commit ? { commit } : {}),
    };
  }
  return undefined;
}

export function parseAddressableCoordinate(
  value: string,
): { kind: number; owner: string; d: string } | undefined {
  const kindEnd = value.indexOf(":");
  const ownerEnd = kindEnd < 1 ? -1 : value.indexOf(":", kindEnd + 1);
  if (ownerEnd < 0) return undefined;
  const kind = Number(value.slice(0, kindEnd));
  const owner = normalizeHex(value.slice(kindEnd + 1, ownerEnd));
  const d = value.slice(ownerEnd + 1);
  if (!Number.isInteger(kind) || !owner || !validId(d)) return undefined;
  return { kind, owner, d };
}

export function communityProjectCoordinate(owner: string, d: string): string {
  return `${COMMUNITY_PROJECT_KIND}:${requireHex64(owner, "owner")}:${requireId(d, "d")}`;
}

export function communityRepositoryCoordinate(
  owner: string,
  d: string,
): string {
  return `${COMMUNITY_REPOSITORY_KIND}:${requireHex64(owner, "owner")}:${requireId(d, "d")}`;
}

function coordinateLink(
  host: "project" | "repo",
  input: { owner: string; d: string; tab?: string; commit?: string },
): string {
  const params = new URLSearchParams();
  params.set("owner", requireHex64(input.owner, "owner"));
  params.set("d", requireId(input.d, "d"));
  if (input.tab) {
    if (!TAB.test(input.tab)) throw new Error(`invalid tab: ${input.tab}`);
    params.set("tab", input.tab);
  }
  if (input.commit) params.set("commit", requireCommit(input.commit));
  return `${COMMUNITY_LINK_SCHEME}//${host}?${params}`;
}

export function trimLinkCandidate(value: string): string {
  return value.replace(/[),.;!?]+$/u, "");
}

export function validCommunityId(value: string): boolean {
  return validId(value);
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function validId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1024 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function normalizeHex(value: string | null | undefined): string | undefined {
  const hex = value?.trim().toLowerCase();
  return hex && HEX64.test(hex) ? hex : undefined;
}

function normalizeCommit(value: string | null | undefined): string | undefined {
  const hex = value?.trim().toLowerCase();
  return hex && COMMIT.test(hex) ? hex : undefined;
}

function requireId(value: string, name: string): string {
  if (!validId(value)) throw new Error(`invalid ${name}`);
  return value;
}

function requireHex64(value: string, name: string): string {
  const hex = normalizeHex(value);
  if (!hex) throw new Error(`invalid ${name}`);
  return hex;
}

function requireCommit(value: string): string {
  const hex = normalizeCommit(value);
  if (!hex) throw new Error("invalid commit");
  return hex;
}
