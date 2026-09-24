<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityInbox from "./CommunityInbox.svelte";
  import type { CommunityInboxFilter, CommunityInboxModel } from "./model.js";
  import { communityInboxFixture } from "./story-fixtures.js";

  const shell = new AppShellController();
  let activeItemId = $state("First");
  let filter = $state<CommunityInboxFilter>("All");
  let unreadOnly = $state(false);
  let items = $state(
    ["First", "Second", "Older"].map((id) => ({
      id,
      authorId: "fizz",
      context: `${id} thread`,
      timestamp: "Today",
      excerpt: `${id} discussion`,
      categories: ["Threads" as const],
      unread: id === "Second",
    })),
  );
  const selectedItem = $derived(
    items.find((item) => item.id === activeItemId)!,
  );
  const model: CommunityInboxModel = $derived({
    ...communityInboxFixture,
    items,
    activeItemId,
    selectedItem,
    threadTitle: selectedItem.context,
    filter,
    unreadOnly,
    messages: [
      {
        id: `${activeItemId}-message`,
        authorId: "fizz",
        timestamp: "Today",
        content: `${activeItemId} conversation content`,
      },
    ],
  });
</script>

<CommunityAppShell
  controller={shell}
  displayMode="desktop"
  desktopMinMainWidth={0}
>
  <AppShell.Main>
    <AppShell.Toolbar label="Inbox fixture controls">
      <Button
        onclick={() => {
          items = items.map((item) =>
            item.id === "First" ? { ...item, unread: true } : item,
          );
        }}>Receive a new First reply</Button
      >
    </AppShell.Toolbar>
    <CommunityInbox
      {model}
      onSelect={(id) => {
        activeItemId = id;
      }}
      onFilterChange={(nextFilter, nextUnreadOnly) => {
        filter = nextFilter;
        unreadOnly = nextUnreadOnly;
      }}
      readBoundary={{
        key: activeItemId,
        onRead: () => {
          if (!selectedItem.unread) return;
          items = items.map((item) =>
            item.id === activeItemId ? { ...item, unread: false } : item,
          );
        },
      }}
      onMarkAllRead={() => {
        items = items.map((item) => ({ ...item, unread: false }));
      }}
      onSend={() => {}}
      onOpenChannelSettings={() => {}}
    />
  </AppShell.Main>
</CommunityAppShell>
