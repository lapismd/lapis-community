<script lang="ts">
  import {
    Composer,
    Layout,
    MessageList,
    SystemMessage,
  } from "@lapismd/design-core/ai/chat";

  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityMessageModel,
    type CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    room,
    messages,
    members,
    onSend,
    onOpenThread,
    onToggleReaction,
    onAddReaction,
  }: {
    room: CommunityRoomModel;
    messages: CommunityMessageModel[];
    members: CommunityMemberModel[];
    onSend?: (content: string) => void;
    onOpenThread?: (messageId: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onAddReaction?: (messageId: string, emoji: string) => void;
  } = $props();

  let draft = $state("");
  const density = $derived(room.kind === "forum" ? "spacious" : "compact");
</script>

<div class="community-conversation" data-room-kind={room.kind}>
  <Layout
    {density}
    aria-label={`${room.name} conversation`}
    isEmpty={messages.length === 0}
  >
    {#snippet emptyState()}
      <div class="community-conversation__empty">
        <strong>Start the conversation in {room.name}</strong>
        <span>Messages published to this room will appear here.</span>
      </div>
    {/snippet}
    {#snippet composer()}
      <Composer
        {density}
        bind:value={draft}
        placeholder={`Message ${room.kind === "channel" ? "#" : ""}${room.name}`}
        onSubmit={(content) => onSend?.(content)}
      />
    {/snippet}

    <MessageList
      {density}
      latestMessageId={messages.at(-1)?.id ?? ""}
      aria-label={`${room.name} messages`}
    >
      <SystemMessage variant="divider">Today</SystemMessage>
      {#each messages as message (message.id)}
        <CommunityMessage
          {message}
          author={memberById(members, message.authorId)}
          {density}
          onOpenThread={(messageId) => onOpenThread?.(messageId)}
          onToggleReaction={(messageId, emoji) =>
            onToggleReaction?.(messageId, emoji)}
          onAddReaction={(messageId, emoji) =>
            onAddReaction?.(messageId, emoji)}
        />
      {/each}
    </MessageList>
  </Layout>
</div>

<style>
  .community-conversation {
    display: flex;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-conversation :global([data-ui-component="ai-chat-layout"]) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .community-conversation__empty {
    display: grid;
    place-items: center;
    gap: 0.4rem;
    padding: 3rem 1rem;
    color: var(--muted-foreground);
    text-align: center;
  }

  .community-conversation__empty strong {
    color: var(--foreground);
  }
</style>
