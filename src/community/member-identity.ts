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
): CommunityMemberModel[] {
  const uniqueAgents = communityAgentIdentities({ agents });
  const tagged = withCommunityMemberKinds(
    members,
    uniqueAgents.map((agent) => agent.pubkey),
  );
  const known = new Set(tagged.map((member) => member.id));
  return [
    ...tagged,
    ...uniqueAgents
      .filter((agent) => !known.has(agent.pubkey))
      .map(communityMemberFromAgent),
  ];
}

export function communityIdentityMembersFromState(
  members: readonly CommunityMemberModel[],
  agents?: {
    agents?: readonly CommunityAgentIdentityFields[];
    archivedAgents?: readonly CommunityAgentIdentityFields[];
    publicAgents?: readonly CommunityAgentIdentityFields[];
  },
): CommunityMemberModel[] {
  return communityIdentityMembers(members, communityAgentIdentities(agents));
}
