import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type {
  CommunityAgentsState,
  CommunityAgentActivityItem,
} from "../../community/agent-contracts.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";
import {
  materializeAgentDirectory,
  materializeAgentPersonas,
} from "../../community/agent-protocol.js";

// Synthetic fixture identities, unrelated to any user or deployed relay.
export const storyAgentKey = new Uint8Array(32).fill(72);
const ownerKey = new Uint8Array(32).fill(21);
export const storyAgentPubkey = getPublicKey(storyAgentKey);
export const storyOwnerPubkey = getPublicKey(ownerKey);
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
    capabilities: { directory: true, presence: true, activity: true },
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
  storyActivity("turn_finished", { text: "Research complete" }, 7),
  storyActivity("custom_status", { detail: "Awaiting review" }, 6),
  storyActivity("error", { message: "A source was unavailable" }, 5),
  storyActivity(
    "acp_read",
    {
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "plan",
          entries: [{ status: "completed", content: "Review the sources" }],
        },
      },
    },
    4,
  ),
  storyActivity(
    "acp_read",
    {
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "tool_call",
          title: "Read source",
          status: "completed",
          content: [{ text: "Found three references" }],
        },
      },
    },
    3,
  ),
  storyActivity(
    "acp_read",
    {
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Here are the project updates." },
        },
      },
    },
    2,
  ),
  storyActivity(),
];
