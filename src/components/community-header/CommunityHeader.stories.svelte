<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunityHeader from "./CommunityHeader.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Header",
    component: CommunityHeader,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Connected relay"
  args={{ name: "AI", relayCount: 1, loading: false, error: "" }}
/>
<Story
  name="Relay issue"
  args={{ name: "AI", relayCount: 1, loading: false, error: "Unavailable" }}
/>
