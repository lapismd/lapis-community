import { communityMemberFromAgent } from "../../community/member-identity.js";
import type { CommunityMemberModel } from "../../community/workspace-model.js";
import type { CommunityComposerAgentModel } from "./composer-agent-model.js";
import { tokenAppears } from "./model.js";

export function readComposerAudienceView(audience: {
  addressedMembers(): CommunityMemberModel[];
  enabled(): boolean;
  audiencePubkeys(): string[];
  mentionButtonMember(): CommunityMemberModel | undefined;
}): {
  addressedAgents: CommunityMemberModel[];
  autoMentionEnabled: boolean;
  lockedAgentPubkeys: string[];
  mentionButtonMember: CommunityMemberModel | undefined;
} {
  return {
    addressedAgents: audience.addressedMembers(),
    autoMentionEnabled: audience.enabled(),
    lockedAgentPubkeys: audience.audiencePubkeys(),
    mentionButtonMember: audience.mentionButtonMember(),
  };
}

export function communityComposerMentionMembers(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityComposerAgentModel[],
): CommunityMemberModel[] {
  const agentIds = new Set(
    agents.map((agent) => agent.pubkey.trim().toLowerCase()),
  );
  const tagged = members.map((member) =>
    agentIds.has(member.id.trim().toLowerCase())
      ? member.kind === "agent"
        ? member
        : { ...member, kind: "agent" as const }
      : member,
  );
  const known = new Set(tagged.map((member) => member.id.trim().toLowerCase()));
  return [
    ...tagged,
    ...agents
      .filter((agent) => !known.has(agent.pubkey.trim().toLowerCase()))
      .map(communityMemberFromAgent),
  ];
}

export function mentionedComposerAgentPubkeys(
  value: string,
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityComposerAgentModel[],
  selectedMentionPubkeys: readonly string[] = [],
): string[] {
  const knownAgents = new Set(
    agents.map((agent) => agent.pubkey.trim().toLowerCase()),
  );
  const fromText = communityComposerMentionMembers(members, agents)
    .filter(
      (member) =>
        knownAgents.has(member.id.trim().toLowerCase()) &&
        tokenAppears(value, "@", member.name),
    )
    .map((member) => member.id);
  return [
    ...new Set(
      [...selectedMentionPubkeys, ...fromText].filter((pubkey) =>
        knownAgents.has(pubkey.trim().toLowerCase()),
      ),
    ),
  ];
}
