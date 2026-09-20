<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";

  let props: ComponentProps<typeof CommunityInbox> = $props();
  let requestedItemId = $state<string>();

  const requestedItem = $derived(
    requestedItemId
      ? props.model.items.find((item) => item.id === requestedItemId)
      : undefined,
  );
  const waitingForConversation = $derived(
    requestedItemId !== undefined &&
      props.model.activeItemId !== requestedItemId,
  );
  const model = $derived(
    requestedItem === undefined ||
    requestedItem.id === props.model.activeItemId
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
