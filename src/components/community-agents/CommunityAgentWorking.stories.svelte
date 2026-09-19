<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within } from "storybook/test";
  import CommunityAgents from "./CommunityAgents.svelte";
  import Harness from "./CommunityAgentsStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Working",
    component: CommunityAgents,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: 'import { CommunityAgents } from "@lapismd/lapis-community/components";\n<CommunityAgents {model} {onProfile} {onActivity} {onSaveAgent} {onDeletePersona} {onRefresh} {onClearHistory} />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Shared progress indicator"
  play={async ({ canvas }) => {
    const directory = canvas.getByRole("region", { name: "Your agents" });
    const status = within(directory).getByRole("status");
    expect(status).toHaveTextContent("Working");
    expect(
      status.closest('[data-ui-component="ai-chat-reasoning"]'),
    ).toHaveAttribute("data-streaming", "true");
    expect(status.closest('[data-ui-component="community-chip"]')).toBeNull();
  }}
>
  {#snippet template()}<Harness screen="gallery" />{/snippet}
</Story>
