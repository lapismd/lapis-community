import { untrack } from "svelte";

export function createConversationDraft(owner: {
  key(): string;
  identity(): string | undefined;
  presentation(): { key: string; draft: string } | undefined;
  persist(): boolean;
  changed(key: string, draft: string): void;
  onIdentityChange(): void;
}) {
  let value = $state("");
  const drafts = new Map<string, string>();
  let previousKey: string | undefined;
  let previousIdentity: string | undefined;
  let identityLoaded = false;

  $effect(() => {
    const saved = owner.presentation();
    if (saved && !owner.persist())
      untrack(() => {
        value = saved.draft;
      });
  });
  $effect(() => {
    const draft = value;
    const key = owner.presentation()?.key;
    if (key && previousKey === owner.key() && !owner.persist())
      untrack(() => owner.changed(key, draft));
  });
  $effect(() => {
    const identity = owner.identity();
    untrack(() => {
      if (identityLoaded && previousIdentity === identity) return;
      identityLoaded = true;
      previousIdentity = identity;
      drafts.clear();
      previousKey = undefined;
      value = owner.persist() ? "" : (owner.presentation()?.draft ?? "");
      owner.onIdentityChange();
    });
  });
  $effect(() => {
    const key = owner.key();
    untrack(() => {
      if (previousKey === key) return;
      if (previousKey !== undefined) drafts.set(previousKey, value);
      value = owner.persist()
        ? (drafts.get(key) ?? "")
        : (owner.presentation()?.draft ?? drafts.get(key) ?? "");
      previousKey = key;
    });
  });

  return {
    get value() {
      return value;
    },
    set value(next: string) {
      value = next;
    },
  };
}
