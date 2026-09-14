<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import { AppShell } from "@lapismd/design-core/shell";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import MailIcon from "@lucide/svelte/icons/mail";
  import UsersIcon from "@lucide/svelte/icons/users";

  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { memberById } from "../community-workspace/model.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import type { CommunityInboxFilter, CommunityInboxModel } from "./model.js";
  import type {
    CommunityCustomEmoji,
    CommunityMessageReport,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import "./CommunityInbox.css";

  let {
    model,
    rooms = [],
    onSelect,
    onFilterChange,
    onSend,
    onMarkAllRead,
    onOpenChannelSettings,
    onOpenChannel,
    onViewParticipants,
    onHuddle,
    onReply,
    onToggleReaction,
    onCopyMessageLink,
    onCopyMessage,
    onCopyEvent,
    onEditMessage,
    onSaveMessageEdit,
    onDeleteMessage,
    onReportMessage,
    onOpenProfile,
    onOpenRoom,
    onMessageMember,
    onViewMemberActivity,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to participate",
    currentMemberId,
    canDeleteAny = false,
    historyUpdating = false,
    loading = false,
    directHistory,
    onLoadOlderDirectMessages,
  }: {
    model: CommunityInboxModel;
    rooms?: readonly CommunityRoomModel[];
    onSelect: (itemId: string) => void;
    onFilterChange?: (
      filter: CommunityInboxFilter,
      unreadOnly: boolean,
    ) => void;
    onSend: (content: string) => void | Promise<void>;
    onMarkAllRead: () => void;
    onOpenChannelSettings: () => void;
    onOpenChannel?: () => void;
    onViewParticipants?: () => void;
    onHuddle?: () => void | Promise<void>;
    onReply?: (messageId: string) => void;
    onToggleReaction?: (
      messageId: string,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) => void | Promise<void>;
    onCopyMessageLink?: (messageId: string) => void;
    onCopyMessage?: (messageId: string) => void;
    onCopyEvent?: (messageId: string) => void;
    onEditMessage?: (messageId: string) => void | Promise<void>;
    onSaveMessageEdit?: (
      messageId: string,
      content: string,
    ) => void | Promise<void>;
    onDeleteMessage?: (messageId: string) => void | Promise<void>;
    onReportMessage?: (
      messageId: string,
      report: CommunityMessageReport,
    ) => void | Promise<void>;
    onOpenProfile?: (
      member: import("../community-workspace/model.js").CommunityMemberModel,
    ) => void | Promise<void>;
    onOpenRoom?: (roomId: string) => void;
    onMessageMember?: (
      member: import("../community-workspace/model.js").CommunityMemberModel,
    ) => void | Promise<void>;
    onViewMemberActivity?: (
      member: import("../community-workspace/model.js").CommunityMemberModel,
    ) => void | Promise<void>;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onCancelReply?: () => void;
    disabled?: boolean;
    disabledReason?: string;
    currentMemberId?: string;
    canDeleteAny?: boolean;
    historyUpdating?: boolean;
    loading?: boolean;
    directHistory?: { hasOlder: boolean; loading: boolean; error?: string };
    onLoadOlderDirectMessages?: () => Promise<void>;
  } = $props();

  const filter = $derived(model.filter ?? "All");
  const showUnreadOnly = $derived(model.unreadOnly ?? false);
  let bodyElement = $state<HTMLElement | null>(null);
  let listElement = $state<HTMLElement | null>(null);
  let listWidth = $state<number>();
  let resizePointerId = $state<number | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let visibleItems = $derived(
    model.items.filter(
      (item) =>
        (filter === "All" || item.categories?.includes(filter)) &&
        (!showUnreadOnly || item.unread),
    ),
  );
  let hasSelectedItem = $derived(
    model.activeItemId !== "" &&
      model.items.some((item) => item.id === model.activeItemId),
  );

  const emptyStateTitles = {
    All: "No activity yet",
    "Direct messages": "No direct messages found",
    Mentions: "No mentions found",
    Threads: "No threads found",
  } as const;

  const unreadEmptyStateTitles = {
    All: "No unread activity",
    "Direct messages": "No unread direct messages",
    Mentions: "No unread mentions",
    Threads: "No unread threads",
  } as const;

  function markAllRead(): void {
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
      {#if historyUpdating}
        <p class="lc-community-inbox__sync-status" role="status">
          Updating older Inbox activity…
        </p>
      {/if}
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
              <DropdownMenu.RadioGroup
                value={filter}
                onValueChange={(value) =>
                  onFilterChange?.(
                    value as CommunityInboxFilter,
                    showUnreadOnly,
                  )}
              >
                {#each ["All", "Direct messages", "Mentions", "Threads"] as option}
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
                checked={showUnreadOnly}
                onCheckedChange={(value) => onFilterChange?.(filter, value)}
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
            data-unread={item.unread ? "" : undefined}
            aria-pressed={item.id === model.activeItemId}
            data-ui-part="inbox-conversation"
            aria-label={`${item.context}: ${item.excerpt}`}
            onclick={() => onSelect(item.id)}
          >
            <CommunityMemberAvatar member={author} size="small" decorative />
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
        {#if loading && model.items.length === 0}
          <CommunitySkeleton
            layout="messages"
            count={5}
            label="Loading Inbox conversations"
          />
        {:else if visibleItems.length === 0}
          <Empty.Root class="lc-community-inbox__empty" role="status">
            <Empty.Header>
              <Empty.Title>
                {showUnreadOnly
                  ? unreadEmptyStateTitles[filter]
                  : emptyStateTitles[filter]}
              </Empty.Title>
              <Empty.Description>
                {showUnreadOnly
                  ? "Turn off Show unread only to see read activity."
                  : filter === "All"
                    ? "New activity will appear here."
                    : "Switch back to All to see other activity."}
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
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
    {#if loading && model.items.length === 0}
      <CommunitySkeleton
        layout="messages"
        count={4}
        label="Loading Inbox messages"
      />
    {:else if hasSelectedItem}
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
            draftKey={model.activeItemId}
            {...model.room.conversation?.transport === "nip17" &&
            directHistory &&
            onLoadOlderDirectMessages
              ? {
                  history: directHistory,
                  onLoadOlder: onLoadOlderDirectMessages,
                }
              : {}}
            messages={model.messages}
            members={model.members}
            {rooms}
            composerPlacement="row"
            {disabled}
            {disabledReason}
            restrictMessageManagement
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            {canDeleteAny}
            {onSend}
            {...onReply === undefined ? {} : { onReply, onOpenThread: onReply }}
            {...disabled || onToggleReaction === undefined
              ? {}
              : { onToggleReaction, onAddReaction: onToggleReaction }}
            {...onCopyMessageLink === undefined ? {} : { onCopyMessageLink }}
            {...onCopyMessage === undefined ? {} : { onCopyMessage }}
            {...onCopyEvent === undefined ? {} : { onCopyEvent }}
            {...onEditMessage === undefined ? {} : { onEditMessage }}
            {...onSaveMessageEdit === undefined ? {} : { onSaveMessageEdit }}
            {...onDeleteMessage === undefined ? {} : { onDeleteMessage }}
            {...onReportMessage === undefined ? {} : { onReportMessage }}
            {...onOpenProfile === undefined ? {} : { onOpenProfile }}
            {...onOpenRoom === undefined ? {} : { onOpenRoom }}
            {...onMessageMember === undefined ? {} : { onMessageMember }}
            {...onViewMemberActivity === undefined
              ? {}
              : { onViewMemberActivity }}
            {...replyTarget === undefined ? {} : { replyTarget }}
            {communityEmojis}
            {...onCancelReply === undefined ? {} : { onCancelReply }}
          />
        </div>
      </section>
    {:else}
      <Empty.Root class="lc-community-inbox__selection-empty" role="status">
        <Empty.Header>
          <Empty.Media variant="icon">
            <MailIcon aria-hidden="true" />
          </Empty.Media>
          <Empty.Title>Select a message</Empty.Title>
          <Empty.Description>
            Pick an inbox item to see the full message and react to it.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </AppShell.Body.Content>
</AppShell.Body>
