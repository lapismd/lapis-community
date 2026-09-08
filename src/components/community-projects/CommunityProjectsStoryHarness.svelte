<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";

  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityProjects from "./CommunityProjects.svelte";
  import type { CommunityProjectsProps } from "./model.js";

  const controller = new AppShellController();
  const props: CommunityProjectsProps = $props();
</script>

<CommunityAppShell {controller} displayMode="desktop" desktopMinMainWidth={0}>
  <AppShell.Main>
    <CommunityProjects {...props} />
  </AppShell.Main>
</CommunityAppShell>
