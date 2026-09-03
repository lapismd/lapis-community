<script lang="ts">
  import type { ComponentProps } from "svelte";
  import CommunitySearchCommand from "./CommunitySearchCommand.svelte";

  let { args }: { args: ComponentProps<typeof CommunitySearchCommand> } =
    $props();
  let query = $state("");
</script>

<CommunitySearchCommand
  {...args}
  {query}
  onQueryChange={(nextQuery) => {
    query = nextQuery;
    args.onQueryChange?.(nextQuery);
  }}
/>
