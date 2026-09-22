<script lang="ts">
  import type { Snippet } from "svelte";

  import type { CommunityEntityLink } from "../../community/community-links.js";
  import { provideCommunityEntityNavigation } from "./navigation.js";

  let {
    children,
    onOpen = () => {},
  }: {
    children: Snippet;
    onOpen?: (link: CommunityEntityLink) => void;
  } = $props();

  provideCommunityEntityNavigation({
    open: (link) => onOpen(link),
    label: () => "",
  });
</script>

{@render children()}
