<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import { inboxConversationPending } from "./inbox-conversation-pending.js";

  let props: ComponentProps<typeof CommunityInbox> = $props();
  let requestedItemId = $state<string>();

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
  conversationLoading={props.conversationLoading || waitingForConversation}
  onSelect={(itemId) => {
    requestedItemId = itemId;
    props.onSelect(itemId);
  }}
/>
