<script lang="ts">
  import type { ComponentProps } from "svelte";
  import InboxSelection from "./inbox-selection.svelte";
  let props: ComponentProps<typeof InboxSelection> = $props();
  // Materialize the application adapter once per update. Passing its getters
  // through every conversation layer multiplies work for each descendant read.
  const surfaceProps = $derived({ ...props });
</script>

<InboxSelection {...surfaceProps} />
