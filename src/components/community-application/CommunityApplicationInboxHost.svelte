<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";

  let props: ComponentProps<typeof CommunityInbox> = $props();
</script>

<CommunityInbox {...props} />
