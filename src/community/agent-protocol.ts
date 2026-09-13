import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";
import type { NostrEvent } from "../protocol/index.js";
import type {
  CommunityAgentIdentity,
  CommunityAgentInstance,
  CommunityAgentObserver,
  CommunityAgentPersona,
  CommunityAgentPresence,
} from "./agent-contracts.js";
import { copyNostrEvent } from "./verified-events.js";

export const AGENT_PROTOCOL_PIN = "cec5c8fd9280d30f56effac701e1e19d5cfe6fea";
export const AGENT_PRESENCE_TTL = 180;
export const AGENT_TYPING_TTL = 8;
export const AGENT_PUBKEY = /^[0-9a-f]{64}$/;
export const AGENT_PERSONA_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface AgentOwnerCredential {
  ownerPubkey: string;
  conditions: readonly { field: "kind" | "before" | "after"; value: number }[];
}

export function verifyAgentCredential(
  tag: readonly string[],
  agent: string,
): AgentOwnerCredential | undefined {
  if (
    tag.length !== 4 ||
    tag[0] !== "auth" ||
    !AGENT_PUBKEY.test(agent) ||
    !AGENT_PUBKEY.test(tag[1]!) ||
    tag[1] === agent ||
    !/^[0-9a-f]{128}$/.test(tag[3]!)
  )
    return;
  const conditions: AgentOwnerCredential["conditions"][number][] = [];
  if (tag[2] !== "") {
    for (const clause of tag[2]!.split("&")) {
      const match = /^(kind=|created_at<|created_at>)(0|[1-9][0-9]*)$/.exec(
        clause,
      );
      if (!match) return;
      const value = Number(match[2]);
      const field =
        match[1] === "kind="
          ? "kind"
          : match[1] === "created_at<"
            ? "before"
            : "after";
      if (
        !Number.isSafeInteger(value) ||
        value > (field === "kind" ? 65_535 : 4_294_967_295)
      )
        return;
      conditions.push({ field, value });
    }
  }
  try {
    const digest = sha256(
      new TextEncoder().encode(`nostr:agent-auth:${agent}:${tag[2]}`),
    );
    if (!schnorr.verify(hexToBytes(tag[3]!), digest, hexToBytes(tag[1]!)))
      return;
    return { ownerPubkey: tag[1]!, conditions };
  } catch {
    return;
  }
}

/** Always verify a fresh envelope at this external-data boundary. */
export function signedAgentEvent(input: unknown): NostrEvent | undefined {
  try {
    const event = copyNostrEvent(input as NostrEvent);
    return verifyEvent(event) ? event : undefined;
  } catch {
    return;
  }
}

export function agentOwner(profile: NostrEvent): string | undefined {
  if (profile.kind !== 0 || !signedAgentEvent(profile)) return;
  const tags = profile.tags.filter(([name]) => name === "auth");
  if (tags.length !== 1) return;
  const credential = verifyAgentCredential(tags[0]!, profile.pubkey);
  if (
    !credential ||
    credential.conditions.some(({ field, value }) =>
      field === "kind"
        ? profile.kind !== value
        : field === "before"
          ? profile.created_at >= value
          : profile.created_at <= value,
    )
  )
    return;
  return credential.ownerPubkey;
}

function managedAgentOwner(
  profile: NostrEvent,
  owner: string,
  relay: string,
): boolean {
  if (
    profile.kind !== 0 ||
    !signedAgentEvent(profile) ||
    !AGENT_PUBKEY.test(owner) ||
    !AGENT_PUBKEY.test(relay) ||
    profile.pubkey === owner
  )
    return false;
  const tags = profile.tags.filter(([name]) => name === "lapis-managed");
  return (
    tags.length === 1 &&
    tags[0]!.length === 3 &&
    tags[0]![1] === owner &&
    tags[0]![2] === relay
  );
}

export function agentTag(event: NostrEvent, name: string): string | undefined {
  const tags = event.tags.filter((tag) => tag[0] === name);
  return tags.length === 1 && tags[0]!.length >= 2 ? tags[0]![1] : undefined;
}

