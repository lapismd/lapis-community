<script lang="ts">
  import { CommunityApplication } from "@lapismd/lapis-community/components";
  import type { ComponentProps } from "svelte";
  let {
    controller,
  }: Pick<ComponentProps<typeof CommunityApplication>, "controller"> = $props();
</script>

<!-- The application owns shared transcript reactions, thread panels and diff comments. -->
<CommunityApplication {controller} />
