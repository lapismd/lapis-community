import type {
  CommunityAgentIdentity,
  CommunityAgentPersona,
} from "../../community/agent-contracts.js";
import { communityMemberFromAgent } from "../../community/member-identity.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";

export function communityAgentMember(
  agent: CommunityAgentIdentity,
): CommunityMemberModel {
  return communityMemberFromAgent(agent);
}

export function communityPersonaMember(
  persona: CommunityAgentPersona,
): CommunityMemberModel {
  return {
    id: `${persona.ownerPubkey}:${persona.slug}`,
    name: persona.displayName,
    handle: persona.slug,
    initials:
      persona.displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "P",
    ...(persona.avatarUrl ? { avatarUrl: persona.avatarUrl } : {}),
    kind: "agent",
  };
}
