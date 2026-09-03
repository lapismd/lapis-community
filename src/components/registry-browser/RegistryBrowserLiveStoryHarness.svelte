<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { untrack } from "svelte";

  import {
    createHttpRegistryCatalogDataSource,
    type RegistryCatalogDataSource,
    type RegistryRoute,
  } from "../../registry/index.js";
  import RegistryBrowser from "./RegistryBrowser.svelte";

  const httpSource = createHttpRegistryCatalogDataSource({
    baseUrl: "/registry/",
  });
  const source: RegistryCatalogDataSource = {
    ...httpSource,
    async loadRuntime() {
      return null;
    },
  };
  const shell = untrack(
    () =>
      new AppShellController({
        rightClosed: true,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  let route = $state<RegistryRoute>({ page: "plugin", pluginId: "ai" });
</script>

<div class="registry-browser-live-story-host">
  <AppShell.Root
    controller={shell}
    class="registry-browser-live-story"
    style="--ui-shell-height: 100%; height: 100%"
  >
    <AppShell.Main>
      <RegistryBrowser {source} bind:route />
    </AppShell.Main>
  </AppShell.Root>
</div>

<style>
  .registry-browser-live-story-host {
    height: 100vh;
  }
</style>
