<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";

  import CommunitySettingsNavigation from "./CommunitySettingsNavigation.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Settings navigation",
    component: CommunitySettingsNavigation,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunitySettingsNavigation
  section="profile"
  onSelect={setSettingsSection}
  onClose={closeSettings}
/>`,
        },
      },
    },
  });
</script>

<script lang="ts">
  import type { CommunitySettingsSection } from "../community-settings/model.js";

  let section = $state<CommunitySettingsSection>("profile");
  let outcome = $state("Profile settings selected");
</script>

<Story
  name="Personal sections"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Custom emoji" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Custom emoji settings selected",
    );
  }}
>
  {#snippet template()}
    <CommunitySettingsNavigation
      {section}
      onSelect={(nextSection) => {
        section = nextSection;
        outcome = `${nextSection === "custom-emoji" ? "Custom emoji" : "Profile"} settings selected`;
      }}
      onClose={() => (outcome = "Settings closed")}
    />
    <p class="settings-navigation-story__outcome" role="status">{outcome}</p>
  {/snippet}
</Story>

<style>
  :global(#storybook-root) {
    width: 15rem;
    min-height: 100vh;
  }

  .settings-navigation-story__outcome {
    margin: 1rem;
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }
</style>