export function agentJson(content: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(content);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function newestAgentEvent(
  events: readonly NostrEvent[],
): NostrEvent | undefined {
  return events.toSorted(
    (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
  )[0];
}

function deleted(event: NostrEvent, events: readonly NostrEvent[]): boolean {
  const coordinate = `${event.kind}:${event.pubkey}:${agentTag(event, "d") ?? ""}`;
  return events.some(
    (candidate) =>
      candidate.kind === 5 &&
      candidate.pubkey === event.pubkey &&
      candidate.created_at >= event.created_at &&
      candidate.tags.some(
        ([name, value]) =>
          (name === "e" && value === event.id) ||
          (name === "a" && value === coordinate),
      ),
  );
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 4_096) : fallback;
}

export function agentPersona(
  event: NostrEvent,
  owner: string,
): CommunityAgentPersona | undefined {
  const slug = agentTag(event, "d");
  if (
    event.kind !== 30175 ||
    event.pubkey !== owner ||
    !AGENT_PERSONA_SLUG.test(slug ?? "")
  )
    return;
  const content = agentJson(event.content);
  const displayName = text(content.display_name).trim();
  if (!displayName) return;
  const avatarUrl = text(content.avatar_url).trim();
  const systemPrompt =
    typeof content.system_prompt === "string"
      ? content.system_prompt.slice(0, 65_535)
      : "";
  return {
    ownerPubkey: owner,
    slug: slug!,
    displayName,
    description: text(content.description),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    content,
    event,
  };
}

export function agentInstance(
  event: NostrEvent,
  owner: string,
): CommunityAgentInstance | undefined {
  const agentPubkey = agentTag(event, "d");
  if (
    event.kind !== 30177 ||
    event.pubkey !== owner ||
    !AGENT_PUBKEY.test(agentPubkey ?? "")
  )
    return;
  const content = agentJson(event.content);
  const personaId = text(content.persona_id).trim();
  const explicitMode = content.name_mode;
  const nameMode =
    explicitMode === "inherited" ? "inherited" : ("instance" as const);
  return {
    agentPubkey: agentPubkey!,
    ...(AGENT_PERSONA_SLUG.test(personaId) ? { personaId } : {}),
    name: text(content.name).trim(),
    nameMode,
    event,
  };
}

/** Current, signed relay membership; public channels need not include the viewer. */
export function agentChannelMemberships(
  input: readonly NostrEvent[],
  relay: string,
): Map<string, ReadonlySet<string>> {
  const events = input.flatMap((event) => {
    const verified = signedAgentEvent(event);
    return verified ? [verified] : [];
  });
  const candidates = new Map<string, NostrEvent[]>();
  for (const event of events) {
    const id = agentTag(event, "d");
    if (event.kind === 39002 && event.pubkey === relay && id)
      candidates.set(id, [...(candidates.get(id) ?? []), event]);
  }
  return new Map(
    [...candidates].flatMap(([id, snapshots]) => {
      const latest = newestAgentEvent(snapshots)!;
      return deleted(latest, events)
        ? []
        : [
            [
              id,
              new Set(
                latest.tags
                  .filter(([tag]) => tag === "p")
                  .map((tag) => tag[1]!),
              ),
            ] as const,
          ];
    }),
  );
}

export function materializeAgentDirectory(
  input: readonly NostrEvent[],
  owner: string,
  relay: string,
): CommunityAgentIdentity[] {
  const events = [
    ...new Map(
      input.flatMap((event) => {
        const verified = signedAgentEvent(event);
        return verified ? [[verified.id, verified] as const] : [];
      }),
    ).values(),
  ];
  const profiles = new Map<string, NostrEvent[]>();
  const instanceCandidates = new Map<string, NostrEvent[]>();
  const memberships = agentChannelMemberships(events, relay);
  for (const event of events) {
    if (event.kind === 0)
      profiles.set(event.pubkey, [
        ...(profiles.get(event.pubkey) ?? []),
        event,
      ]);
    else if (event.kind === 30177 && event.pubkey === owner) {
      const agentPubkey = agentTag(event, "d");
      if (agentPubkey)
        instanceCandidates.set(agentPubkey, [
          ...(instanceCandidates.get(agentPubkey) ?? []),
          event,
        ]);
    }
  }
  const personas = new Map(
    materializeAgentPersonas(events, owner).map((persona) => [
      persona.slug,
      persona,
    ]),
  );
  const instances = new Map<string, CommunityAgentInstance>();
  for (const [pubkey, candidates] of instanceCandidates) {
    const head = newestAgentEvent(candidates)!;
    if (deleted(head, events)) continue;
    const instance = agentInstance(head, owner);
    if (instance) instances.set(pubkey, instance);
  }
  const contacts = newestAgentEvent(
    events.filter((event) => event.kind === 3 && event.pubkey === owner),
  );
  const followed = new Set(
    contacts && !deleted(contacts, events)
      ? contacts.tags.filter(([tag]) => tag === "p").map((tag) => tag[1])
      : [],
  );
  const result: CommunityAgentIdentity[] = [];
  for (const [pubkey, candidates] of profiles) {
    const profile = newestAgentEvent(candidates)!;
    const instance = instances.get(pubkey);
    const ownedByExternalCredential = agentOwner(profile) === owner;
    const ownedByManagedCustody =
      instance !== undefined && managedAgentOwner(profile, owner, relay);
    if (
      deleted(profile, events) ||
      (!ownedByExternalCredential && !ownedByManagedCustody)
    )
      continue;
    const metadata = agentJson(profile.content);
    const persona = instance?.personaId
      ? personas.get(instance.personaId)
      : undefined;
    const extension = newestAgentEvent(
      events.filter((event) => event.kind === 10100 && event.pubkey === pubkey),
    );
    const extra =
      extension && !deleted(extension, events)
        ? agentJson(extension.content)
        : {};
    const picture = text(metadata.picture);
    const channelIds = [...memberships]
      .flatMap(([id, members]) => (members.has(pubkey) ? [id] : []))
      .sort();
    result.push({
      pubkey,
      ownerPubkey: owner,
      name:
        instance?.nameMode === "instance" && instance.name
          ? instance.name
          : persona
            ? persona.displayName
            : text(metadata.display_name) ||
              text(metadata.name) ||
              text(extra.name) ||
              `${pubkey.slice(0, 8)}…`,
      about: persona?.description || text(metadata.about),
      ...(persona?.avatarUrl
        ? { avatarUrl: persona.avatarUrl }
        : /^https?:\/\//.test(picture) || picture.startsWith("data:image/")
          ? { avatarUrl: picture }
          : {}),
      agentType: text(extra.agent_type) || text(metadata.agent_type) || "agent",
      channelIds,
      followed: followed.has(pubkey),
      ...(persona ? { persona } : {}),
      ...(instance ? { instance } : {}),
      personaStatus: instance?.personaId
        ? persona
          ? "linked"
          : "unresolved"
        : "none",
      profile,
    });
  }
  return result.sort(
    (a, b) => a.name.localeCompare(b.name) || a.pubkey.localeCompare(b.pubkey),
  );
}

export function materializeAgentPersonas(
  input: readonly NostrEvent[],
  owner: string,
): CommunityAgentPersona[] {
  const events = input.flatMap((event) => {
    const verified = signedAgentEvent(event);
    return verified ? [verified] : [];
  });
  const candidates = new Map<string, NostrEvent[]>();
  for (const event of events) {
    const slug = agentTag(event, "d");
    if (event.kind === 30175 && event.pubkey === owner && slug)
      candidates.set(slug, [...(candidates.get(slug) ?? []), event]);
  }
  return [...candidates]
    .flatMap(([slug, revisions]) => {
      const head = newestAgentEvent(revisions)!;
      if (deleted(head, events)) return [];
      const persona = agentPersona(head, owner);
      return persona ? [persona] : [];
    })
    .sort(
      (left, right) =>
        left.displayName.localeCompare(right.displayName) ||
        left.slug.localeCompare(right.slug),
    );
}

export function validateAgentTelemetry(
  event: NostrEvent,
  profile: NostrEvent,
  owner: string,
  now?: number,
  relay?: string,
  instance?: NostrEvent,
): boolean {
  const verifiedInstance = instance ? signedAgentEvent(instance) : undefined;
  const ownedByCurrentAuthorization =
    agentOwner(profile) === owner ||
    (relay !== undefined &&
      verifiedInstance !== undefined &&
      agentInstance(verifiedInstance, owner)?.agentPubkey === profile.pubkey &&
      managedAgentOwner(profile, owner, relay));
  if (
    event.kind !== 24200 ||
    !signedAgentEvent(event) ||
    !ownedByCurrentAuthorization ||
    event.pubkey !== profile.pubkey ||
    (now !== undefined && Math.abs(now - event.created_at) > 300)
  )
    return false;
  for (const [tag, expected] of [
    ["p", owner],
    ["agent", event.pubkey],
    ["frame", "telemetry"],
  ]) {
    const tags = event.tags.filter(([name]) => name === tag);
    if (tags.length !== 1 || tags[0]!.length !== 2 || tags[0]![1] !== expected)
      return false;
  }
  const channels = event.tags.filter(([name]) => name === "h");
  return (
    channels.length <= 1 &&
    channels.every((tag) => tag.length === 2 && !!tag[1]) &&
    event.content.length >= 132 &&
    event.content.length <= 87_472
  );
}

export function parseAgentObserver(
  plaintext: string,
): CommunityAgentObserver | undefined {
  if (new TextEncoder().encode(plaintext).byteLength > 65_535) return;
  const frame = agentJson(plaintext);
  if (
    frame.version !== 2 ||
    !Number.isSafeInteger(frame.seq) ||
    (frame.seq as number) < 0 ||
    typeof frame.timestamp !== "string" ||
    !Number.isFinite(Date.parse(frame.timestamp)) ||
    typeof frame.kind !== "string" ||
    frame.kind.length === 0 ||
    frame.kind.length > 128 ||
    !("payload" in frame)
  )
    return;
  for (const key of ["channelId", "sessionId", "turnId"])
    if (
      frame[key] !== undefined &&
      frame[key] !== null &&
      typeof frame[key] !== "string"
    )
      return;
  if (
    frame.streamId !== undefined &&
    (typeof frame.streamId !== "string" ||
      frame.streamId.length === 0 ||
      frame.streamId.length > 128)
  )
    return;
  if (
    frame.agentIndex !== undefined &&
    frame.agentIndex !== null &&
    (!Number.isSafeInteger(frame.agentIndex) ||
      (frame.agentIndex as number) < 0)
  )
    return;
  if (
    frame.startedAt !== undefined &&
    (typeof frame.startedAt !== "string" ||
      !Number.isFinite(Date.parse(frame.startedAt)))
  )
    return;
  return frame as unknown as CommunityAgentObserver;
}

export function agentPresence(
  event: NostrEvent,
  agent: string,
  relay: string,
  now: number,
): CommunityAgentPresence | undefined {
  if (
    event.kind !== 20001 ||
    !signedAgentEvent(event) ||
    event.created_at > now + 300
  )
    return;
  if (
    event.pubkey !== agent &&
    !(event.pubkey === relay && agentTag(event, "p") === agent)
  )
    return;
  const status = event.content.startsWith("{")
    ? agentJson(event.content).status
    : event.content;
  const expiration = agentTag(event, "expiration");
  const expiresAt =
    expiration && /^\d+$/.test(expiration)
      ? Math.min(Number(expiration), event.created_at + AGENT_PRESENCE_TTL)
      : event.created_at + AGENT_PRESENCE_TTL;
  return {
    status:
      expiresAt > now &&
      typeof status === "string" &&
      status.length > 0 &&
      status !== "offline"
        ? "online"
        : "unknown",
    updatedAt: event.created_at,
    expiresAt,
  };
}
