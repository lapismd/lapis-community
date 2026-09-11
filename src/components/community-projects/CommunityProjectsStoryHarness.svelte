<script lang="ts">
  import { untrack } from "svelte";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Toaster } from "svelte-sonner";

  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityProjects from "./CommunityProjects.svelte";
  import type { CommunityProjectsProps } from "./model.js";

  const controller = new AppShellController();
  const props: CommunityProjectsProps = $props();
  let selectedPath = $state(untrack(() => props.selectedPath ?? ""));

  function selectPath(path: string): void {
    selectedPath = path;
    props.onSelectPath?.(path);
  }
</script>

<CommunityAppShell {controller} displayMode="desktop" desktopMinMainWidth={0}>
  <AppShell.Main>
    <CommunityProjects {...props} {selectedPath} onSelectPath={selectPath} />
  </AppShell.Main>
</CommunityAppShell>

<Toaster position="bottom-right" />
