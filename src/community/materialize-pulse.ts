import type { CommunityMemberModel } from "./workspace-model.js";
import type { NostrEvent } from "../protocol/index.js";

import type {
  CommunityPulseAgentIdentity,
  CommunityPulseAgentActivityModel,
  CommunityPulseFeedTab,
  CommunityPulseModel,
  CommunityPulseNoteModel,
} from "./contracts.js";
import { isVerifiedNostrEvent } from "./verified-events.js";

interface PulseProfile {
  name?: string;
  handle?: string;
  picture?: string;
}

export interface MaterializeCommunityPulseOptions {
  tab: CommunityPulseFeedTab;
  primaryEventIds: readonly string[];
  identityPubkey?: string;
  agents?: readonly CommunityPulseAgentIdentity[];
  asOf?: number;
  canDirectMessage?: boolean;
}

export function materializeCommunityPulse(
  input: readonly NostrEvent[],
  options: MaterializeCommunityPulseOptions,
): CommunityPulseModel {
  const events = distinctVerifiedEvents(input);
  const byId = new Map(events.map((event) => [event.id, event]));
  const deleted = deletedEventIds(events, byId);
  const profiles = pulseProfiles(events);
  const agents = new Map(
    (options.agents ?? []).map((agent) => [agent.pubkey, agent] as const),
  );
  const reactionsByTarget = new Map<string, NostrEvent[]>();
  for (const event of events) {
    if (event.kind !== 7 || event.content !== "+" || deleted.has(event.id))
      continue;
    const targetId = pulseEventTargetId(event);
    if (targetId === undefined) continue;
    reactionsByTarget.set(targetId, [
      ...(reactionsByTarget.get(targetId) ?? []),
      event,
    ]);
  }

  const member = (pubkey: string): CommunityMemberModel => {
    const profile = profiles.get(pubkey);
    const agent = agents.get(pubkey);
    const name = agent?.name ?? profile?.name ?? shortKey(pubkey);
    const handle = profile?.handle ?? shortKey(pubkey);
    const avatarUrl = agent?.avatarUrl ?? profile?.picture;
    return {
      id: pubkey,
      name,
      handle,
      initials: initials(name),
      ...(avatarUrl === undefined ? {} : { avatarUrl }),
      presence: "offline",
      ...(agent?.status === undefined ? {} : { status: agent.status }),
    };
  };

  const notes = options.primaryEventIds.flatMap((id) => {
    const event = byId.get(id);
    if (
      event?.kind !== 1 ||
      deleted.has(event.id) ||
      isNip34ProjectComment(event)
    ) {
      return [];
    }
    const parentId = pulseReplyParentId(event);
    const parentEvent = parentId === undefined ? undefined : byId.get(parentId);
    const reactions = reactionsByTarget.get(event.id) ?? [];
    const note: CommunityPulseNoteModel = {
      id: event.id,
      author: member(event.pubkey),
      content: event.content,
      createdAt: event.created_at,
      sourceEvent: event,
      mentionPubkeys: uniqueTagValues(event, "p"),
      ...(parentEvent?.kind !== 1 || deleted.has(parentEvent.id)
        ? {}
        : {
            parent: {
              id: parentEvent.id,
              author: member(parentEvent.pubkey),
              content: parentEvent.content,
            },
          }),
      likeCount: new Set(reactions.map((reaction) => reaction.pubkey)).size,
      likedByCurrentUser:
        options.identityPubkey !== undefined &&
        reactions.some(
          (reaction) => reaction.pubkey === options.identityPubkey,
        ),
      currentUserOwns:
        options.identityPubkey !== undefined &&
        event.pubkey === options.identityPubkey,
    };
    return [note];
  });

  const members = [
    ...new Map(
      notes
        .flatMap((note) => [note.author, note.parent?.author])
        .filter((candidate) => candidate !== undefined)
        .map((candidate) => [candidate.id, candidate] as const),
    ).values(),
  ];
  const agentActivities =
    options.tab === "agents"
      ? groupAgentActivities(notes, options.agents ?? [])
      : [];

  return {
    tab: options.tab,
    status: "ready",
    notes,
    agentActivities,
    members,
    ...(options.agents === undefined ? {} : { agents: options.agents }),
    canDirectMessage: options.canDirectMessage === true,
    lastUpdatedAt: options.asOf ?? Math.floor(Date.now() / 1_000),
  };
}

