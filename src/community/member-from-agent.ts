import type { CommunityAgentIdentity } from "./agent-contracts.js";
import { initials, shortKey } from "./materialize-shared.js";
import type { CommunityMemberModel } from "./workspace-model.js";

export type CommunityAgentIdentityFields = Pick<
  CommunityAgentIdentity,
  "pubkey" | "name" | "avatarUrl"
>;

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

export function applyAgentAvatars(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityAgentIdentityFields[],
): CommunityMemberModel[] {
  const avatars = new Map(
    agents.flatMap((agent) =>
      agent.avatarUrl ? [[agent.pubkey, agent.avatarUrl] as const] : [],
    ),
  );
  if (avatars.size === 0) return [...members];
  return members.map((member) => {
    const avatarUrl = avatars.get(member.id);
    if (!avatarUrl || member.avatarUrl === avatarUrl) return member;
    return { ...member, avatarUrl };
  });
}
