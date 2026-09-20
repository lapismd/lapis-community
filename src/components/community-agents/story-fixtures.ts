import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type {
  CommunityAgentsState,
  CommunityAgentActivityItem,
  CommunityAgentMemoryState,
} from "../../community/agent-contracts.js";
export {
  storyAgentRuntime,
  storyPendingCatalogRuntime,
} from "./runtime-story-fixtures.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";
import {
  materializeAgentDirectory,
  materializeAgentPersonas,
} from "../../community/agent-protocol.js";

// Synthetic fixture identities, unrelated to any user or deployed relay.
export const storyAgentKey = new Uint8Array(32).fill(72);
const ownerKey = new Uint8Array(32).fill(21);
const relayKey = new Uint8Array(32).fill(22);
export const storyAgentPubkey = getPublicKey(storyAgentKey);
export const storyOwnerPubkey = getPublicKey(ownerKey);
export const storyRelayPubkey = getPublicKey(relayKey);
function ownedStoryProfile(key: Uint8Array, name: string, about: string) {
  const pubkey = getPublicKey(key);
  return finalizeEvent(
    {
      kind: 0,
      created_at: 1_700_000_000,
      tags: [
        [
          "auth",
          storyOwnerPubkey,
          "",
          bytesToHex(
            schnorr.sign(
              sha256(new TextEncoder().encode(`nostr:agent-auth:${pubkey}:`)),
              ownerKey,
            ),
          ),
        ],
      ],
      content: JSON.stringify({ name, about }),
    },
    key,
  );
}
export const storyAgentProfile = ownedStoryProfile(
  storyAgentKey,
  "Research",
  "Research and summarize project updates.",
);
export const storyAgent = {
  ...materializeAgentDirectory([storyAgentProfile], storyOwnerPubkey, "")[0]!,
  channelIds: ["general"],
  custody: {
    kind: "relay-managed" as const,
    state: "active" as const,
    connectionState: "active" as const,
    expiresAt: new Date(1_700_086_400_000).toISOString(),
  },
};
const storyPersonaEvent = finalizeEvent(
  {
    kind: 30175,
    created_at: 1_700_000_010,
    tags: [["d", "release-notes"]],
    content: JSON.stringify({
      display_name: "Release notes",
      description: "Summarize each release for the community.",
      avatar_url:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%236366f1'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-size='30'%3E%E2%9C%8D%3C/text%3E%3C/svg%3E",
      system_prompt: "Write concise release notes.",
    }),
  },
  ownerKey,
);
export const storyPersonas = materializeAgentPersonas(
  [storyPersonaEvent],
  storyOwnerPubkey,
);
export const storyGalleryAgents = [
  storyAgent,
  ...materializeAgentDirectory(
    [
      ownedStoryProfile(
        new Uint8Array(32).fill(73),
        "Build",
        "Build and test project changes.",
      ),
      ownedStoryProfile(
        new Uint8Array(32).fill(74),
        "Docs",
        "Keep the project documentation up to date.",
      ),
    ],
    storyOwnerPubkey,
    "",
  ),
];
export const storyAgentRooms: CommunityRoomModel[] = [
  {
    id: "general",
    groupId: "general",
    name: "general",
    kind: "channel",
    permissions: { manageMembers: { state: "enabled" } },
  },
  {
    id: "support",
    groupId: "support",
    name: "support",
    kind: "forum",
    permissions: { manageMembers: { state: "enabled" } },
  },
] as CommunityRoomModel[];
export const storyAgentMemories: CommunityAgentMemoryState = {
  channelId: "general",
  records: [
    {
      type: "candidate",
      candidateId: "candidate-1",
      kind: "preference",
      claim: "Summaries should lead with release blockers.",
      origin: "agent",
      status: "review",
      createdAt: 1_700_000_100,
      evidence: [
        {
          eventId: "a".repeat(64),
          evidenceHash: "b".repeat(64),
          conversationKey: "general",
          observedAt: 1_700_000_000,
        },
      ],
    },
  ],
};
const activityBaseTime = Math.floor(Date.now() / 1_000) - 12 * 60;
export function storyActivity(
  kind = "turn_started",
  payload: unknown = {},
  index = 1,
): CommunityAgentActivityItem {
  return {
    id: String(index),
    agentPubkey: storyAgentPubkey,
    createdAt: activityBaseTime + index * 60,
    frame: {
      version: 2,
      seq: index,
      timestamp: new Date((activityBaseTime + index * 60) * 1000).toISOString(),
      kind,
      channelId: "general",
      sessionId: "story",
      turnId: "turn",
      payload,
    },
  };
}
export function storyAgentState(
  patch: Partial<CommunityAgentsState> = {},
): CommunityAgentsState {
  return {
    status: "ready",
    agents: [storyAgent],
    personas: storyPersonas,
    archivedAgents: [storyAgent],
    capabilities: {
      directory: true,
      presence: true,
      activity: true,
      managedAgents: {
        version: 1,
        provisioningUrl: "https://local-relay.lapis.md/api/agents/managed",
        bunkerUrl: "wss://local-relay.lapis.md/nip46",
        relayPubkey: storyRelayPubkey,
        authorizationType: "lapis-managed-v1",
      },
    },
    presence: { [storyAgentPubkey]: { status: "online" } },
    working: { [storyAgentPubkey]: true },
    controllerScopes: {},
    pendingPermissions: {},
    partial: false,
    storageMode: "indexeddb",
    activity: [],
    activityLoading: false,
    hasOlder: false,
    ...patch,
  };
}
export const storyActivityItems = [
  storyActivity(
    "turn_completed",
    {
      entry: {
        id: "turn:turn",
        type: "turn",
        state: "completed",
        createdAt: new Date((activityBaseTime + 7 * 60) * 1000).toISOString(),
      },
    },
    7,
  ),
  storyActivity(
    "permission_resolved",
    {
      entry: {
        id: "turn:permission:review",
        type: "permission",
        requestId: "review",
        tool: "Publish report",
        options: ["allow_once", "reject_once"],
        state: "resolved",
        decision: "allow_once",
        createdAt: new Date((activityBaseTime + 6 * 60) * 1000).toISOString(),
      },
    },
    6,
  ),
  storyActivity(
    "assistant_message_chunk",
    {
      entry: {
        id: "turn:assistant",
        type: "message",
        role: "assistant",
        text: "Here are the project updates.",
        authorPubkey: storyAgentPubkey,
        createdAt: new Date((activityBaseTime + 5 * 60) * 1000).toISOString(),
      },
    },
    5,
  ),
  storyActivity(
    "tool_call_update",
    {
      entry: {
        id: "turn:tool:read",
        type: "tool",
        toolId: "read",
        name: "Read source",
        state: "completed",
        input: '{"path":"project.md"}',
        output: "Found three references",
        createdAt: new Date((activityBaseTime + 4 * 60) * 1000).toISOString(),
      },
    },
    4,
  ),
  storyActivity(
    "tool_call_update",
    {
      entry: {
        id: "turn:tool:read",
        type: "tool",
        toolId: "read",
        name: "Read source",
        state: "running",
        input: '{"path":"project.md"}',
        createdAt: new Date((activityBaseTime + 3 * 60) * 1000).toISOString(),
      },
    },
    3,
  ),
  storyActivity(
    "thinking_chunk",
    {
      entry: {
        id: "turn:thinking",
        type: "thinking",
        text: "I’ll review the source before answering.",
        state: "streaming",
        createdAt: new Date((activityBaseTime + 2 * 60) * 1000).toISOString(),
      },
    },
    2,
  ),
  storyActivity(
    "user_message",
    {
      entry: {
        id: "request-event",
        type: "message",
        role: "user",
        text: "Summarize the project updates.",
        authorPubkey: storyOwnerPubkey,
        sourceEventId: "a".repeat(64),
        createdAt: new Date((activityBaseTime + 60) * 1000).toISOString(),
      },
    },
    1,
  ),
];
