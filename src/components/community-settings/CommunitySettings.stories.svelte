<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunitySettings from "./CommunitySettings.svelte";
  import CommunityNavigationShellFixture from "../community-navigation/CommunityNavigationShellFixture.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Settings",
    component: CommunitySettings,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          language: "svelte",
          code: `<CommunitySettings
  model={community.state.settings}
  profileOperation={community.state.operations["settings:profile"]}
  onUpdateProfile={community.actions.updateProfile}
  onAddCustomEmoji={community.actions.setCustomEmoji}
  onRemoveCustomEmoji={community.actions.removeCustomEmoji}
/>`,
        },
      },
    },
  });
</script>

<Story name="Personal settings">
  {#snippet template()}
    <CommunityNavigationShellFixture initialActiveItemId="settings" />
  {/snippet}
</Story>
