export interface CommunityComposerAgentModel {
  pubkey: string;
  name: string;
  avatarUrl?: string;
  ownerPubkey: string;
  channelIds: readonly string[];
}

export interface CommunityComposerAudienceScope {
  ownerPubkey: string;
  channelId: string;
  threadRootId: string;
}

export function communityComposerAudienceScope(
  ownerPubkey: string | undefined,
  channelId: string | undefined,
  threadRootId: string | undefined,
): CommunityComposerAudienceScope | undefined {
  if (!ownerPubkey || !channelId || !threadRootId) return undefined;
  return { ownerPubkey, channelId, threadRootId };
}

export function initialThreadAgentPubkeys(
  mentionPubkeys: readonly string[] | undefined,
  agents: readonly CommunityComposerAgentModel[],
): string[] {
  const known = new Set(agents.map((agent) => agent.pubkey));
  return [...new Set(mentionPubkeys ?? [])].filter((pubkey) =>
    known.has(pubkey),
  );
}

export function communityComposerAgentsFromDirectory(
  agents: readonly {
    pubkey: string;
    name: string;
    avatarUrl?: string;
    ownerPubkey: string;
    channelIds: readonly string[];
  }[] = [],
): CommunityComposerAgentModel[] {
  return [
    ...new Map(
      agents.map((agent) => [
        agent.pubkey,
        {
          pubkey: agent.pubkey,
          name: agent.name,
          ownerPubkey: agent.ownerPubkey,
          channelIds: agent.channelIds,
          ...(agent.avatarUrl === undefined
            ? {}
            : { avatarUrl: agent.avatarUrl }),
        },
      ]),
    ).values(),
  ];
}

export function communityComposerAgentsFromState(agents?: {
  agents?: readonly CommunityComposerAgentModel[];
  publicAgents?: readonly CommunityComposerAgentModel[];
  archivedAgents?: readonly CommunityComposerAgentModel[];
}): CommunityComposerAgentModel[] {
  return communityComposerAgentsFromDirectory([
    ...(agents?.publicAgents ?? []),
    ...(agents?.archivedAgents ?? []),
    ...(agents?.agents ?? []),
  ]);
}

export function communityComposerAgentDisplayName(
  agents: readonly CommunityComposerAgentModel[],
  members: readonly { id: string; name: string }[],
): (pubkey: string) => string | undefined {
  const names = new Map<string, string>();
  for (const member of members) names.set(member.id, member.name);
  for (const agent of agents) names.set(agent.pubkey, agent.name);
  return (pubkey) => names.get(pubkey);
}
