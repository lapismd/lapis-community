import type { AgentConversation } from "../community-agent-conversation/context.svelte.js";
/** Scope asynchronous commit descriptions to the current reference. */
export function createCommitDescription(
  owner: () => {
    repository?: string | undefined;
    commit?: string | undefined;
    file?: string | undefined;
    line?: string | undefined;
    description?: string | undefined;
    conversation?: AgentConversation | undefined;
  },
) {
  let fetched = $state<string>();
  $effect(() => {
    const { repository, commit, file, description, conversation } = owner();
    fetched = undefined;
    let active = true;
    if (!description && !file && repository && commit && conversation)
      void conversation
        .commitDescription(repository, commit)
        .then((value) => {
          if (active) fetched = value;
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  });
  const value = $derived(
    owner().description ?? fetched ?? owner().commit ?? "Commit",
  );
  const fileLabel = $derived(
    owner().file
      ? `${owner().file}${owner().line ? `:${owner().line}` : ""}`
      : undefined,
  );
  return {
    get value() {
      return value;
    },
    get label() {
      return fileLabel?.split("/").at(-1) ?? value.split("\n")[0];
    },
    get details() {
      return fileLabel ?? value;
    },
  };
}
