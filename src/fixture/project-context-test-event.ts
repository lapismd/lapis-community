import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
const agentPubkey = "9".repeat(64);
export function event(template: NostrEventTemplate, index: number): NostrEvent {
  return {
    ...template,
    id: index.toString(16).padStart(64, "0"),
    pubkey: agentPubkey,
    sig: "f".repeat(128),
  };
}
