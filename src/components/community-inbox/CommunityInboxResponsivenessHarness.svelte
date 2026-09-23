<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityApplicationInboxHost from "../community-application/CommunityApplicationInboxHost.svelte";
  import type { CommunityInboxModel } from "./model.js";

  const shell = new AppShellController();
  const room = { id: "room", name: "Development", kind: "channel" as const };
  const rooms = [room];
  const members = [
    { id: "avery", name: "Avery", handle: "avery", initials: "AV" },
  ];
  const items = ["First", "Second", "Third"].map((name) => ({
    id: name,
    authorId: "avery",
    context: `${name} thread`,
    excerpt: `Read the ${name.toLowerCase()} discussion`,
    timestamp: "Today",
    rootEventId: `${name}-0`,
    latestEventId: `${name}-19`,
  }));
  let selected = $state("First");
  let showInbox = $state(true);
  let selectionCalls = $state<string[]>([]);
  let refresh = $state(0);
  let reportedReads = $state(0);
  let skeletonBeforeSelection = $state(false);
  let host = $state<HTMLElement>();
  let parentReads = 0;
  const model: CommunityInboxModel = $derived({
    get room() {
      parentReads += 1;
      return room;
    },
    members,
    items,
    activeItemId: selected,
    selectedItem: items.find((item) => item.id === selected)!,
    threadTitle: `${selected} thread`,
    messages: Array.from({ length: 20 }, (_, index) => ({
      id: `${selected}-${index}`,
      authorId: "avery",
      content: `${selected} discussion message ${index}. This conversation has enough content to scroll and exercise every message's identity and action controls.`,
      timestamp: "Today",
      ...(index ? { parentMessageId: `${selected}-0` } : {}),
    })),
  });
  // Real application adapters expose reactive getters through spread props.
  // Count reads at that boundary, independently of wall-clock/browser speed.
  const adapter = {
    get model() {
      parentReads += 1;
      refresh;
      return model;
    },
    get rooms() {
      parentReads += 1;
      refresh;
      return rooms;
    },
    get disabled() {
      parentReads += 1;
      refresh;
      return false;
    },
    onSelect(itemId: string) {
      skeletonBeforeSelection = Boolean(
        host?.querySelector(
          '[role="status"][aria-label="Loading Inbox messages"]',
        ),
      );
      selectionCalls = [...selectionCalls, itemId];
      selected = itemId;
    },
    onSend() {},
    onMarkAllRead() {},
    onOpenChannelSettings() {},
  };
</script>

<div
  bind:this={host}
  data-testid="inbox-responsiveness"
  data-parent-reads={reportedReads}
  data-selection-calls={selectionCalls.join(",")}
  data-skeleton-before-selection={skeletonBeforeSelection}
  style="height: 100%;"
>
  <CommunityAppShell
    controller={shell}
    displayMode="desktop"
    desktopMinMainWidth={0}
  >
    <AppShell.Main>
      <AppShell.Toolbar label="Inbox test controls">
        <Button
          onclick={() => {
            reportedReads = parentReads;
          }}>Report parent reads</Button
        >
        <Button
          onclick={() => {
            parentReads = 0;
            refresh += 1;
          }}>Refresh adapter</Button
        >
        <Button onclick={() => (showInbox = false)}>Hide inbox</Button>
      </AppShell.Toolbar>
      {#if showInbox}<CommunityApplicationInboxHost {...adapter} />{/if}
    </AppShell.Main>
  </CommunityAppShell>
</div>
