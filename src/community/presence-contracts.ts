import type { NostrEvent } from "../protocol/index.js";

export type CommunityPresenceStatus = "online" | "away" | "offline" | "unknown";
export type CommunityPresencePreference = "auto" | "away" | "offline";

export interface CommunityPresenceEntry {
  status: CommunityPresenceStatus;
  preference: CommunityPresencePreference;
  revision: number;
  observedAt: number;
  expiresAt: number;
}

export interface CommunityPresenceState {
  status: "loading" | "ready" | "unavailable" | "error";
  members: Readonly<Record<string, CommunityPresenceEntry>>;
  preference: CommunityPresencePreference;
  pending: boolean;
  error?: string | undefined;
}

export interface CommunityPresenceSession {
  start(
    listener: (state: CommunityPresenceState) => void,
    idleSeconds?: () => Promise<number | null>,
  ): void;
  watch(pubkeys: readonly string[]): void;
  setPreference(preference: CommunityPresencePreference): Promise<void>;
  close(): void;
}

export function parsePresenceEvent(
  event: NostrEvent,
  relay: string,
  now: number,
): { pubkey: string; entry: CommunityPresenceEntry } | undefined {
  if (
    event.kind !== 20001 ||
    event.pubkey !== relay ||
    event.created_at > now + 30 ||
    event.created_at < now - 180
  )
    return;
  const tag = (name: string) => {
    const matches = event.tags.filter((value) => value[0] === name);
    return matches.length === 1 && matches[0]?.length === 2
      ? matches[0][1]
      : undefined;
  };
  const pubkey = tag("p");
  const preference = tag("presence-mode");
  const revisionText = tag("presence-revision");
  const expiryText = tag("expiration");
  if (
    !pubkey ||
    !/^[a-f0-9]{64}$/.test(pubkey) ||
    !revisionText ||
    !expiryText ||
    !/^\d+$/.test(revisionText) ||
    !/^\d+$/.test(expiryText)
  )
    return;
  const revision = Number(revisionText),
    expiresAt = Number(expiryText);
  if (
    !Number.isSafeInteger(revision) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > event.created_at + 180 ||
    (preference !== "auto" && preference !== "away" && preference !== "offline")
  )
    return;
  const status =
    event.content === "online" ||
    event.content === "away" ||
    event.content === "offline"
      ? event.content
      : "unknown";
  return {
    pubkey,
    entry: {
      status,
      preference,
      revision,
      observedAt: event.created_at,
      expiresAt,
    },
  };
}

export function automaticPresence(
  lastActivity: number,
  now: number,
  idleSeconds: number | null = null,
): "online" | "away" {
  return (idleSeconds !== null ? idleSeconds * 1000 : now - lastActivity) >=
    600_000
    ? "away"
    : "online";
}
