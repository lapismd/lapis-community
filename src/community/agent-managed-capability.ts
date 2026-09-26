import type { NostrEventTemplate } from "../protocol/nostr-event.js";
import type { CommunityManagedAgentCapability } from "./agent-contracts.js";
export function managedAgentCapability(
  input: unknown,
  relayHttpUrl: URL,
  relayPubkey: string,
  supportedNips: unknown[],
): CommunityManagedAgentCapability | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const value = input as Record<string, unknown>;
  if (
    value.version !== 1 ||
    value.authorization_type !== "lapis-managed-v1" ||
    value.relay_pubkey !== relayPubkey ||
    !supportedNips.some((nip) => String(nip) === "46") ||
    typeof value.provisioning_url !== "string" ||
    typeof value.bunker_url !== "string"
  )
    return;
  try {
    const provisioning = new URL(value.provisioning_url);
    const bunker = new URL(value.bunker_url);
    if (
      provisioning.origin !== relayHttpUrl.origin ||
      provisioning.pathname.replace(/\/$/u, "") !== "/api/agents/managed" ||
      (bunker.protocol !== "wss:" && bunker.protocol !== "ws:") ||
      bunker.host !== relayHttpUrl.host ||
      bunker.pathname.replace(/\/$/u, "") !== "/nip46"
    )
      return;
    return {
      version: 1,
      provisioningUrl: provisioning.toString().replace(/\/$/u, ""),
      bunkerUrl: bunker.toString().replace(/\/$/u, ""),
      relayPubkey,
      authorizationType: "lapis-managed-v1",
    };
  } catch {
    return;
  }
}

export function eventTemplate(input: unknown): input is NostrEventTemplate {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    value.kind === 0 &&
    typeof value.created_at === "number" &&
    typeof value.content === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every(
      (tag) =>
        Array.isArray(tag) && tag.every((item) => typeof item === "string"),
    )
  );
}
