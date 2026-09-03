<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import { AppShell } from "@lapismd/design-core/shell";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import UsersIcon from "@lucide/svelte/icons/users";

  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
  import { memberById } from "../community-workspace/model.js";
  import type { CommunityInboxModel } from "./model.js";
  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import "./CommunityInbox.css";

  let {
    model,
    onSelect = () => {},
    onSend = () => {},
    onMarkAllRead = () => {},
    onOpenChannelSettings = () => {},
    onOpenChannel,
    onViewParticipants,
    onHuddle,
    onReply,
    onToggleReaction,
    onCopyMessageLink,
    onCopyMessage,
    onEditMessage,
    onDeleteMessage,
    onOpenProfile,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
  }: {
    model: CommunityInboxModel;
    onSelect?: (itemId: string) => void;
    onSend?: (content: string) => void | Promise<void>;
    onMarkAllRead?: () => void;
    onOpenChannelSettings?: () => void;
    onOpenChannel?: () => void;
    onViewParticipants?: () => void;
    onHuddle?: () => void;
    onReply?: (messageId: string) => void;
    onToggleReaction?: (
      messageId: string,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) => void;
    onCopyMessageLink?: (messageId: string) => void;
    onCopyMessage?: (messageId: string) => void;
    onEditMessage?: (messageId: string) => void;
    onDeleteMessage?: (messageId: string) => void;
    onOpenProfile?: (
      member: import("../community-workspace/model.js").CommunityMemberModel,
    ) => void;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onCancelReply?: () => void;
  } = $props();

  let filter = $state("All");
  let showUnreadOnly = $state(false);
  let allMarkedRead = $state(false);
  let bodyElement = $state<HTMLElement | null>(null);
  let listElement = $state<HTMLElement | null>(null);
  let listWidth = $state<number>();
  let resizePointerId = $state<number | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let visibleItems = $derived(
    showUnreadOnly
      ? model.items.filter((item) => item.unread && !allMarkedRead)
      : model.items,
  );

  function markAllRead(): void {
    allMarkedRead = true;
    onMarkAllRead();
  }

  function resizeBounds(): { min: number; max: number } {
    const min = 224;
    const available = (bodyElement?.clientWidth ?? 704) - 320;
    return { min, max: Math.max(min, Math.min(480, available)) };
  }

  function clampListWidth(width: number): number {
    const { min, max } = resizeBounds();
    return Math.min(max, Math.max(min, width));
  }

  function currentListWidth(): number {
    return listWidth ?? listElement?.getBoundingClientRect().width ?? 368;
  }

  function beginResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    resizePointerId = event.pointerId;
    resizeStartX = event.clientX;
    resizeStartWidth = currentListWidth();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveResize(event: PointerEvent): void {
    if (event.pointerId !== resizePointerId) return;
    listWidth = clampListWidth(resizeStartWidth + event.clientX - resizeStartX);
  }

  function finishResize(event: PointerEvent): void {
    if (event.pointerId !== resizePointerId) return;
    resizePointerId = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function resizeWithKeyboard(event: KeyboardEvent): void {
    const { min, max } = resizeBounds();
    let nextWidth = currentListWidth();
    if (event.key === "ArrowLeft") nextWidth -= 16;
    else if (event.key === "ArrowRight") nextWidth += 16;
    else if (event.key === "Home") nextWidth = min;
    else if (event.key === "End") nextWidth = max;
    else return;
    event.preventDefault();
    listWidth = clampListWidth(nextWidth);
  }
</script>

<AppShell.Body
  bind:ref={bodyElement}
  layout="regions"
  label="Inbox workspace"
  class="lc-community-inbox"
  style={listWidth === undefined
    ? undefined
    : `--ui-shell-body-sidebar-width: ${listWidth}px`}
>
  <AppShell.Body.Sidebar
    bind:ref={listElement}
    panelId="inbox-conversations"
    side="left"
    label="Inbox conversations"
    mobileLabel="Inbox conversations"
    class="lc-community-inbox__list-region"
  >
    <div class="lc-community-inbox__list">
      <header class="lc-community-inbox__list-header">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="ghost" size="sm">
                <span>{filter}</span>
                <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="start"
            sideOffset={4}
            class="lc-community-inbox__filter-menu"
          >
            <DropdownMenu.Group>
              <DropdownMenu.RadioGroup bind:value={filter}>
                {#each ["All", "Mentions", "Threads"] as option}
                  <DropdownMenu.RadioItem value={option}>
                    {option}
                  </DropdownMenu.RadioItem>
                {/each}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                aria-label="Inbox options"
                title="Inbox options"
              >
                <EllipsisIcon aria-hidden="true" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            class="lc-community-inbox__options-menu"
          >
            <DropdownMenu.Group>
              <DropdownMenu.CheckboxItem
                bind:checked={showUnreadOnly}
                class="lc-community-inbox__unread-toggle"
              >
                <span>Show unread only</span>
                <Switch
                  checked={showUnreadOnly}
                  size="sm"
                  aria-hidden="true"
                  tabindex={-1}
                />
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onSelect={markAllRead}>
                Mark all as read
              </DropdownMenu.Item>
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </header>

      <div class="lc-community-inbox__items" aria-label="Inbox items">
        {#each visibleItems as item (item.id)}
          {@const author = memberById(model.members, item.authorId)}
          <Button
            variant="ghost"
            class="lc-community-inbox__item"
            data-active={item.id === model.activeItemId ? "" : undefined}
            data-unread={item.unread && !allMarkedRead ? "" : undefined}
            aria-pressed={item.id === model.activeItemId}
            onclick={() => onSelect(item.id)}
          >
            <span class="lc-community-inbox__avatar" aria-hidden="true">
              {author.initials}
            </span>
            <span class="lc-community-inbox__item-body">
              <span class="lc-community-inbox__item-heading">
                <strong>{author.name}</strong>
                <span>{item.timestamp}</span>
              </span>
              <span class="lc-community-inbox__context">{item.context}</span>
              <span class="lc-community-inbox__excerpt">{item.excerpt}</span>
            </span>
          </Button>
        {/each}
        {#if visibleItems.length === 0}
          <p class="lc-community-inbox__empty">You're all caught up</p>
        {/if}
      </div>
    </div>
  </AppShell.Body.Sidebar>

  <button
    type="button"
    class="lc-community-inbox__resize-handle"
    data-resizing={resizePointerId === null ? undefined : ""}
    aria-label="Resize inbox threads column"
    title="Drag to resize. Double-click to reset width."
    onpointerdown={beginResize}
    onpointermove={moveResize}
    onpointerup={finishResize}
    onpointercancel={finishResize}
    ondblclick={() => (listWidth = undefined)}
    onkeydown={resizeWithKeyboard}
  >
    <span aria-hidden="true"></span>
  </button>

  <AppShell.Body.Content
    label="Selected inbox thread"
    class="lc-community-inbox__thread-region"
  >
    <section class="lc-community-inbox__thread">
      <header class="lc-community-inbox__thread-header">
        <h1>{model.threadTitle}</h1>
        <div class="lc-community-inbox__thread-actions">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open thread in channel"
            title="Open thread in channel"
            onclick={onOpenChannel}
          >
            <ExternalLinkIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Thread participants"
            onclick={onViewParticipants}
          >
            <UsersIcon data-icon="inline-start" aria-hidden="true" />
            {model.participantCount ?? 0}
          </Button>
          {#if onHuddle}<Button
              variant="ghost"
              size="icon-sm"
              aria-label="Start huddle"
              title="Start huddle"
              onclick={onHuddle}
            >
              <HeadphonesIcon aria-hidden="true" />
            </Button>{/if}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Manage channel"
            title="Manage channel"
            onclick={onOpenChannelSettings}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div class="lc-community-inbox__conversation">
        <CommunityConversation
          room={model.room}
          messages={model.messages}
          members={model.members}
          composerPlacement="row"
          {onSend}
          {...onReply === undefined ? {} : { onOpenThread: onReply }}
          {...onToggleReaction === undefined
            ? {}
            : { onToggleReaction, onAddReaction: onToggleReaction }}
          {...onCopyMessageLink === undefined ? {} : { onCopyMessageLink }}
          {...onCopyMessage === undefined ? {} : { onCopyMessage }}
          {...onEditMessage === undefined ? {} : { onEditMessage }}
          {...onDeleteMessage === undefined ? {} : { onDeleteMessage }}
          {onOpenProfile}
          {...replyTarget === undefined ? {} : { replyTarget }}
          {communityEmojis}
          {...onCancelReply === undefined ? {} : { onCancelReply }}
        />
      </div>
    </section>
  </AppShell.Body.Content>
</AppShell.Body>
