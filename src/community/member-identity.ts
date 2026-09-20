import type { CommunityAgentIdentity } from "./agent-contracts.js";
import { initials, shortKey } from "./materialize-shared.js";
import type { CommunityMemberModel } from "./workspace-model.js";

export type CommunityAgentIdentityFields = Pick<
  CommunityAgentIdentity,
  "pubkey" | "name" | "avatarUrl"
>;

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

export function communityMemberFromAgent(
  agent: CommunityAgentIdentityFields,
): CommunityMemberModel {
  const name = agent.name.trim() || shortKey(agent.pubkey);
  return {
    id: agent.pubkey,
    name,
    handle: shortKey(agent.pubkey),
    initials: initials(name),
    ...(agent.avatarUrl === undefined ? {} : { avatarUrl: agent.avatarUrl }),
    kind: "agent",
  };
}

export function communityAgentIdentities(agents?: {
  agents?: readonly CommunityAgentIdentityFields[];
  archivedAgents?: readonly CommunityAgentIdentityFields[];
  publicAgents?: readonly CommunityAgentIdentityFields[];
}): CommunityAgentIdentityFields[] {
  return [
    ...new Map(
      [
        ...(agents?.publicAgents ?? []),
        ...(agents?.archivedAgents ?? []),
        ...(agents?.agents ?? []),
      ].map((agent) => [agent.pubkey, agent]),
    ).values(),
  ];
}

export function communityIdentityMembers(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityAgentIdentityFields[],
): readonly CommunityMemberModel[] {
  const uniqueAgents = communityAgentIdentities({ agents });
  const tagged = withCommunityMemberKinds(
    members,
    uniqueAgents.map((agent) => agent.pubkey),
  );
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
  const members = communityIdentityMembersFromState(model.members, agents);
  return members === model.members ? model : { ...model, members };
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
