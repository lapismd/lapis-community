import { verifyEvent } from "nostr-tools/pure";

import type { NostrEvent } from "../protocol/index.js";
import type {
  CommunityCustomEmoji,
  CommunitySettingsState,
} from "./contracts.js";

const EMPTY_PROFILE = {
  pubkey: "",
  displayName: "",
  username: "",
  about: "",
  picture: "",
} as const;

export function materializeCommunitySettings(
  events: readonly NostrEvent[],
  identityPubkey: string,
): CommunitySettingsState {
  // nostr-tools memoizes verification on the event object. Verify a shallow
  // copy so materialization remains read-only when a host stores events in a
  // Svelte state proxy or another immutable collection.
  const accepted = events.filter((event) => verifyEvent({ ...event }));
  const profileEvent = latest(
    accepted.filter(
      (event) => event.kind === 0 && event.pubkey === identityPubkey,
    ),
  );
  const profile = parseProfile(profileEvent, identityPubkey);
  const emojiSets = latestEmojiSets(accepted);
  const customEmojis = mergeEmojiSets(emojiSets, identityPubkey);

  return {
    identityConnected: identityPubkey !== "",
    profile,
    customEmojis,
  };
}

function parseProfile(
  event: NostrEvent | undefined,
  identityPubkey: string,
): CommunitySettingsState["profile"] {
  if (event === undefined) return { ...EMPTY_PROFILE, pubkey: identityPubkey };
  let content: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(event.content) as unknown;
    if (
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
    ) {
      content = parsed as Record<string, unknown>;
    }
  } catch {
    // Invalid profile JSON is ignored without preventing later valid updates.
  }
  return {
    pubkey: identityPubkey,
    displayName: stringValue(content.display_name),
    username: stringValue(content.name),
    about: stringValue(content.about),
    picture: stringValue(content.picture),
  };
}

function latestEmojiSets(events: readonly NostrEvent[]): NostrEvent[] {
  const selected = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 30_030) continue;
    const identifier = event.tags.find((tag) => tag[0] === "d")?.[1] ?? "";
    const key = `${event.pubkey}:${identifier}`;
    const current = selected.get(key);
    if (current === undefined || newer(event, current))
      selected.set(key, event);
  }
  return [...selected.values()];
}

function mergeEmojiSets(
  events: readonly NostrEvent[],
  identityPubkey: string,
): CommunityCustomEmoji[] {
  const selected = new Map<
    string,
    { emoji: CommunityCustomEmoji; event: NostrEvent }
  >();
  for (const event of events) {
    for (const tag of event.tags) {
      if (tag[0] !== "emoji" || !tag[1] || !tag[2]) continue;
      const shortcode = normalizeShortcode(tag[1]);
      if (shortcode === "") continue;
      const current = selected.get(shortcode);
      if (current !== undefined && !newer(event, current.event)) continue;
      selected.set(shortcode, {
        event,
        emoji: {
          shortcode,
          url: tag[2],
          ownerPubkey: event.pubkey,
          owned: event.pubkey === identityPubkey,
        },
      });
    }
  }
  return [...selected.values()]
    .map(({ emoji }) => emoji)
    .toSorted((left, right) => left.shortcode.localeCompare(right.shortcode));
}

export function normalizeShortcode(value: string): string {
  return value
    .trim()
    .replace(/^:+|:+$/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9_+-]/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function latest(events: readonly NostrEvent[]): NostrEvent | undefined {
  return events.toSorted((left, right) =>
    newer(left, right) ? -1 : newer(right, left) ? 1 : 0,
  )[0];
}

function newer(left: NostrEvent, right: NostrEvent): boolean {
  return (
    left.created_at > right.created_at ||
    (left.created_at === right.created_at && left.id > right.id)
  );
}
