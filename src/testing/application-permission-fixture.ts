import { matchFilter } from "nostr-tools/filter";
import { finalizeEvent } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import type { CommunityTestRuntime } from "./community-test-runtime.js";
import {
  storyAgentKey,
  storyAgentPubkey,
  storyOwnerPubkey,
} from "../components/community-agents/story-fixtures.js";

const sequences = new WeakMap<CommunityTestRuntime, number>();
export function storyPermission(expiresIn = 60000) {
  return {
    scopeKey: "relay/general/agent/thread/permission-root",
    requestId: "permission-request",
    tool: "Write the requested file",
    options: ["allow_once", "reject_once"],
    expiresAt: Date.now() + expiresIn,
  };
}
function storyActivity(
  runtime: CommunityTestRuntime,
  kind: string,
  payload: Record<string, unknown>,
) {
  const seq = (sequences.get(runtime) ?? 0) + 1;
  sequences.set(runtime, seq);
  return finalizeEvent(
    {
      kind: 24200,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["p", storyOwnerPubkey],
        ["agent", storyAgentPubkey],
        ["frame", "telemetry"],
        ["h", "general"],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          version: 2,
          seq,
          timestamp: new Date().toISOString(),
          kind,
          channelId: "general",
          sessionId: "permission-session",
          turnId: "story",
          payload,
        }),
        nip44.v2.utils.getConversationKey(storyAgentKey, storyOwnerPubkey),
      ),
    },
    storyAgentKey,
  );
}

export async function publishStoryActivity(
  runtime: CommunityTestRuntime,
  kind: string,
  payload: Record<string, unknown>,
) {
  await runtime.relay.publish(storyActivity(runtime, kind, payload));
}
/** Supply retained telemetry at the transport replay boundary for this fixture only. */
export function installStoryPermissionReplay(runtime: CommunityTestRuntime) {
  const event = storyActivity(
    runtime,
    "permission_requested",
    storyPermission(),
  );
  const subscribe = runtime.relay.subscribe.bind(runtime.relay);
  runtime.relay.subscribe = (filter, handlers, signal) =>
    subscribe(
      filter,
      {
        ...handlers,
        oneose: () => {
          if (matchFilter(filter, event)) handlers.onevent(event);
          handlers.oneose?.();
        },
      },
      signal,
    );
}
