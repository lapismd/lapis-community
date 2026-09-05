import type { NostrEvent } from "./types.js";

export const REGISTRY_PUBLISHER_AUTHORIZATION_TOPIC =
  "lapis-plugin-publisher-authorization";

export function isRegistryPublisherAuthorizationEvent(
  event: NostrEvent,
): boolean {
  return (
    event.kind === 9 &&
    event.tags.some(
      (tag) =>
        tag[0] === "t" && tag[1] === REGISTRY_PUBLISHER_AUTHORIZATION_TOPIC,
    )
  );
}
