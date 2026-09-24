import { untrack } from "svelte";
/** Subscribe and dispose the conversation with its rendered channel. */
export function watchAgentConversationChannel(
  channel: () => string | undefined,
  conversation: { watch(channel: string): () => void } | undefined,
) {
  $effect(() => {
    const id = channel();
    if (id && conversation) return untrack(() => conversation.watch(id));
  });
}
