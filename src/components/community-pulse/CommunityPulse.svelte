<script lang="ts">
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as InputGroup from "@lapismd/design-core/shadcn/input-group";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import AlertCircleIcon from "@lucide/svelte/icons/circle-alert";
  import BotIcon from "@lucide/svelte/icons/bot";
  import HeartIcon from "@lucide/svelte/icons/heart";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import ReplyIcon from "@lucide/svelte/icons/reply";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Share2Icon from "@lucide/svelte/icons/share-2";
  import { onMount } from "svelte";

  import type {
    CommunityPulseAgentActivityModel,
    CommunityPulseNoteModel,
    CommunityPulseTab,
  } from "../../community/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import type { CommunityPulseProps } from "./model.js";

  let {
    model,
    currentMember,
    rooms = [],
    communityEmojis = [],
    draftStore,
    mediaAdapter,
    publishOperation,
    composerStatus,
    onSelectTab,
    onPublish,
    onToggleLike,
    onShare,
    onOpenProfile,
    onMessageMember,
    onRetry,
    onDismissError,
    class: className = "",
  }: CommunityPulseProps = $props();

  let replyToId = $state("");
  let searchQuery = $state("");
  let localError = $state("");
  let composerExpanded = $state(false);
  let composerValue = $state("");
  let composerElement = $state<HTMLDivElement>();

  const visibleTabs = $derived<readonly CommunityPulseTab[]>([
    "search",
    "everyone",
    "following",
    "liked",
    ...(model.agents === undefined ? [] : (["agents"] as const)),
    "mine",
  ]);
  const composerMembers = $derived([
    ...(currentMember === undefined ? [] : [currentMember]),
    ...model.members.filter((member) => member.id !== currentMember?.id),
  ]);
  const busy = $derived(publishOperation?.status === "pending");

  function tabLabel(tab: CommunityPulseTab): string {
    switch (tab) {
      case "search":
        return "Search";
      case "everyone":
        return "Everyone";
      case "following":
        return "Following";
      case "liked":
        return "Liked";
      case "agents":
        return "Agents";
      case "mine":
        return "Mine";
    }
  }

  function emptyCopy(tab: CommunityPulseTab): {
    title: string;
    description: string;
  } {
    switch (tab) {
      case "following":
        return {
          title: "No notes from people you follow yet",
          description:
            "New public notes from your NIP-02 contacts will appear here.",
        };
      case "liked":
        return {
          title: "No liked notes yet",
          description: "Notes you like will be collected here.",
        };
      case "agents":
        return {
          title: "No agent notes yet",
          description: "Agents post here when they publish.",
        };
      case "mine":
        return {
          title: "You haven’t posted yet",
          description: "Share a public note to start your Pulse.",
        };
      default:
        return {
          title: "No notes yet",
          description: "Public notes from the community will appear here.",
        };
    }
  }

  function fullDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestamp * 1_000);
  }

  function relativeDate(timestamp: number): string {
    const seconds = Math.max(0, Math.floor(Date.now() / 1_000) - timestamp);
    const relative = new Intl.RelativeTimeFormat(undefined, {
      numeric: "auto",
    });
    if (seconds < 60) return relative.format(-seconds, "second");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return relative.format(-minutes, "minute");
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return relative.format(-hours, "hour");
    const days = Math.floor(hours / 24);
    if (days < 7) return relative.format(-days, "day");
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(timestamp * 1_000);
  }

  async function chooseTab(tab: CommunityPulseTab): Promise<void> {
    localError = "";
    try {
      await onSelectTab?.(tab);
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "The tab could not be opened";
    }
  }

  async function publish(
    submission: Parameters<NonNullable<typeof onPublish>>[0],
    targetId?: string,
  ): Promise<void> {
    localError = "";
    try {
      await onPublish?.(submission, targetId);
      if (targetId !== undefined) replyToId = "";
      else composerExpanded = false;
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "The note could not be published";
      throw cause;
    }
  }

  async function toggleLike(note: CommunityPulseNoteModel): Promise<void> {
    localError = "";
    try {
      await onToggleLike?.(note.id);
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "The reaction could not be updated";
    }
  }

  async function share(note: CommunityPulseNoteModel): Promise<void> {
    localError = "";
    try {
      await onShare?.(note.id);
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "The note could not be shared";
    }
  }

  function onRetryComposerStatus(): void {
    void onRetry?.();
  }

  function onDismissComposerStatus(): void {
    localError = "";
    onDismissError?.();
  }

  onMount(() => {
    function collapseEmptyComposer(event: PointerEvent): void {
      const target = event.target;
      if (
        !composerExpanded ||
        composerValue.trim() !== "" ||
        !(target instanceof Node) ||
        composerElement?.contains(target)
      ) {
        return;
      }
      if (
        document.activeElement instanceof HTMLElement &&
        composerElement?.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
      composerExpanded = false;
    }

    document.addEventListener("pointerdown", collapseEmptyComposer);
    return () =>
      document.removeEventListener("pointerdown", collapseEmptyComposer);
  });
</script>

{#snippet noteTime(note: CommunityPulseNoteModel, className = "")}
  <Tooltip.Provider delayDuration={0}>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <time
            {...props}
            class={className}
            datetime={new Date(note.createdAt * 1_000).toISOString()}
          >
            {relativeDate(note.createdAt)}
          </time>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        {fullDate(note.createdAt)}
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{/snippet}

{#snippet noteActions(note: CommunityPulseNoteModel)}
  <div
    class="community-pulse__note-actions"
    aria-label={`Actions for ${note.author.name}'s note`}
  >
    <Button
      type="button"
      variant="ghost"
      size={note.likeCount > 0 ? "sm" : "icon-sm"}
      data-selected={note.likedByCurrentUser || undefined}
      aria-pressed={note.likedByCurrentUser}
      aria-label={`${note.likedByCurrentUser ? "Unlike" : "Like"} ${note.author.name}'s note`}
      title={note.likedByCurrentUser ? "Unlike" : "Like"}
      onclick={() => void toggleLike(note)}
    >
      <HeartIcon
        data-icon="inline-start"
        aria-hidden="true"
        fill={note.likedByCurrentUser ? "currentColor" : "none"}
      />
      {#if note.likeCount > 0}<span aria-hidden="true">{note.likeCount}</span
        >{/if}
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-expanded={replyToId === note.id}
      aria-label={`Reply to ${note.author.name}'s note`}
      title="Reply"
      onclick={() => (replyToId = replyToId === note.id ? "" : note.id)}
    >
      <ReplyIcon aria-hidden="true" />
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Share ${note.author.name}'s note`}
      title="Share"
      onclick={() => void share(note)}
    >
      <Share2Icon aria-hidden="true" />
    </Button>
    {#if model.canDirectMessage && !note.currentUserOwns && onMessageMember}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Start DM with ${note.author.name}`}
        title="Start DM"
        onclick={() => onMessageMember?.(note.author)}
      >
        <MessageCircleIcon aria-hidden="true" />
      </Button>
    {/if}
  </div>
{/snippet}

{#snippet noteContent(note: CommunityPulseNoteModel, showIdentity = true)}
  <article
    class="community-pulse__note"
    data-ui-part="pulse-note"
    aria-labelledby={showIdentity ? `pulse-note-${note.id}` : undefined}
    aria-label={showIdentity ? undefined : `${note.author.name}'s note`}
  >
    {#if showIdentity}
      <CommunityMemberHoverCard
        member={note.author}
        {...onOpenProfile === undefined ? {} : { onOpenProfile }}
        {...model.canDirectMessage && !note.currentUserOwns && onMessageMember
          ? { onMessage: onMessageMember }
          : {}}
      />
    {/if}
    <div
      class="community-pulse__note-main"
      data-without-identity={!showIdentity || undefined}
    >
      {#if showIdentity}
        <header class="community-pulse__note-header">
          <button
            type="button"
            id={`pulse-note-${note.id}`}
            onclick={() => onOpenProfile?.(note.author)}
          >
            {note.currentUserOwns ? "You" : note.author.name}
          </button>
          {@render noteTime(note)}
        </header>
      {:else}
        {@render noteTime(note, "community-pulse__agent-note-time")}
      {/if}
      {#if note.parent}
        <div class="community-pulse__parent" data-ui-part="pulse-parent">
          <CommunityMemberHoverCard
            member={note.parent.author}
            avatarSize="xsmall"
            {...onOpenProfile === undefined ? {} : { onOpenProfile }}
            {...model.canDirectMessage &&
            note.parent.author.id !== currentMember?.id &&
            onMessageMember
              ? { onMessage: onMessageMember }
              : {}}
          />
          <strong>{note.parent.author.name}</strong>
          <span>{note.parent.content}</span>
        </div>
      {/if}
      <CommunityMarkdownContent
        content={note.content}
        mentionPubkeys={note.mentionPubkeys}
        members={composerMembers}
        {rooms}
        {communityEmojis}
        {...onOpenProfile === undefined ? {} : { onOpenMember: onOpenProfile }}
        {...!model.canDirectMessage || onMessageMember === undefined
          ? {}
          : { onMessageMember }}
      />
      {@render noteActions(note)}
      {#if replyToId === note.id}
        <div
          class="community-pulse__reply-composer"
          data-ui-part="pulse-reply-composer"
        >
          <CommunityChatComposer
            placeholder="Post your reply"
            ariaLabel={`Reply to ${note.author.name}`}
            submitLabel="Post reply"
            members={composerMembers}
            {rooms}
            {communityEmojis}
            {...currentMember === undefined
              ? {}
              : { currentMemberId: currentMember.id }}
            context={{
              kind: "reply",
              target: {
                eventId: note.id,
                roomId: "pulse",
                authorId: note.author.id,
                authorName: note.author.name,
                content: note.content,
                kind: "channel",
              },
            }}
            {busy}
            {...composerStatus === undefined ? {} : { composerStatus }}
            onSubmit={(submission) => publish(submission, note.id)}
            onCancelContext={() => (replyToId = "")}
          />
        </div>
      {/if}
    </div>
  </article>
{/snippet}

{#snippet agentActivity(activity: CommunityPulseAgentActivityModel)}
  {@const member = activity.notes[0]?.author}
  <section
    class="community-pulse__agent-activity"
    aria-labelledby={`pulse-agent-${activity.id}`}
  >
    <header class="community-pulse__agent-header">
      {#if member}
        <CommunityMemberAvatar {member} decorative />
      {/if}
      <span>
        <strong id={`pulse-agent-${activity.id}`}>{activity.agent.name}</strong>
        {#if activity.agent.status}<small>{activity.agent.status}</small>{/if}
      </span>
      <CommunityChip variant="muted"
        ><BotIcon
          data-icon="inline-start"
          aria-hidden="true"
        />Agent</CommunityChip
      >
    </header>
    <div class="community-pulse__agent-notes">
      {#each activity.notes as note (note.id)}
        {@render noteContent(note, false)}
      {/each}
    </div>
  </section>
{/snippet}

<section
  class={`community-pulse ${className}`.trim()}
  data-ui-component="community-pulse"
  aria-label="Pulse"
>
  <div class="community-pulse__frame">
    <Tabs.Root value={model.tab} class="community-pulse__tabs">
      <div class="community-pulse__tab-scroll">
        <Tabs.List aria-label="Pulse feeds">
          {#each visibleTabs as tab (tab)}
            <Tabs.Trigger
              value={tab}
              aria-label={tab === "search" ? "Search Pulse" : undefined}
              onclick={() => void chooseTab(tab)}
            >
              {#if tab === "search"}
                <SearchIcon aria-hidden="true" />
                <span class="sr-only">Search</span>
              {:else}
                {tabLabel(tab)}
                {#if tab === "agents"}
                  <CommunityChip
                    variant="muted"
                    size="compact"
                    tone={model.tab === "agents" ? "accent" : "neutral"}
                    >{model.agents?.length ?? 0}</CommunityChip
                  >
                {/if}
              {/if}
            </Tabs.Trigger>
          {/each}
        </Tabs.List>
      </div>

      <Tabs.Content value={model.tab} class="community-pulse__content">
        {#if model.tab === "search"}
          <div class="community-pulse__search">
            <h1>What are you looking for?</h1>
            <InputGroup.Root>
              <InputGroup.Input
                bind:value={searchQuery}
                placeholder="What would you like to know?"
                aria-label="Search Pulse"
              />
              <InputGroup.Addon align="inline-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  class="community-pulse__search-button"
                  aria-label="Search Pulse"
                  title="Search"
                >
                  <SearchIcon aria-hidden="true" />
                </Button>
              </InputGroup.Addon>
            </InputGroup.Root>
          </div>
        {:else}
          {#if model.tab !== "agents" && currentMember}
            <div
              bind:this={composerElement}
              class="community-pulse__composer"
              data-ui-part="pulse-composer"
              data-expanded={composerExpanded || undefined}
            >
              <CommunityMemberAvatar member={currentMember} decorative />
              <div class="community-pulse__composer-heading">
                <strong>{currentMember.name}</strong>
                {#if !composerExpanded}
                  <button
                    type="button"
                    class="community-pulse__composer-prompt"
                    onclick={() => (composerExpanded = true)}
                  >
                    What’s on your mind?
                  </button>
                {/if}
              </div>
              {#if !composerExpanded}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open Pulse composer"
                  title="Write a Pulse note"
                  onclick={() => (composerExpanded = true)}
                >
                  <PlusIcon aria-hidden="true" />
                </Button>
              {:else}
                <div class="community-pulse__composer-editor">
                  <CommunityChatComposer
                    bind:value={composerValue}
                    placeholder="What’s on your mind?"
                    ariaLabel="Pulse composer"
                    submitLabel="Post note"
                    members={composerMembers}
                    {rooms}
                    {communityEmojis}
                    currentMemberId={currentMember.id}
                    draftKey="pulse:composer"
                    {...draftStore === undefined ? {} : { draftStore }}
                    {...mediaAdapter === undefined ? {} : { mediaAdapter }}
                    {busy}
                    {...composerStatus === undefined ? {} : { composerStatus }}
                    {onRetryComposerStatus}
                    {onDismissComposerStatus}
                    onSubmit={publish}
                  />
                </div>
              {/if}
            </div>
          {/if}

          {#if localError || model.error}
            <Alert.Root variant="destructive" role="alert">
              <AlertCircleIcon aria-hidden="true" />
              <Alert.Title>Pulse needs attention</Alert.Title>
              <Alert.Description>{localError || model.error}</Alert.Description>
              {#if onRetry || onDismissError}
                <Alert.Action>
                  {#if onRetry}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onclick={() => onRetry?.()}
                    >
                      <RefreshCwIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />Retry
                    </Button>
                  {/if}
                  {#if onDismissError}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onclick={() => {
                        localError = "";
                        onDismissError?.();
                      }}>Dismiss</Button
                    >
                  {/if}
                </Alert.Action>
              {/if}
            </Alert.Root>
          {/if}

          {#if model.status === "loading" && model.notes.length === 0}
            <div
              class="community-pulse__skeletons"
              aria-label="Loading Pulse"
              role="status"
            >
              {#each [1, 2, 3] as row (row)}
                <div class="community-pulse__skeleton">
                  <Skeleton class="community-pulse__skeleton-avatar" />
                  <span>
                    <Skeleton class="community-pulse__skeleton-heading" />
                    <Skeleton class="community-pulse__skeleton-line" />
                    <Skeleton
                      class="community-pulse__skeleton-line community-pulse__skeleton-line--short"
                    />
                  </span>
                </div>
              {/each}
            </div>
          {:else if model.notes.length === 0}
            {@const copy = emptyCopy(model.tab)}
            <Empty.Root>
              <Empty.Header>
                <Empty.Title>{copy.title}</Empty.Title>
                <Empty.Description>{copy.description}</Empty.Description>
              </Empty.Header>
              {#if model.status === "error" && onRetry}
                <Empty.Content>
                  <Button
                    type="button"
                    variant="outline"
                    onclick={() => onRetry?.()}
                  >
                    <RefreshCwIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Try again
                  </Button>
                </Empty.Content>
              {/if}
            </Empty.Root>
          {:else if model.tab === "agents"}
            <div class="community-pulse__feed" data-ui-part="pulse-agent-feed">
              {#each model.agentActivities as activity (activity.id)}
                {@render agentActivity(activity)}
              {/each}
            </div>
          {:else}
            <div class="community-pulse__feed" data-ui-part="pulse-feed">
              {#each model.notes as note (note.id)}
                {@render noteContent(note)}
              {/each}
            </div>
          {/if}
        {/if}
      </Tabs.Content>
    </Tabs.Root>
  </div>
</section>

<style>
  .community-pulse {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    padding: 1rem clamp(0.75rem, 3vw, 2rem) 4rem;
    color: var(--foreground);
  }

  .community-pulse__frame {
    width: min(100%, 42rem);
    margin-inline: auto;
  }

  .community-pulse :global(.community-pulse__tabs) {
    width: 100%;
    flex-direction: column;
    gap: 1rem;
  }

  .community-pulse__tab-scroll {
    display: flex;
    justify-content: center;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .community-pulse__tab-scroll::-webkit-scrollbar {
    display: none;
  }

  .community-pulse__tab-scroll :global([data-ui-part="tabs-list"]) {
    flex: none;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .community-pulse__tab-scroll :global([data-ui-part="tabs-trigger"]) {
    min-width: fit-content;
    border-radius: 999px;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  .community-pulse__tab-scroll :global([data-ui-part="tabs-trigger"]:hover) {
    background: color-mix(in oklab, var(--muted) 72%, transparent);
  }

  .community-pulse__tab-scroll
    :global([data-ui-part="tabs-trigger"][data-state="active"]) {
    background: var(--muted);
  }

  .community-pulse :global(.community-pulse__content) {
    display: grid;
    gap: 1rem;
    outline: none;
  }

  .community-pulse__composer {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid color-mix(in oklab, var(--border) 76%, transparent);
    border-radius: 1rem;
    background: color-mix(in oklab, var(--background) 92%, transparent);
    box-shadow: 0 0.75rem 2.5rem
      color-mix(in oklab, var(--foreground) 6%, transparent);
    backdrop-filter: blur(12px);
  }

  .community-pulse__composer-heading {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 0.75rem;
  }

  .community-pulse__composer-heading > strong {
    flex: none;
    font-size: 0.82rem;
  }

  .community-pulse__composer-prompt {
    min-width: 0;
    overflow: hidden;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    font: inherit;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }

  .community-pulse__composer-editor {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .community-pulse__composer[data-expanded] {
    row-gap: 0.25rem;
    padding-bottom: 0.35rem;
  }

  .community-pulse__composer-editor
    :global([data-ui-component="ai-chat-composer"] [data-ui-part="body"]) {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .community-pulse__composer :global([data-ui-component="ai-chat-composer"]) {
    --ui-ai-chat-composer-padding: 0;
  }

  .community-pulse__feed,
  .community-pulse__skeletons {
    display: grid;
    gap: 0.5rem;
  }

  .community-pulse__note {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.75rem 0.25rem;
  }

  .community-pulse__note-main {
    display: grid;
    min-width: 0;
    gap: 0.55rem;
  }

  .community-pulse__note-main[data-without-identity] {
    grid-column: 1 / -1;
  }

  .community-pulse__note-header {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 0.5rem;
  }

  .community-pulse__note-header button {
    min-width: 0;
    overflow: hidden;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .community-pulse__note-header time {
    flex: none;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .community-pulse__agent-note-time {
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .community-pulse__parent {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: center;
    min-width: 0;
    gap: 0.4rem;
    padding: 0.3rem 0.55rem 0.3rem 0.35rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--secondary);
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .community-pulse__parent strong {
    color: var(--secondary-foreground);
    font-weight: 600;
  }

  .community-pulse__parent span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-pulse__note-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-left: -0.5rem;
  }

  .community-pulse__note-actions :global(button[data-selected]) {
    color: var(--primary);
  }

  .community-pulse__reply-composer {
    margin-top: 0.2rem;
  }

  .community-pulse__reply-composer
    :global([data-ui-component="ai-chat-composer"]) {
    --ui-composer-radius: 1rem;
  }

  .community-pulse__agent-activity {
    display: grid;
    gap: 0.5rem;
    padding: 1rem;
  }

  .community-pulse__agent-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
  }

  .community-pulse__agent-header > span {
    display: grid;
    min-width: 0;
  }

  .community-pulse__agent-header small {
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-pulse__agent-notes {
    display: grid;
    margin-left: 3rem;
  }

  .community-pulse__agent-notes .community-pulse__note {
    padding-block: 0.75rem;
  }

  .community-pulse__search {
    display: grid;
    width: min(100%, 32rem);
    gap: 1.25rem;
    margin: clamp(4rem, 18vh, 10rem) auto 0;
    text-align: center;
  }

  .community-pulse__search h1 {
    margin: 0;
    font-size: clamp(1.5rem, 3vw, 2.1rem);
    letter-spacing: -0.035em;
  }

  .community-pulse__search :global([data-ui-part="input-group"]) {
    height: 3rem;
    border: 1px solid
      color-mix(in oklab, var(--muted-foreground) 34%, var(--border));
    border-radius: 999px;
    background: var(--background);
    box-shadow:
      0 0.75rem 2rem color-mix(in oklab, var(--foreground) 11%, transparent),
      0 0.15rem 0.4rem color-mix(in oklab, var(--foreground) 7%, transparent);
  }

  .community-pulse__search :global(.community-pulse__search-button) {
    border-radius: 999px;
    background: var(--secondary);
    color: var(--secondary-foreground);
  }

  .community-pulse__skeleton {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem;
    padding: 1rem 0.25rem;
  }

  .community-pulse__skeleton > span {
    display: grid;
    gap: 0.55rem;
  }

  .community-pulse :global(.community-pulse__skeleton-avatar) {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
  }

  .community-pulse :global(.community-pulse__skeleton-heading) {
    width: 32%;
    height: 0.8rem;
  }

  .community-pulse :global(.community-pulse__skeleton-line) {
    width: 92%;
    height: 0.75rem;
  }

  .community-pulse :global(.community-pulse__skeleton-line--short) {
    width: 58%;
  }

  .community-pulse :global([data-ui-component="empty"][data-ui-part="empty"]) {
    min-height: 13rem;
    border: 1px dashed var(--border);
  }

  .community-pulse
    :global([data-variant="destructive"] [data-ui-part="alert-description"]) {
    color: color-mix(in srgb, var(--destructive) 88%, var(--foreground));
  }

  @media (max-width: 42rem) {
    .community-pulse {
      padding-inline: 0.75rem;
    }

    .community-pulse__tab-scroll {
      justify-content: start;
    }

    .community-pulse__agent-notes {
      margin-left: 0;
    }

    .community-pulse__note-actions :global(button) {
      padding-inline: 0.45rem;
    }
  }
</style>
