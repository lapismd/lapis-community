<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

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

<Story
  name="Personal sections"
  args={{
    section: "profile",
    onSelect: () => {},
    onClose: () => {},
  }}
/>

<style>
  :global(#storybook-root) {
    width: 15rem;
    min-height: 100vh;
  }
</style>
