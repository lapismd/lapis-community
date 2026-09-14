<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import type {
    CommunityTimelinePresentation,
    CommunityTimelinePosition,
  } from "../../community/index.js";
  import CommunityConversation from "./CommunityConversation.svelte";
  import {
    communityStoryMembers,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import type { CommunityMessageModel } from "../community-workspace/model.js";
  const room = communityStoryNavigation[0]!.rooms[1]!;
  let messages = $state<CommunityMessageModel[]>(
    Array.from({ length: 1000 }, (_, index) => ({
      id: `cached-${index}`,
      authorId: index % 3 ? "ada" : "ben",
      timestamp: "09:30",
      createdAt: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
      content: `Message **${index}** with [a reference](https://example.test).\n\n${"Variable-height cached Markdown content. ".repeat((index % 7) + 1)}`,
    })),
  );
  let unread = $state<string[]>([]);
  let presentation = $state<CommunityTimelinePresentation>({
    key: "identity:channel-a",
    draft: "",
  });
  let narrow = $state(false);
  let loads = $state(0);
  let loading = $state(false);
  function update(
    key: string,
    change: { draft?: string; position?: CommunityTimelinePosition },
  ) {
    if (key !== presentation.key) return;
    if (change.draft === presentation.draft && !change.position) return;
    if (
      change.position &&
      JSON.stringify(change.position) === JSON.stringify(presentation.position)
    )
      return;
    presentation = { ...presentation, ...change };
  }
  function append(authorId: string) {
    const id = `incoming-${messages.length}`;
    messages = [
      ...messages,
      { id, authorId, timestamp: "Now", content: `Fresh message ${id}` },
    ];
    if (authorId !== "noor") unread = [...unread, id];
  }
</script>

<div>
  <Button onclick={() => (narrow = !narrow)}>Resize conversation</Button>
  <Button onclick={() => append("ada")}>Receive message</Button>
  <Button onclick={() => append("noor")}>Send own message</Button>
  <output aria-label="Older page requests">{loads}</output>
  <output aria-label="Saved reading anchor"
    >{presentation.position?.messageId ?? "none"}</output
  >
  <output aria-label="Unread arrivals">{unread.length}</output>
  <output aria-label="Reading latest"
    >{String(presentation.position?.atLatest ?? true)}</output
  >
  <div
    data-story="rich-history-frame"
    style:width={narrow ? "360px" : "800px"}
    style="height: 520px; max-width: 100%;"
  >
    <CommunityConversation
      {room}
      {messages}
      members={communityStoryMembers}
      currentMemberId="noor"
      virtualize
      {presentation}
      onPresentationChange={update}
      history={{
        hasOlder: true,
        hasNewer: false,
        loading,
        unreadEventIds: unread,
      }}
      readBoundary={{
        key: messages.at(-1)?.id ?? "empty",
        onRead: () => (unread = []),
      }}
      onLoadOlder={async () => {
        loads++;
        loading = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        messages = [
          ...Array.from({ length: 50 }, (_, index) => ({
            id: `older-${loads}-${index}`,
            authorId: "ben",
            timestamp: "Earlier",
            content: `Earlier message ${index}`,
          })),
          ...messages,
        ];
        loading = false;
      }}
      onLoadLatest={async () => {}}
      onSend={async () => {}}
    />
  </div>
</div>
