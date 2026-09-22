import {
  applyAgentAvatars,
  communityAgentIdentities,
  communityMemberFromAgent,
  type CommunityAgentIdentityFields,
} from "./member-from-agent.js";
import type { CommunityMemberModel } from "./workspace-model.js";

export {
  applyAgentAvatars,
  communityAgentIdentities,
  communityMemberFromAgent,
  type CommunityAgentIdentityFields,
} from "./member-from-agent.js";

export function withCommunityMemberKinds(
  members: readonly CommunityMemberModel[],
  agentPubkeys: readonly string[],
): CommunityMemberModel[] {
  const agents = new Set(agentPubkeys);
  return members.map((member) => {
    if (agents.has(member.id)) {
      return member.kind === "agent" ? member : { ...member, kind: "agent" };
    }
    if (member.kind === undefined) return member;
    const { kind: _kind, ...rest } = member;
    return rest;
  });
}

export function presentKnownAgentMembers(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityAgentIdentityFields[],
): CommunityMemberModel[] {
  return applyAgentAvatars(
    withCommunityMemberKinds(
      members,
      agents.map((agent) => agent.pubkey),
    ),
    agents,
  );
}

export function communityIdentityMembers(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityAgentIdentityFields[],
): readonly CommunityMemberModel[] {
  const uniqueAgents = communityAgentIdentities({ agents });
  const tagged = presentKnownAgentMembers(members, uniqueAgents);
  const extras = uniqueAgents.filter(
    (agent) => !tagged.some((member) => member.id === agent.pubkey),
  );
  if (
    extras.length === 0 &&
    tagged.length === members.length &&
    tagged.every((member, index) => member === members[index])
  )
    return members;
  return [...tagged, ...extras.map(communityMemberFromAgent)];
}

export function presentCommunityIdentityModel<
  T extends { members: readonly CommunityMemberModel[] },
>(
  model: T,
  agents?: {
    agents?: readonly CommunityAgentIdentityFields[];
    archivedAgents?: readonly CommunityAgentIdentityFields[];
    publicAgents?: readonly CommunityAgentIdentityFields[];
  },
): T {
  const next = communityIdentityMembersFromState(model.members, agents);
  return next === model.members ? model : { ...model, members: next };
}

export function communityIdentityMembersFromState(
  members: readonly CommunityMemberModel[],
  agents?: {
    agents?: readonly CommunityAgentIdentityFields[];
    archivedAgents?: readonly CommunityAgentIdentityFields[];
    publicAgents?: readonly CommunityAgentIdentityFields[];
  },
): readonly CommunityMemberModel[] {
  return communityIdentityMembers(members, communityAgentIdentities(agents));
}
