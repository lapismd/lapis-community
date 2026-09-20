<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityApplicationInboxHost from "../community-application/CommunityApplicationInboxHost.svelte";
  import { communityInboxFixture } from "./story-fixtures.js";

  const controller = new AppShellController();
  const model = {
    ...communityInboxFixture,
    items: [
      ...communityInboxFixture.items,
      {
        id: "support-thread",
        authorId: "honey",
        context: "Thread in #support",
        timestamp: "Today",
        excerpt: "Need a second conversation for selection loading.",
      },
    ],
  };
</script>

<CommunityAppShell {controller} displayMode="desktop" desktopMinMainWidth={0}>
  <AppShell.Main>
    <CommunityApplicationInboxHost {model} onSelect={() => undefined} />
  </AppShell.Main>
</CommunityAppShell>
