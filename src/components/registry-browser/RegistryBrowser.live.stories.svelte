<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import RegistryBrowser from "./RegistryBrowser.svelte";
  import RegistryBrowserLiveStoryHarness from "./RegistryBrowserLiveStoryHarness.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Browser Live",
    component: RegistryBrowser,
    tags: ["visual-pending", "!test"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryBrowser source={createNip29RegistryCatalogDataSource({ relays, authorities, relayFactory, blossomUrl })} route={{ page: "plugin", pluginId: "ai" }} />`,
        },
      },
    },
  });
</script>

<Story name="Relay AI detail">
  {#snippet template()}
    <RegistryBrowserLiveStoryHarness />
  {/snippet}
</Story>
