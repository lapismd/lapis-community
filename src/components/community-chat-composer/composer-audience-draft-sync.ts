import { subscribePersistentAgentAudience } from "./persistent-agent-audience.js";

export interface ComposerAudienceDraft {
  hydrate(value: string, lastKey: string): { key: string; value?: string };
  reconcile(value: string, selectedMentionPubkeys?: readonly string[]): void;
  rememberDraft(value: string, selectedMentionPubkeys: readonly string[]): void;
  audiencePubkeys(): string[];
}

let composerAudienceDraftSyncDepth = 0;

function runComposerAudienceDraftSync<T>(fn: () => T): T {
  composerAudienceDraftSyncDepth += 1;
  try {
    return fn();
  } finally {
    composerAudienceDraftSyncDepth -= 1;
  }
}

export function subscribeComposerAgentAudience(
  listener: () => void,
): () => void {
  return subscribePersistentAgentAudience(() => {
    if (composerAudienceDraftSyncDepth > 0) return;
    listener();
  });
}

export function syncComposerAgentAudienceDraft(
  audience: ComposerAudienceDraft,
  value: string,
  lastKey: string,
  selectedMentionPubkeys: readonly string[],
): { key: string; value?: string; mentionPubkeys: string[] } {
  return runComposerAudienceDraftSync(() => {
    const next = audience.hydrate(value, lastKey);
    const draft =
      next.value !== undefined && next.value !== value ? next.value : value;
    audience.reconcile(draft, selectedMentionPubkeys);
    audience.rememberDraft(draft, selectedMentionPubkeys);
    return {
      key: next.key,
      ...(next.value !== undefined && next.value !== value
        ? { value: next.value }
        : {}),
      mentionPubkeys: [
        ...new Set([...selectedMentionPubkeys, ...audience.audiencePubkeys()]),
      ],
    };
  });
}
