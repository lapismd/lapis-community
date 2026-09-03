<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { untrack } from "svelte";

  import type {
    RegistryCatalogEntry,
    RegistryDirectoryState,
  } from "../../registry/index.js";
  import RegistryDirectory from "./RegistryDirectory.svelte";

  let {
    plugins,
    state: initialState,
    onOpenPlugin = () => {},
    dark = false,
  }: {
    plugins: readonly RegistryCatalogEntry[];
    state: RegistryDirectoryState;
    onOpenPlugin?: (plugin: RegistryCatalogEntry) => void;
    dark?: boolean;
  } = $props();

  const shell = untrack(
    () =>
      new AppShellController({
        rightClosed: true,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  let state = $state<RegistryDirectoryState>(untrack(() => initialState));
</script>

<AppShell.Root
  controller={shell}
  class={dark ? "dark registry-directory-story" : "registry-directory-story"}
  style="--ui-shell-height: 100vh"
>
  <AppShell.Main>
    <RegistryDirectory {plugins} bind:state {onOpenPlugin} />
  </AppShell.Main>
</AppShell.Root>

<style>
  :global(.registry-directory-story) {
    height: 100vh;
  }
</style>
