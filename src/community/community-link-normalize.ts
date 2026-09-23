// prettier-ignore
import { decodeHashSegment, extractCommunityHash } from "./community-link-hash.js";
// prettier-ignore
import { COMMUNITY_HEX64, COMMUNITY_TAB, normalizeBranch, validCommunityId } from "./community-link-ids.js";
import {
  COMMUNITY_REPOSITORY_KIND,
  communityEntityLinkHref,
  parseAddressableCoordinate,
  parseCommunityEntityLink,
  trimLinkCandidate,
  type CommunityEntityLink,
  type CommunityEntityLinkIcon,
  type CommunityEntityLinkKindAttr,
} from "./community-links.js";

const AUTOLINK =
  /lapis-community:\/\/[^\s<>]+|#\/(?:channels|forums|projects)\/[^\s<>]+|https?:\/\/[^\s<>]+#\/(?:channels|forums|projects)\/[^\s<>]+/gu;

export function normalizeCommunityEntityHref(
  value: string,
): string | undefined {
  const trimmed = trimLinkCandidate(value.trim());
  const parsed = parseCommunityEntityLink(trimmed);
  if (parsed) return communityEntityLinkHref(parsed);
  const hash = extractCommunityHash(trimmed);
  const fromHash = hash ? entityLinkFromApplicationHash(hash) : undefined;
  return fromHash ? communityEntityLinkHref(fromHash) : undefined;
}

export function entityLinkFromApplicationHash(
  hash: string,
): CommunityEntityLink | undefined {
  const room = /^#\/(channels|forums)\/([^/]+)(?:\/([a-f0-9]{64}))?$/u.exec(
    hash,
  );
  if (room) {
    const roomId = decodeHashSegment(room[2] ?? "");
    const eventId = room[3];
    if (!roomId || !validCommunityId(roomId)) return undefined;
    return eventId
      ? { kind: "message", roomId, eventId }
      : { kind: "channel", roomId };
  }
  const filesHash =
    /^#\/projects\/repository\/([^/]+)\/([^/]+)\/files(?:\/.*)?$/u.exec(hash);
  if (filesHash) {
    const coordinate = parseAddressableCoordinate(
      decodeHashSegment(filesHash[1] ?? ""),
    );
    const branch = normalizeBranch(decodeHashSegment(filesHash[2] ?? ""));
    if (!coordinate || coordinate.kind !== COMMUNITY_REPOSITORY_KIND || !branch)
      return undefined;
    return {
      kind: "repo",
      owner: coordinate.owner,
      d: coordinate.d,
      tab: "files",
      branch,
    };
  }
  const project =
    /^#\/projects\/(project|repository)\/([^/]+)(?:\/([^/]+))?(?:\/([a-f0-9]{40}|[a-f0-9]{64}))?$/u.exec(
      hash,
    );
  if (!project) return undefined;
  const coordinate = parseAddressableCoordinate(
    decodeHashSegment(project[2] ?? ""),
  );
  if (!coordinate) return undefined;
  const surface = project[3];
  const commit = project[4];
  if (
    project[1] === "repository" &&
    surface === "tasks" &&
    commit &&
    COMMUNITY_HEX64.test(commit)
  ) {
    // prettier-ignore
    return { kind: "task", owner: coordinate.owner, d: coordinate.d, id: commit };
  }
  const tab =
    surface &&
    surface !== (project[1] === "project" ? "activity" : "overview") &&
    COMMUNITY_TAB.test(surface)
      ? surface
      : undefined;
  if (project[1] === "project") {
    return {
      kind: "project",
      owner: coordinate.owner,
      d: coordinate.d,
      ...(tab ? { tab } : {}),
    };
  }
  return {
    kind: "repo",
    owner: coordinate.owner,
    d: coordinate.d,
    ...(tab ? { tab } : {}),
    ...(commit ? { commit } : {}),
  };
}

export function communityEntityLinkMatches(content: string): Array<{
  value: string;
  href: string;
  start: number;
  end: number;
}> {
  const matches: Array<{
    value: string;
    href: string;
    start: number;
    end: number;
  }> = [];
  for (const match of content.matchAll(new RegExp(AUTOLINK.source, "gu"))) {
    if (match.index === undefined) continue;
    const value = trimLinkCandidate(match[0]);
    const href = normalizeCommunityEntityHref(value);
    if (!href) continue;
    matches.push({
      value,
      href,
      start: match.index,
      end: match.index + value.length,
    });
  }
  return matches;
}

export function communityEntityLinkLabel(
  link: CommunityEntityLink,
  rooms: readonly { id: string; name: string }[],
): string {
  const presentation = communityEntityLinkPresentation(link);
  if (link.kind === "channel" || link.kind === "message") {
    return (
      rooms.find((room) => room.id === link.roomId)?.name ??
      presentation.fallbackLabel
    );
  }
  return presentation.fallbackLabel;
}

export function communityEntityLinkPresentation(link: CommunityEntityLink): {
  linkKind: CommunityEntityLinkKindAttr;
  icon: CommunityEntityLinkIcon;
  fallbackLabel: string;
} {
  if (link.kind === "channel") {
    return { linkKind: "channel", icon: "hash", fallbackLabel: link.roomId };
  }
  if (link.kind === "message") {
    return {
      linkKind: "message",
      icon: "message-circle",
      fallbackLabel: `${link.eventId.slice(0, 8)}…`,
    };
  }
  if (link.kind === "project") {
    return {
      linkKind: "project",
      icon: "folder-kanban",
      fallbackLabel: link.d,
    };
  }
  if (link.kind === "task") {
    return {
      linkKind: "task",
      icon: "circle-dot",
      fallbackLabel: link.d,
    };
  }
  if (link.tab === "oplog") {
    return {
      linkKind: "oplog",
      icon: "history",
      fallbackLabel: link.commit ? link.commit.slice(0, 8) : link.d,
    };
  }
  if (link.tab === "log" || (link.tab === "commits" && link.commit)) {
    return {
      linkKind: link.tab === "log" ? "log" : "commit",
      icon: "git-commit-horizontal",
      fallbackLabel: link.commit ? link.commit.slice(0, 8) : link.d,
    };
  }
  return {
    linkKind: "repository",
    icon: "folder-git-2",
    fallbackLabel: link.d,
  };
}
