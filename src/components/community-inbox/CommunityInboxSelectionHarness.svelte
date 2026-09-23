<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityApplicationInboxHost from "../community-application/CommunityApplicationInboxHost.svelte";
  import {
    communityInboxSelectionHarnessModel,
    selectInboxSelectionHarnessItem,
  } from "./inbox-selection-harness.js";

  const controller = new AppShellController();
  let model = $state(communityInboxSelectionHarnessModel());
</script>

<CommunityAppShell {controller} displayMode="desktop" desktopMinMainWidth={0}>
  <AppShell.Main>
    <CommunityApplicationInboxHost
      {model}
      onSend={async () => {}}
      onMarkAllRead={() => {}}
      onOpenChannelSettings={() => {}}
      onSelect={(itemId) => {
        model = selectInboxSelectionHarnessItem(model, itemId);
      }}
    />
  </AppShell.Main>
</CommunityAppShell>
