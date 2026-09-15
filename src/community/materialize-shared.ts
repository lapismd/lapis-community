import type { NostrEvent } from "../protocol/index.js";
import { isRegistryControlEvent } from "../protocol/registry-control.js";
import type { CommunityWorkspaceModel } from "./workspace-model.js";
import { isVerifiedNostrEvent } from "./verified-events.js";

export interface Profile {
  name: string;
  picture?: string;
}

export function compareOldest(left: NostrEvent, right: NostrEvent): number {
  return left.created_at - right.created_at || left.id.localeCompare(right.id);
}

export function newer(left: NostrEvent, right: NostrEvent): boolean {
  return (
    left.created_at > right.created_at ||
    (left.created_at === right.created_at && left.id > right.id)
  );
}

export function acceptedEvents(events: readonly NostrEvent[]): NostrEvent[] {
  const accepted = new Map<string, NostrEvent>();
  for (const event of events) {
    if (isVerifiedNostrEvent(event) && !isRegistryControlEvent(event)) {
      accepted.set(event.id, event);
    }
  }
  return [...accepted.values()].toSorted(compareOldest);
}

export function deletedEventIds(events: readonly NostrEvent[]): Set<string> {
  const authors = new Map(
    events.map((event) => [event.id, event.pubkey] as const),
  );
  const deleted = new Set<string>();
  for (const event of events) {
    if (event.kind !== 5 && event.kind !== 9_005) continue;
    for (const tag of event.tags) {
      if (tag[0] !== "e" || tag[1] === undefined) continue;
      if (event.kind === 9_005 || authors.get(tag[1]) === event.pubkey) {
        deleted.add(tag[1]);
      }
    }
  }
  return deleted;
}

export function profilesFrom(
  events: readonly NostrEvent[],
): Map<string, Profile> {
  const selected = new Map<string, { event: NostrEvent; profile: Profile }>();
  for (const event of events) {
    if (event.kind !== 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.content) as unknown;
    } catch {
      continue;
    }
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
      continue;
    const candidate = parsed as {
      display_name?: unknown;
      name?: unknown;
      picture?: unknown;
    };
    const name =
      typeof candidate.display_name === "string" &&
      candidate.display_name.trim() !== ""
        ? candidate.display_name.trim()
        : typeof candidate.name === "string" && candidate.name.trim() !== ""
          ? candidate.name.trim()
          : "";
    if (name === "") continue;
    const picture =
      typeof candidate.picture === "string" && candidate.picture.trim() !== ""
        ? candidate.picture.trim()
        : undefined;
    const current = selected.get(event.pubkey);
    if (current === undefined || newer(event, current.event)) {
      selected.set(event.pubkey, {
        event,
        profile: {
          name,
          ...(picture === undefined ? {} : { picture }),
        },
      });
    }
  }
  return new Map(
    [...selected].map(([pubkey, entry]) => [pubkey, entry.profile]),
  );
}

export function statusesFrom(
  events: readonly NostrEvent[],
): Map<string, string> {
  const selected = new Map<string, NostrEvent>();
  for (const event of events) {
    if (
      event.kind !== 30_315 ||
      !event.tags.some((tag) => tag[0] === "d" && tag[1] === "general")
    ) {
      continue;
    }
    const current = selected.get(event.pubkey);
    if (current === undefined || newer(event, current)) {
      selected.set(event.pubkey, event);
    }
  }
  return new Map(
    [...selected]
      .filter(([, event]) => event.content.trim() !== "")
      .map(([pubkey, event]) => [pubkey, event.content.trim()]),
  );
}
export function parseJsonObject(
  value: string | undefined,
): Record<string, unknown> {
  if (value === undefined || value.trim() === "") return {};
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

export function latestGroupState(
  events: readonly NostrEvent[],
  kind: number,
  groupId: string,
): NostrEvent | undefined {
  return events
    .filter(
      (event) =>
        event.kind === kind &&
        event.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
    )
    .toSorted((left, right) => compareOldest(right, left))[0];
}

export function latestGroupRoleState(
  events: readonly NostrEvent[],
  groupId: string,
  relayPubkey: string | undefined,
): NostrEvent | undefined {
  if (relayPubkey === undefined) return undefined;
  return events
    .filter(
      (event) =>
        event.kind === 39_003 &&
        event.pubkey === relayPubkey &&
        event.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
    )
    .toSorted((left, right) => compareOldest(right, left))[0];
}
export function emptyWorkspace(): CommunityWorkspaceModel {
  return {
    communities: [],
    activeCommunityId: "",
    navigationSections: [],
    activeRoomId: "",
    view: "channel",
    messages: [],
    topics: [],
    members: [],
    sidePanel: "none",
  };
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`
      : (parts[0]?.slice(0, 2) ?? "C")
  ).toUpperCase();
}

export function shortKey(value: string): string {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

export function timestamp(createdAt: number): string {
  return new Date(createdAt * 1_000).toISOString().slice(11, 16);
}

export function relativeTimestamp(createdAt: number, asOf: number): string {
  const elapsedSeconds = Math.max(0, asOf - createdAt);
  if (elapsedSeconds < 60) return "just now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
  }

  return `on ${new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(createdAt * 1_000)}`;
}

export function forumActivityTimestamp(
  createdAt: number,
  asOf: number | undefined,
): string {
  if (asOf === undefined) return timestamp(createdAt);

  const elapsedSeconds = Math.max(0, asOf - createdAt);
  if (elapsedSeconds < 60) return "now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d`;

  const activityDate = new Date(createdAt * 1_000);
  const currentDate = new Date(asOf * 1_000);
  return new Intl.DateTimeFormat("en", {
    ...(activityDate.getUTCFullYear() === currentDate.getUTCFullYear()
      ? { day: "numeric", month: "short" }
      : { month: "short", year: "numeric" }),
    timeZone: "UTC",
  }).format(activityDate);
}
