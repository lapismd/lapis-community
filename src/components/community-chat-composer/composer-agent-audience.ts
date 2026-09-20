import { communityMemberFromAgent } from "../../community/member-identity.js";
import type { CommunityMemberModel } from "../../community/workspace-model.js";
import {
  canHydrateAgentMentions,
  hydrateAgentMentionDraft,
  removedAgentMentionPubkeys,
  restoreAgentMentionDraft,
  stripAgentMention,
} from "./agent-mention-hydration.js";
import type { CommunityComposerContext } from "./model.js";
import {
  communityComposerAgentDisplayName,
  type CommunityComposerAgentModel,
  type CommunityComposerAudienceScope,
} from "./composer-agent-model.js";
import {
  addPersistentAgentAudienceMember,
  getPersistentAgentAudience,
  getPersistentAgentAudienceEnabled,
  getPersistentAgentAudienceGeneration,
  getPersistentAgentAudienceScope,
  initializePersistentAgentAudience,
  promotePersistentAgentAudience,
  removePersistentAgentAudienceMember,
  setPersistentAgentAudienceEnabled,
  subscribePersistentAgentAudience,
} from "./persistent-agent-audience.js";

export function communityComposerMentionMembers(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityComposerAgentModel[],
): CommunityMemberModel[] {
  const known = new Set(members.map((member) => member.id));
  return [
    ...members,
    ...agents
      .filter((agent) => !known.has(agent.pubkey))
      .map(communityMemberFromAgent),
  ];
}

export function createComposerAgentAudience(input: {
  agents: () => readonly CommunityComposerAgentModel[];
  members: () => readonly CommunityMemberModel[];
  audience: () => CommunityComposerAudienceScope | undefined;
  initialAgentPubkeys: () => readonly string[];
  context: () => CommunityComposerContext | undefined;
  submitting: () => boolean;
}): {
  scope(): string | null;
  enabled(): boolean;
  audiencePubkeys(): string[];
  addressedMembers(): CommunityMemberModel[];
  mentionButtonMember(): CommunityMemberModel | undefined;
  displayName(pubkey: string): string | undefined;
  setEnabled(enabled: boolean): void;
  toggleAlwaysAddress(pubkey: string): { value?: string };
  dismiss(pubkey: string): { value: string };
  hydrate(value: string, lastKey: string): { value?: string; key: string };
  reconcile(value: string): void;
  restoreAfterSend(explicit: readonly string[]): { value: string };
  subscribe(listener: () => void): () => void;
} {
  const displayName = (pubkey: string) =>
    communityComposerAgentDisplayName(input.agents(), input.members())(pubkey);
  const scope = () => {
    const audience = input.audience();
    return audience ? getPersistentAgentAudienceScope(audience) : null;
  };
  const membersById = () =>
    new Map(
      communityComposerMentionMembers(input.members(), input.agents()).map(
        (member) => [member.id, member],
      ),
    );
  const audiencePubkeys = () => getPersistentAgentAudience(scope());
  const addressedMembers = () => {
    const known = membersById();
    return audiencePubkeys().flatMap((pubkey) => {
      const member = known.get(pubkey);
      return member ? [member] : [];
    });
  };

  return {
    scope,
    enabled: () => getPersistentAgentAudienceEnabled(),
    audiencePubkeys,
    addressedMembers,
    mentionButtonMember: () => addressedMembers()[0],
    displayName,
    setEnabled(enabled) {
      setPersistentAgentAudienceEnabled(enabled);
      if (enabled) {
        initializePersistentAgentAudience(scope(), input.initialAgentPubkeys());
      }
    },
    toggleAlwaysAddress(pubkey) {
      const currentScope = scope();
      if (!currentScope) return {};
      if (!getPersistentAgentAudienceEnabled()) {
        setPersistentAgentAudienceEnabled(true);
        initializePersistentAgentAudience(
          currentScope,
          input.initialAgentPubkeys(),
        );
      }
      const locked = getPersistentAgentAudience(currentScope);
      if (locked.includes(pubkey.trim().toLowerCase())) {
        removePersistentAgentAudienceMember(currentScope, pubkey);
        return { value: "" };
      }
      addPersistentAgentAudienceMember(currentScope, pubkey);
      return {};
    },
    dismiss(pubkey) {
      removePersistentAgentAudienceMember(scope(), pubkey);
      return { value: "" };
    },
    hydrate(value, lastKey) {
      const currentScope = scope();
      const enabled = getPersistentAgentAudienceEnabled();
      if (
        input.submitting() ||
        !canHydrateAgentMentions(input.context(), enabled, currentScope)
      ) {
        return { key: lastKey };
      }
      initializePersistentAgentAudience(
        currentScope,
        input.initialAgentPubkeys(),
      );
      const key = `${currentScope}:${getPersistentAgentAudienceGeneration()}:${enabled ? "1" : "0"}`;
      if (key === lastKey) return { key };
      return {
        key,
        value: hydrateAgentMentionDraft(
          value,
          getPersistentAgentAudience(currentScope),
          displayName,
        ),
      };
    },
    reconcile(value) {
      const currentScope = scope();
      if (
        input.submitting() ||
        !canHydrateAgentMentions(
          input.context(),
          getPersistentAgentAudienceEnabled(),
          currentScope,
        )
      ) {
        return;
      }
      for (const pubkey of removedAgentMentionPubkeys(
        value,
        getPersistentAgentAudience(currentScope),
        displayName,
      )) {
        removePersistentAgentAudienceMember(currentScope, pubkey);
      }
    },
    restoreAfterSend(explicit) {
      const currentScope = scope();
      promotePersistentAgentAudience(currentScope, explicit);
      return {
        value: restoreAgentMentionDraft(
          explicit,
          getPersistentAgentAudience(currentScope),
          displayName,
        ),
      };
    },
    subscribe: subscribePersistentAgentAudience,
  };
}

