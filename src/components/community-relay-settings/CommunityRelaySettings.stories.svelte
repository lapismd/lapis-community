<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunityRelaySettings from "./CommunityRelaySettings.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Community Settings",
    component: CommunityRelaySettings,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityRelaySettings
  bind:open
  connection={community.state.connections[0]}
  operation={community.state.operations[\"settings:relay:lapis-community\"]}
  onSave={(relayUrl) =>
    community.actions.updateRelayUrl(\"lapis-community\", relayUrl)}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Relay URL"
  args={{
    open: true,
    connection: {
      communityId: "lapis-community",
      name: "Lapis Community",
      relayUrl: "ws://registry.localhost:8281",
    },
    onSave: async () => {},
  }}
/>
