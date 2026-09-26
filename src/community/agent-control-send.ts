import type { CommunitySigner } from "../auth/index.js";
import type {
  NostrEvent,
  NostrEventTemplate,
} from "../protocol/nostr-event.js";
import type { CommunityAgentControl } from "./agent-contracts.js";
import { AGENT_PUBKEY } from "./agent-protocol.js";
import { validateAgentControl } from "./agent-control-validation.js";
export async function sendAgentControl(
  options: {
    identity: CommunitySigner;
    now(): number;
    sign(
      template: NostrEventTemplate,
      signal?: AbortSignal,
    ): Promise<NostrEvent>;
    publish(
      event: NostrEvent,
      label: string,
      signal?: AbortSignal,
    ): Promise<void>;
  },
  agentPubkey: string,
  control: CommunityAgentControl,
  signal?: AbortSignal,
): Promise<NostrEvent> {
  signal?.throwIfAborted();
  if (!AGENT_PUBKEY.test(agentPubkey))
    throw new Error("Agent control requires a valid public key");
  const owner = await options.identity.getPublicKey();
  if (owner === agentPubkey)
    throw new Error("Agent control requires a distinct managed identity");
  const nip44 = options.identity.nip44;
  if (!nip44)
    throw new Error("Agent control requires a signer with NIP-44 support");
  validateAgentControl(control);
  const channelId = "channelId" in control ? control.channelId : undefined;
  const content = await nip44.encrypt(agentPubkey, JSON.stringify(control));
  signal?.throwIfAborted();
  const event = await options.sign(
    {
      kind: 24_200,
      created_at: options.now(),
      tags: [
        ["p", agentPubkey],
        ["agent", agentPubkey],
        ["frame", "control"],
        ...(channelId ? [["h", channelId]] : []),
      ],
      content,
    },
    signal,
  );
  await options.publish(event, "agent control", signal);
  return event;
}
