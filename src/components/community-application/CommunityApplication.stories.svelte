<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunityApplication from "./CommunityApplication.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import CommunityApplicationCacheStoryHarness from "./CommunityApplicationCacheStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import { onMount } from "svelte";
  import {
    CommunityApplication,
    RegistryCommunity,
  } from "@lapismd/lapis-community/components";
  import {
    createBrowserCommunityConfigurationStore,
    createBrowserCommunityEventRuntime,
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
    configurationStore: createBrowserCommunityConfigurationStore(),
    runtime: createBrowserCommunityEventRuntime(),
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
            "The near-final application composition: one controller-backed shell for Inbox, Registry, independently scrolling channels, forums, direct messages, settings, profile identity, history, fixed composers, reaction summaries, threads, and detail panels.",
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

<Story name="Cached startup offline">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="cached-offline" />
  {/snippet}
</Story>

<Story name="Cold cache offline">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="cold-offline" />
  {/snippet}
</Story>

<Story name="Degraded persistent storage">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="degraded" />
  {/snippet}
</Story>

<Story name="Mid-session disconnect">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="mid-session-disconnect" />
  {/snippet}
</Story>

<Story name="Reconnect from cache">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="reconnect" />
  {/snippet}
</Story>
