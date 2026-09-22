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
  communityComposerMentionMembers,
  mentionedComposerAgentPubkeys,
} from "./composer-agent-mentions.js";
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
} from "./persistent-agent-audience.js";
import { subscribeComposerAgentAudience } from "./composer-audience-draft-sync.js";

export {
  communityComposerMentionMembers,
  mentionedComposerAgentPubkeys,
  readComposerAudienceView,
} from "./composer-agent-mentions.js";
export { syncComposerAgentAudienceDraft } from "./composer-audience-draft-sync.js";

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
  reconcile(value: string, selectedMentionPubkeys?: readonly string[]): void;
  restoreAfterSend(explicit: readonly string[]): { value: string };
  rememberDraft(value: string, selectedMentionPubkeys: readonly string[]): void;
  subscribe(listener: () => void): () => void;
} {
  const displayName = (pubkey: string) =>
    communityComposerAgentDisplayName(input.agents(), input.members())(pubkey);
  const scope = () => {
    const audience = input.audience();
    return audience ? getPersistentAgentAudienceScope(audience) : null;
  };
  const membersById = () => {
    const known = new Map<string, CommunityMemberModel>();
    for (const member of communityComposerMentionMembers(
      input.members(),
      input.agents(),
    )) {
      known.set(member.id, member);
      known.set(member.id.trim().toLowerCase(), member);
    }
    return known;
  };
  const audiencePubkeys = () => getPersistentAgentAudience(scope());
  const addressedMembers = () => {
    const known = membersById();
    return audiencePubkeys().flatMap((pubkey) => {
      const member = known.get(pubkey) ?? known.get(pubkey.toLowerCase());
      return member ? [member] : [];
    });
  };
  const dismissed = new Set<string>();
  const rememberDraft = (
    value: string,
    selectedMentionPubkeys: readonly string[],
  ) => {
    if (!getPersistentAgentAudienceEnabled()) return;
    for (const pubkey of selectedMentionPubkeys) {
      dismissed.delete(pubkey.trim().toLowerCase());
    }
    promotePersistentAgentAudience(
      scope(),
      mentionedComposerAgentPubkeys(
        value,
        input.members(),
        input.agents(),
        selectedMentionPubkeys,
      ).filter((pubkey) => !dismissed.has(pubkey.trim().toLowerCase())),
    );
  };

  return {
    scope,
    enabled: () => getPersistentAgentAudienceEnabled(),
    audiencePubkeys,
    addressedMembers,
    mentionButtonMember: () =>
      getPersistentAgentAudienceEnabled() ? addressedMembers()[0] : undefined,
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
        dismissed.add(pubkey.trim().toLowerCase());
        removePersistentAgentAudienceMember(currentScope, pubkey);
        return { value: "" };
      }
      dismissed.delete(pubkey.trim().toLowerCase());
      addPersistentAgentAudienceMember(currentScope, pubkey);
      return {};
    },
    dismiss(pubkey) {
      dismissed.add(pubkey.trim().toLowerCase());
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
    reconcile(value, selectedMentionPubkeys = []) {
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
      const selected = new Set(
        selectedMentionPubkeys.map((pubkey) => pubkey.trim().toLowerCase()),
      );
      for (const pubkey of removedAgentMentionPubkeys(
        value,
        getPersistentAgentAudience(currentScope),
        displayName,
      )) {
        if (selected.has(pubkey.trim().toLowerCase())) continue;
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
    rememberDraft,
    subscribe: subscribeComposerAgentAudience,
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
