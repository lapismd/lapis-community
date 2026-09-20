<script lang="ts">
  import type { ComponentProps } from "svelte";
  import InboxSelection from "./inbox-selection.svelte";
  let props: ComponentProps<typeof InboxSelection> = $props();
</script>

<InboxSelection {...props} />
