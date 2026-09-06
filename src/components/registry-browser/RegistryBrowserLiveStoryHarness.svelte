<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onDestroy, untrack } from "svelte";

  import {
    createNip29RegistryCatalogDataSource,
    type RegistryRoute,
  } from "../../registry/index.js";
  import { createWebSocketCommunityRelayFactory } from "../../nostr/index.js";
  import RegistryBrowser from "./RegistryBrowser.svelte";

  const configuration = untrack(() => {
    const dataset: Record<string, string | undefined> =
      typeof document === "undefined" ? {} : document.documentElement.dataset;
    const values = (value: string | undefined): string[] =>
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return {
      relays: values(dataset.registryRelays),
      curatorPubkeys: new Set(values(dataset.registryCuratorPubkeys)),
      publisherPubkeys: new Set(values(dataset.registryPublisherPubkeys)),
      authorityEpoch: dataset.registryAuthorityEpoch?.trim() || undefined,
      blossomUrl: dataset.registryBlossomUrl,
    };
  });
  const source =
    configuration.relays.length === 0 ||
    configuration.curatorPubkeys.size === 0 ||
    configuration.publisherPubkeys.size === 0
      ? undefined
      : createNip29RegistryCatalogDataSource({
          relays: configuration.relays,
          authorities: {
            curatorPubkeys: configuration.curatorPubkeys,
            publisherPubkeysByPlugin: new Map(),
            defaultPublisherPubkeys: configuration.publisherPubkeys,
            ...(configuration.authorityEpoch === undefined
              ? {}
              : { authorityEpoch: configuration.authorityEpoch }),
          },
          relayFactory: createWebSocketCommunityRelayFactory(),
          ...(configuration.blossomUrl
            ? { blossomUrl: configuration.blossomUrl }
            : {}),
        });
  const shell = untrack(
    () =>
      new AppShellController({
        rightClosed: true,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  let route = $state<RegistryRoute>({ page: "plugin", pluginId: "ai" });

  onDestroy(() => source?.dispose());
</script>

<div class="registry-browser-live-story-host">
  <AppShell.Root
    controller={shell}
    class="registry-browser-live-story"
    style="--ui-shell-height: 100%; height: 100%"
  >
    <AppShell.Main>
      {#if source}
        <RegistryBrowser {source} bind:route />
      {:else}
        <p role="status">
          Configure the registry relay and trusted publisher/curator keys to run
          this live story.
        </p>
      {/if}
    </AppShell.Main>
  </AppShell.Root>
</div>

<style>
  .registry-browser-live-story-host {
    height: 100vh;
  }
</style>