export function applyAgentMentionChange(
  value: string,
  pubkey: string,
  insert: boolean,
  displayName: (pubkey: string) => string | undefined,
): string {
  if (!insert) return stripAgentMention(value, pubkey, displayName);
  return hydrateAgentMentionDraft(value, [pubkey], displayName);
}

export function mergeComposerMentionPubkeys(
  current: readonly string[],
  extra: readonly string[],
): string[] {
  return [...new Set([...current, ...extra])];
}

export function syncComposerAgentAudienceDraft(
  audience: ReturnType<typeof createComposerAgentAudience>,
  value: string,
  lastKey: string,
  selectedMentionPubkeys: readonly string[],
): { key: string; value?: string; mentionPubkeys: string[] } {
  const next = audience.hydrate(value, lastKey);
  if (next.value !== undefined && next.value !== value) {
    return {
      key: next.key,
      value: next.value,
      mentionPubkeys: mergeComposerMentionPubkeys(
        selectedMentionPubkeys,
        audience.audiencePubkeys(),
      ),
    };
  }
  audience.reconcile(value);
  return { key: next.key, mentionPubkeys: [...selectedMentionPubkeys] };
}

export function restoreComposerDraftAfterSend(
  hasAudience: boolean,
  audience: ReturnType<typeof createComposerAgentAudience>,
  mentionPubkeys: readonly string[],
  agents: readonly { pubkey: string }[],
): { value: string; mentionPubkeys: string[] } {
  if (!hasAudience || !audience.enabled()) {
    return { value: "", mentionPubkeys: [] };
  }
  const explicit = mentionPubkeys.filter((pubkey) =>
    agents.some((agent) => agent.pubkey === pubkey),
  );
  return {
    value: audience.restoreAfterSend(explicit).value,
    mentionPubkeys: mergeComposerMentionPubkeys(
      explicit,
      audience.audiencePubkeys(),
    ),
  };
}
