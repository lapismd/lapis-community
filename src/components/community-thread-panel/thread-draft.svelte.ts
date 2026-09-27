import { untrack } from "svelte";
export function createThreadDraft(owner: {
  key(): string;
  presentation(): { key: string; draft?: string } | undefined;
  persist(): boolean;
  changed(key: string, draft: string): void;
  switched(): void;
}) {
  let value = $state("");
  let current: string | undefined;
  const drafts = new Map<string, string>();
  $effect(() => {
    const key = owner.key(),
      saved = owner.presentation()?.draft,
      persist = owner.persist();
    untrack(() => {
      if (current !== key) {
        if (current) drafts.set(current, value);
        value = persist
          ? (drafts.get(key) ?? "")
          : (saved ?? drafts.get(key) ?? "");
        current = key;
        owner.switched();
      } else if (!persist && saved !== undefined) value = saved;
    });
  });
  $effect(() => {
    const draft = value,
      key = owner.presentation()?.key;
    if (key && key === current && !owner.persist())
      untrack(() => owner.changed(key, draft));
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
