import { npubEncode } from "nostr-tools/nip19";

import type { CommunityMemberModel } from "../community-workspace/model.js";
import { communityMemberFromAgent } from "../../community/member-identity.js";
import type { CommunityComposerAutocompleteItem } from "./autocomplete.js";
import type { CommunityComposerAgentModel } from "./composer-agent-model.js";

const MENTION_LIMIT = 16;

export function communityAgentMentionDetail(
  agent: CommunityComposerAgentModel,
  currentMemberId: string | undefined,
  channelId: string | undefined,
  collision: boolean,
): string {
  const parts = ["agent"];
  if (currentMemberId && agent.ownerPubkey === currentMemberId) {
    parts.push("managed by you");
  }
  if (channelId && !agent.channelIds.includes(channelId)) {
    parts.push("not in channel");
  }
  if (collision && /^[0-9a-f]{64}$/u.test(agent.pubkey)) {
    parts.push(truncateNpub(npubEncode(agent.pubkey)));
  }
  return parts.join(" · ");
}

export function communityMentionAutocompleteItems(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityComposerAgentModel[],
  query: string,
  currentMemberId?: string,
  channelId?: string,
): CommunityComposerAutocompleteItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  const known = new Set(members.map((member) => member.id));
  const nameCounts = new Map<string, number>();
  const merged = [
    ...members,
    ...agents
      .filter((agent) => !known.has(agent.pubkey))
      .map(communityMemberFromAgent),
  ];
  for (const member of merged) {
    const key = member.name.trim().toLocaleLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const agentsByPubkey = new Map(agents.map((agent) => [agent.pubkey, agent]));
  return merged
    .filter((member) => {
      if (member.id === currentMemberId) return false;
      if (normalized === "") return true;
      return `${member.name} ${member.handle}`
        .toLocaleLowerCase()
        .includes(normalized);
    })
    .sort((left, right) => {
      const leftAgent = Number(left.kind === "agent");
      const rightAgent = Number(right.kind === "agent");
      if (leftAgent !== rightAgent) return leftAgent - rightAgent;
      return compareMatch(
        `${left.name} ${left.handle}`,
        `${right.name} ${right.handle}`,
        normalized,
      );
    })
    .slice(0, MENTION_LIMIT)
    .map((member) => {
      const agent = agentsByPubkey.get(member.id);
      const collision =
        (nameCounts.get(member.name.trim().toLocaleLowerCase()) ?? 0) > 1;
      return {
        id: `member:${member.id}`,
        kind: "member" as const,
        label: member.name,
        detail: agent
          ? communityAgentMentionDetail(
              agent,
              currentMemberId,
              channelId,
              collision,
            )
          : `@${member.handle}`,
        member,
      };
    });
}

function compareMatch(left: string, right: string, query: string): number {
  if (query === "") return left.localeCompare(right);
  const leftIndex = left.toLocaleLowerCase().indexOf(query);
  const rightIndex = right.toLocaleLowerCase().indexOf(query);
  return leftIndex - rightIndex || left.localeCompare(right);
}

function truncateNpub(value: string): string {
  return value.length <= 16
    ? value
    : `${value.slice(0, 12)}…${value.slice(-4)}`;
}