export function pulseReplyParentId(event: NostrEvent): string | undefined {
  const reply = event.tags.findLast(
    (tag) => tag[0] === "e" && tag[1] !== undefined && tag[3] === "reply",
  )?.[1];
  if (reply !== undefined) return reply;
  return event.tags.findLast(
    (tag) =>
      tag[0] === "e" &&
      tag[1] !== undefined &&
      (tag[3] === undefined || tag[3] === ""),
  )?.[1];
}

export function pulseEventTargetId(event: NostrEvent): string | undefined {
  return event.tags.findLast(
    (tag) => tag[0] === "e" && tag[1] !== undefined,
  )?.[1];
}

export function isNip34ProjectComment(event: NostrEvent): boolean {
  return event.tags.some(
    (tag) => tag[0] === "a" && tag[1]?.startsWith("30617:"),
  );
}

function groupAgentActivities(
  notes: readonly CommunityPulseNoteModel[],
  agents: readonly CommunityPulseAgentIdentity[],
): CommunityPulseAgentActivityModel[] {
  const agentsByPubkey = new Map(agents.map((agent) => [agent.pubkey, agent]));
  const groups: CommunityPulseAgentActivityModel[] = [];
  for (const note of notes) {
    const agent = agentsByPubkey.get(note.author.id);
    if (agent === undefined) continue;
    const previous = groups.at(-1);
    if (
      previous?.agent.pubkey === agent.pubkey &&
      previous.notes.at(-1) !== undefined &&
      previous.notes.at(-1)!.createdAt - note.createdAt <= 300
    ) {
      previous.notes = [...previous.notes, note];
      continue;
    }
    groups.push({ id: note.id, agent, notes: [note] });
  }
  return groups;
}

function distinctVerifiedEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return [
    ...new Map(
      events
        .filter(isVerifiedNostrEvent)
        .map((event) => [event.id, event] as const),
    ).values(),
  ].toSorted(
    (left, right) =>
      left.created_at - right.created_at || left.id.localeCompare(right.id),
  );
}

function deletedEventIds(
  events: readonly NostrEvent[],
  byId: ReadonlyMap<string, NostrEvent>,
): Set<string> {
  const deleted = new Set<string>();
  for (const event of events) {
    if (event.kind !== 5) continue;
    for (const targetId of uniqueTagValues(event, "e")) {
      if (byId.get(targetId)?.pubkey === event.pubkey) deleted.add(targetId);
    }
  }
  return deleted;
}

function pulseProfiles(
  events: readonly NostrEvent[],
): Map<string, PulseProfile> {
  const selected = new Map<
    string,
    { event: NostrEvent; profile: PulseProfile }
  >();
  for (const event of events) {
    if (event.kind !== 0) continue;
    let value: unknown;
    try {
      value = JSON.parse(event.content) as unknown;
    } catch {
      continue;
    }
    if (value === null || Array.isArray(value) || typeof value !== "object")
      continue;
    const candidate = value as Record<string, unknown>;
    const displayName = stringValue(candidate.display_name);
    const username = stringValue(candidate.name);
    const name = displayName ?? username;
    const picture = stringValue(candidate.picture);
    const current = selected.get(event.pubkey);
    if (
      current !== undefined &&
      (current.event.created_at > event.created_at ||
        (current.event.created_at === event.created_at &&
          current.event.id > event.id))
    ) {
      continue;
    }
    selected.set(event.pubkey, {
      event,
      profile: {
        ...(name === undefined ? {} : { name }),
        ...(username === undefined ? {} : { handle: username }),
        ...(picture === undefined ? {} : { picture }),
      },
    });
  }
  return new Map(
    [...selected].map(([pubkey, value]) => [pubkey, value.profile] as const),
  );
}

function uniqueTagValues(event: NostrEvent, name: string): string[] {
  return [
    ...new Set(
      event.tags
        .filter((tag) => tag[0] === name && tag[1] !== undefined)
        .map((tag) => tag[1]!),
    ),
  ];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function shortKey(pubkey: string): string {
  return pubkey.length <= 12
    ? pubkey
    : `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
}

function initials(value: string): string {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  return (
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
      : value.slice(0, 2)
  ).toLocaleUpperCase();
}
