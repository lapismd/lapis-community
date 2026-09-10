import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type {
  CommunityAgentsState,
  CommunityAgentActivityItem,
} from "../../community/agent-contracts.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";
import { materializeAgentDirectory } from "../../community/agent-protocol.js";

// Synthetic fixture identities, unrelated to any user or deployed relay.
export const storyAgentKey = new Uint8Array(32).fill(72);
const ownerKey = new Uint8Array(32).fill(21);
export const storyAgentPubkey = getPublicKey(storyAgentKey);
export const storyOwnerPubkey = getPublicKey(ownerKey);
export const storyAgentProfile = finalizeEvent(
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
            sha256(
              new TextEncoder().encode(`nostr:agent-auth:${storyAgentPubkey}:`),
            ),
            ownerKey,
          ),
        ),
      ],
    ],
    content: JSON.stringify({
      name: "Research",
      about: "Research and summarize project updates.",
    }),
  },
  storyAgentKey,
);
export const storyAgent = {
  ...materializeAgentDirectory([storyAgentProfile], storyOwnerPubkey, "")[0]!,
  channelIds: ["general"],
};
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
export function storyActivity(
  kind = "turn_started",
  payload: unknown = {},
  index = 1,
): CommunityAgentActivityItem {
  return {
    id: String(index),
    agentPubkey: storyAgentPubkey,
    createdAt: 1_700_000_000 + index,
    frame: {
      seq: index,
      timestamp: new Date((1_700_000_000 + index) * 1000).toISOString(),
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
    archivedAgents: [storyAgent],
    capabilities: { directory: true, presence: true, activity: true },
    presence: { [storyAgentPubkey]: { status: "online" } },
    working: { [storyAgentPubkey]: true },
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
