<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityProjectChannelIcon from "./CommunityProjectChannelIcon.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Project channel icon",
    component: CommunityProjectChannelIcon,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityProjectChannelIcon } from "@lapismd/lapis-community/components";
<\/script>

<CommunityProjectChannelIcon />`,
        },
      },
    },
  });
</script>

<Story name="Folder with lower-right hash">
  {#snippet template()}
    <Button variant="secondary">
      <CommunityProjectChannelIcon data-icon="inline-start" />
      Project channel
    </Button>
  {/snippet}
</Story>
