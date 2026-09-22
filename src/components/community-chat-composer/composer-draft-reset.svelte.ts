import { untrack } from "svelte";

export function resetBoundDraftOnKeyChange(owner: {
  key(): string;
  persist(): boolean;
  setValue(next: string): void;
}): void {
  let seen: string | undefined;
  $effect.pre(() => {
    const key = owner.key();
    const persist = owner.persist();
    if (seen === key) return;
    seen = key;
    if (persist) untrack(() => owner.setValue(""));
  });
}
