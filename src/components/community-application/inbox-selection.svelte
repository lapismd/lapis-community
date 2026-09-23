<script lang="ts">
  import { onDestroy, type ComponentProps } from "svelte";

  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import { inboxConversationPending } from "./inbox-conversation-pending.js";

  let props: ComponentProps<typeof CommunityInbox> = $props();
  let requestedItemId = $state<string>();
  let dispatchPending = $state(false);
  let selectionFrame = 0;

  function selectAfterPaint(itemId: string): void {
    if (itemId === (requestedItemId ?? props.model.activeItemId)) return;
    requestedItemId = itemId;
    dispatchPending = true;
    cancelAnimationFrame(selectionFrame);
    // Let the new header and skeleton paint before controller projection or
    // cached conversation/editor mounting can occupy the main thread.
    selectionFrame = requestAnimationFrame(() => {
      selectionFrame = requestAnimationFrame(() => {
        dispatchPending = false;
        props.onSelect(itemId);
      });
    });
  }

  onDestroy(() => cancelAnimationFrame(selectionFrame));

  const requestedItem = $derived(
    requestedItemId
      ? props.model.items.find((item) => item.id === requestedItemId)
      : undefined,
  );
  const waitingForConversation = $derived(
    inboxConversationPending(props.model, requestedItemId),
  );
  const model = $derived(
    requestedItem === undefined || requestedItem.id === props.model.activeItemId
      ? props.model
      : {
          ...props.model,
          activeItemId: requestedItem.id,
          threadTitle: requestedItem.context,
          selectedItem: requestedItem,
        },
  );
</script>

<CommunityInbox
  {...props}
  {model}
  conversationLoading={props.conversationLoading ||
    dispatchPending ||
    waitingForConversation}
  onSelect={selectAfterPaint}
/>
