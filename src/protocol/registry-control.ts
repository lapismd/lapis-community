import type { NostrEvent } from "./types.js";
import {
  LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
  LAPIS_REGISTRY_HEAD_TOPIC,
} from "./nip29.js";

const REGISTRY_CONTROL_TOPICS = new Set([
  LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
  LAPIS_REGISTRY_HEAD_TOPIC,
]);

export function isRegistryPublisherAuthorizationEvent(
  event: NostrEvent,
): boolean {
  return (
    event.kind === 9 &&
    event.tags.some(
      (tag) => tag[0] === "t" && tag[1] === LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
    )
  );
}

export function isRegistryControlEvent(event: NostrEvent): boolean {
  return (
    event.kind === 9 &&
    event.tags.some(
      (tag) => tag[0] === "t" && REGISTRY_CONTROL_TOPICS.has(tag[1] ?? ""),
    )
  );
}
