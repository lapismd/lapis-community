<script lang="ts">
  import CommunityReactions from "../community-reactions/CommunityReactions.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import ClipboardCopyIcon from "@lucide/svelte/icons/clipboard-copy";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import FileJson2Icon from "@lucide/svelte/icons/file-json-2";
  import FlagIcon from "@lucide/svelte/icons/flag";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import MessageSquareReplyIcon from "@lucide/svelte/icons/message-square-reply";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import type { CommunityMessageProps } from "../community-message/props.js";
  type Actions = Pick<
    CommunityMessageProps,
    | "communityEmojis"
    | "reactionOptions"
    | "onAddReaction"
    | "onReply"
    | "onCopyLink"
    | "onCopyMessage"
    | "onCopyEvent"
    | "onEdit"
    | "onDelete"
    | "replyActionLabel"
  >;
  type Props = { [Key in keyof Actions]?: Actions[Key] | undefined } & {
    id: string;
    authorName: string;
    visible: boolean;
    disabledReason?: string | undefined;
    onReport?: ((id: string) => void) | undefined;
    viewToggleLabel?: string | undefined;
    onToggleView?: ((id: string) => void) | undefined;
  };
  let {
    id,
    authorName,
    visible,
    communityEmojis = [],
    reactionOptions,
    onAddReaction,
    onReply,
    onCopyLink,
    onCopyMessage,
    onCopyEvent,
    onEdit,
    onDelete,
    onReport,
    onToggleView,
    viewToggleLabel,
    replyActionLabel = "Reply",
    disabledReason,
  }: Props = $props();
  const reasonId = $props.id();
</script>

{#if onAddReaction || onReply || onCopyLink || onCopyMessage || onCopyEvent || onEdit || onDelete || onReport || onToggleView}
  <div
    class="community-message__actions"
    data-ui-part="message-actions"
    role="group"
    aria-label={`Actions for ${authorName}'s message`}
    data-visible={visible ? "" : undefined}
    aria-describedby={disabledReason ? reasonId : undefined}
  >
    {#if onAddReaction}
      <CommunityReactions
        mode="picker"
        disabled={!!disabledReason}
        pickerLabel="Add reaction"
        communityEmojis={reactionOptions === undefined ? communityEmojis : []}
        presets={reactionOptions ?? []}
        presetsOnly={reactionOptions !== undefined}
        onSelect={(emoji, custom) =>
          onAddReaction(
            id,
            emoji,
            custom === undefined
              ? undefined
              : { shortcode: custom.shortcode, url: custom.url },
          )}
      />
    {/if}
    {#if onReply}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={replyActionLabel}
        title={replyActionLabel}
        onclick={() => onReply(id)}
      >
        <MessageSquareReplyIcon aria-hidden="true" />
      </Button>
    {/if}
    {#if onCopyLink}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!!disabledReason}
        aria-label="Copy message link"
        title="Copy message link"
        onclick={() => onCopyLink(id)}
      >
        <CopyIcon aria-hidden="true" />
      </Button>
    {/if}
    {#if onCopyLink || onCopyMessage || onCopyEvent || onEdit || onDelete || onReport || onToggleView}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More message actions"
              title="More message actions"
            >
              <EllipsisIcon aria-hidden="true" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          class="community-message__menu-content"
          style="min-width: 13.5rem;"
          align="end"
          sideOffset={4}
        >
          {#if onEdit}
            <DropdownMenu.Group>
              <DropdownMenu.Item onSelect={() => onEdit(id)}>
                <PencilIcon data-icon="inline-start" aria-hidden="true" />
                Edit message
              </DropdownMenu.Item>
            </DropdownMenu.Group>
          {/if}
          {#if onEdit && (onToggleView || onCopyMessage || onCopyEvent || onCopyLink)}
            <DropdownMenu.Separator />
          {/if}
          {#if onToggleView || onCopyMessage || onCopyEvent || onCopyLink}
            <DropdownMenu.Group>
              {#if onToggleView && viewToggleLabel}
                <DropdownMenu.Item onSelect={() => onToggleView(id)}>
                  {#if viewToggleLabel === "Show raw output"}
                    <FileJson2Icon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                  {:else}
                    <ListTreeIcon data-icon="inline-start" aria-hidden="true" />
                  {/if}
                  {viewToggleLabel}
                </DropdownMenu.Item>
              {/if}
              {#if onCopyMessage}
                <DropdownMenu.Item onSelect={() => onCopyMessage(id)}>
                  <ClipboardCopyIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  Copy message
                </DropdownMenu.Item>
              {/if}
              {#if onCopyEvent}
                <DropdownMenu.Item
                  disabled={!!disabledReason}
                  onSelect={() => onCopyEvent?.(id)}
                >
                  <FileJson2Icon data-icon="inline-start" aria-hidden="true" />
                  Copy event
                </DropdownMenu.Item>
              {/if}
              {#if onCopyLink}
                <DropdownMenu.Item
                  disabled={!!disabledReason}
                  onSelect={() => onCopyLink(id)}
                >
                  <LinkIcon data-icon="inline-start" aria-hidden="true" />
                  Copy message link
                </DropdownMenu.Item>
              {/if}
            </DropdownMenu.Group>
          {/if}
          {#if (onEdit || onCopyMessage || onCopyEvent || onCopyLink) && (onReport || onDelete)}
            <DropdownMenu.Separator />
          {/if}
          {#if onReport || onDelete}
            <DropdownMenu.Group>
              {#if onReport}
                <DropdownMenu.Item onSelect={() => onReport?.(id)}>
                  <FlagIcon data-icon="inline-start" aria-hidden="true" />
                  Report message
                </DropdownMenu.Item>
              {/if}
              {#if onDelete}
                <DropdownMenu.Item
                  variant="destructive"
                  onSelect={() => onDelete?.(id)}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  Delete message
                </DropdownMenu.Item>
              {/if}
            </DropdownMenu.Group>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
    {#if disabledReason}<span id={reasonId} class="sr-only"
        >{disabledReason}</span
      >{/if}
  </div>
{/if}

<style>
  .community-message__actions {
    position: absolute;
    z-index: 3;
    inset-block-start: 0;
    inset-inline-end: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    opacity: 0;
    background: var(--popover, var(--background));
    box-shadow: var(--shadow-sm);
    pointer-events: none;
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    transform: translateY(calc(-100% + 0.15rem));
  }

  .community-message__actions[data-visible] {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(calc(-100% + 0.3rem));
  }

  .community-message__actions :global([data-ui-component="button"]) {
    border-radius: inherit;
  }

  .community-message__actions :global([data-ui-component="button"]:hover),
  .community-message__actions
    :global([data-ui-component="button"]:focus-visible) {
    background: var(--muted);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (hover: none) {
    .community-message__actions {
      position: relative;
      inset: auto;
      width: fit-content;
      margin-inline-start: auto;
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }
  }
</style>
