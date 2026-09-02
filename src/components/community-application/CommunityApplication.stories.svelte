<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunityApplication from "./CommunityApplication.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import { onMount } from "svelte";
  import {
    CommunityApplication,
    RegistryCommunity,
  } from "@lapismd/lapis-community/components";
  import {
    createCommunityController,
    createNip29CommunitySource,
  } from "@lapismd/lapis-community/community";
  import { createWebSocketCommunityRelayFactory } from "@lapismd/lapis-community/nostr";

  const community = createCommunityController({
    scopes,
    identity,
    stateStore,
    source: createNip29CommunitySource({
      relayFactory: createWebSocketCommunityRelayFactory(),
    }),
  });

  onMount(() => {
    community.initialize();
    return () => community.dispose();
  });
<\/script>

<CommunityApplication controller={community}>
  {#snippet registry()}
    <RegistryCommunity
      plugin={selectedPlugin}
      name={selectedPluginName}
      version={selectedVersion}
      publisher={publisher}
      relays={JSON.stringify(relays)}
    />
  {/snippet}
</CommunityApplication>`;

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        story: { inline: false, iframeHeight: 700 },
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "The near-final application composition: one controller-backed shell for Inbox, Registry, channels, forums, direct messages, settings, profile identity, history, composers, threads, and detail panels.",
        },
      },
    },
  });
</script>

<Story name="Full community app">
  {#snippet template()}
    <CommunityApplicationStoryHarness />
  {/snippet}
</Story>
