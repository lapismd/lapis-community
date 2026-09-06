<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import ReplyIcon from "@lucide/svelte/icons/reply";
  import XIcon from "@lucide/svelte/icons/x";
  import { tick } from "svelte";

  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type { CommunityComposerDraftStore } from "../community-chat-composer/model.js";
  import { useCommunityApplicationComposer } from "../community-application/composer-context.js";
  import {
    displayName,
    avatarHue,
    initials,
    type CommunityProfile,
    type ForumPost,
  } from "../registry-community/model.js";
  import type {
    DiscussionComposerPresentation,
    DiscussionComposerVariant,
  } from "./model.js";

  let {
    element = $bindable(),
    name,
    replyingTo,
    profiles,
    postNumber,
    signedInPubkey,
    publishing = false,
    variant = "inline",
    presentation = $bindable("closed"),
    height = $bindable(320),
    draftKey,
    draftStore,
    composerStatus,
    onDismissComposerStatus,
    comment = $bindable(""),
    onCancel,
    onHeightCommit,
    onSubmit,
  }: {
    element?: HTMLDivElement | undefined;
    name: string;
    replyingTo?: ForumPost | undefined;
    profiles: ReadonlyMap<string, CommunityProfile>;
    postNumber: (eventId: string) => number;
    signedInPubkey: string;
    publishing?: boolean;
    variant?: DiscussionComposerVariant;
    presentation?: DiscussionComposerPresentation;
    height?: number;
    draftKey?: string;
    draftStore?: CommunityComposerDraftStore;
    composerStatus?: ComposerStatus;
    onDismissComposerStatus?: () => void;
    comment?: string;
    onCancel: () => void;
    onHeightCommit?: (height: number) => void;
    onSubmit: (content: string) => boolean | void | Promise<boolean | void>;
  } = $props();

  const applicationComposer = useCommunityApplicationComposer();
  const profileMembers = $derived(
    [...profiles.values()].map((profile) => ({
      id: profile.pubkey,
      name: profile.name,
      handle: shortKey(profile.pubkey),
      initials: initials(profile.name),
      ...(profile.picture === undefined ? {} : { avatarUrl: profile.picture }),
    })),
  );
  const members = $derived.by(() => {
    const applicationMembers = applicationComposer?.members() ?? [];
    const applicationMemberIds = new Set(
      applicationMembers.map((member) => member.id),
    );
    return [
      ...applicationMembers,
      ...profileMembers.filter(
        (member) => !applicationMemberIds.has(member.id),
      ),
    ];
  });
  const rooms = $derived(applicationComposer?.rooms() ?? []);
  const communityEmojis = $derived(applicationComposer?.emojis() ?? []);
  const signedInMember = $derived(
    members.find((member) => member.id === signedInPubkey),
  );
  const signedInProfile = $derived(profiles.get(signedInPubkey));
  const signedInName = $derived(
    signedInPubkey === ""
      ? ""
      : (signedInMember?.name ?? displayName(signedInPubkey, profiles)),
  );
  const replyContext = $derived(
    replyingTo === undefined
      ? undefined
      : {
          kind: "reply" as const,
          target: {
            eventId: replyingTo.event.id,
            roomId: name,
            authorId: replyingTo.event.pubkey,
            authorName: displayName(replyingTo.event.pubkey, profiles),
            content: replyingTo.content,
            kind: "forum" as const,
          },
        },
  );
  let composer = $state<HTMLDivElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);
  let dockBounds = $state("");
  let initialized = false;
  let previousReplyId = "";
  const open = $derived(
    presentation === "open" || presentation === "fullscreen",
  );
  const dockTitle = $derived(
    replyingTo
      ? `Replying to ${displayName(replyingTo.event.pubkey, profiles)}`
      : `Discussion about ${name}`,
  );
  const minimumHeight = 220;
  let maximumHeight = $state(720);

  $effect(() => {
    const replyId = replyingTo?.event.id ?? "";
    if (!initialized) {
      initialized = true;
      previousReplyId = replyId;
      if (
        presentation === "closed" &&
        (replyId !== "" || comment.trim() !== "")
      ) {
        presentation = "open";
        void focusComposer();
      }
      return;
    }
    if (replyId !== "" && replyId !== previousReplyId) {
      presentation = "open";
      void focusComposer();
    }
    previousReplyId = replyId;
  });

  $effect(() => {
    if (variant !== "docked" || presentation === "closed") return;
    const update = () => updateDockBounds();
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const viewport = discussionViewport();
    const observer = viewport ? new ResizeObserver(update) : undefined;
    if (viewport) observer?.observe(viewport);
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && presentation === "fullscreen") {
        presentation = "open";
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", handleKeydown);
      observer?.disconnect();
    };
  });

  function shortKey(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-8)}`
      : value;
  }

  async function focusComposer(): Promise<void> {
    await tick();
    composer
      ?.querySelector<HTMLElement>(
        '[data-ui-part="editable"], .cm-content[contenteditable="true"]',
      )
      ?.focus();
  }

  async function expand(): Promise<void> {
    presentation = "open";
    await focusComposer();
  }

  function cancelReply(): void {
    onCancel();
  }

  async function cancelComposer(): Promise<void> {
    if (variant === "docked") {
      presentation = "closed";
      await tick();
      trigger?.focus();
      return;
    }
    onCancel();
    comment = "";
    presentation = "closed";
  }

  async function publish(value: string): Promise<void> {
    comment = value;
    try {
      const published = await onSubmit(value);
      if (published === false) {
        comment = value;
        throw new Error(
          composerStatus?.message ?? "Comment could not be published",
        );
      }
      comment = "";
      presentation = "closed";
    } catch (cause) {
      comment = value;
      throw cause;
    }
  }

  function discussionViewport(): HTMLElement | null {
    const contextualViewport =
      element?.closest<HTMLElement>('[data-ui-part="body-content"]') ??
      element?.closest<HTMLElement>('[data-ui-part="scroll-area-viewport"]');
    if (contextualViewport) return contextualViewport;
    const parent = element?.parentElement;
    if (
      parent !== undefined &&
      parent !== null &&
      parent.getBoundingClientRect().height >= minimumHeight * 2
    ) {
      return parent;
    }
    return typeof document === "undefined" ? null : document.documentElement;
  }

  function updateDockBounds(): void {
    const viewportBounds = discussionViewport()?.getBoundingClientRect();
    if (!viewportBounds) return;
    const anchorBounds = element?.getBoundingClientRect() ?? viewportBounds;
    const inlinePadding = anchorBounds.width < 480 ? 8 : 16;
    const blockPadding = viewportBounds.height < 520 ? 8 : 12;
    maximumHeight = Math.max(
      minimumHeight,
      Math.floor(viewportBounds.height * 0.7 - blockPadding * 2),
    );
    height = clampHeight(height);
    dockBounds = [
      `--discussion-dock-center-x:${Math.round(anchorBounds.left + anchorBounds.width / 2)}px`,
      `--discussion-dock-available-width:${Math.round(anchorBounds.width)}px`,
      `--discussion-dock-inline-padding:${inlinePadding}px`,
      `--discussion-dock-left:${Math.round(viewportBounds.left)}px`,
      `--discussion-dock-right:${Math.max(0, Math.round(window.innerWidth - viewportBounds.right))}px`,
      `--discussion-dock-top:${Math.round(viewportBounds.top)}px`,
      `--discussion-dock-bottom:${Math.max(0, Math.round(window.innerHeight - viewportBounds.bottom) + blockPadding)}px`,
      `--discussion-dock-height:${height}px`,
    ].join(";");
  }

  function clampHeight(value: number): number {
    return Math.max(minimumHeight, Math.min(maximumHeight, Math.round(value)));
  }

  function commitHeight(value: number): void {
    height = clampHeight(value);
    updateDockBounds();
    onHeightCommit?.(height);
  }

  function beginResize(event: PointerEvent): void {
    if (presentation === "fullscreen") return;
    const separator = event.currentTarget as HTMLElement;
    const startY = event.clientY;
    const startHeight = height;
    separator.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      height = clampHeight(startHeight + startY - moveEvent.clientY);
      updateDockBounds();
    };
    const finish = () => {
      separator.removeEventListener("pointermove", move);
      separator.removeEventListener("pointerup", finish);
      separator.removeEventListener("pointercancel", finish);
      commitHeight(height);
    };
    separator.addEventListener("pointermove", move);
    separator.addEventListener("pointerup", finish);
    separator.addEventListener("pointercancel", finish);
  }

  async function closeDock(): Promise<void> {
    presentation = "closed";
    await tick();
    trigger?.focus();
  }
</script>

{#snippet dockControl(
  label: string,
  onclick: () => void | Promise<void>,
  icon: typeof XIcon,
)}
  {@const Icon = icon}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="ghost"
          size="icon-sm"
          class="discussion-composer__dock-control"
          aria-label={label}
          {onclick}
        >
          <Icon aria-hidden="true" />
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top">{label}</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

{#snippet identityAction()}
  {#if signedInPubkey !== ""}
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="sm"
            class="discussion-composer__identity"
            aria-label={`Open profile for ${signedInName}`}
          >
            <span
              class="discussion-composer__avatar"
              style={`--avatar-hue: ${avatarHue(signedInPubkey)}`}
              aria-hidden="true"
            >
              {#if signedInProfile?.picture}
                <img src={signedInProfile.picture} alt="" />
              {:else}
                {initials(signedInName)}
              {/if}
            </span>
            <span>{signedInName}</span>
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content align="start" class="discussion-composer__profile">
        <div class="discussion-composer__profile-heading">
          <span
            class="discussion-composer__avatar discussion-composer__avatar--large"
            style={`--avatar-hue: ${avatarHue(signedInPubkey)}`}
            aria-hidden="true"
          >
            {#if signedInProfile?.picture}
              <img src={signedInProfile.picture} alt="" />
            {:else}
              {initials(signedInName)}
            {/if}
          </span>
          <div>
            <Popover.Title><h3>{signedInName}</h3></Popover.Title>
            <p>{shortKey(signedInPubkey)}</p>
          </div>
        </div>
        <Popover.Description>
          {signedInProfile?.about ?? "Nostr community profile"}
        </Popover.Description>
      </Popover.Content>
    </Popover.Root>
  {/if}
{/snippet}

<div
  class="discussion-composer"
  data-expanded={open ? "" : undefined}
  data-variant={variant}
  data-presentation={presentation}
  data-reply-post={replyingTo ? postNumber(replyingTo.event.id) : undefined}
  data-ui-component="discussion-composer"
  bind:this={element}
>
  {#if presentation !== "closed"}
    <div
      class="discussion-composer__panel"
      data-ui-part={variant === "docked" ? "docked-panel" : undefined}
      style={variant === "docked" ? dockBounds : undefined}
    >
      {#if variant === "docked"}
        {#if presentation !== "minimized" && presentation !== "fullscreen"}
          <!-- An ARIA separator becomes an interactive splitter when focusable. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="discussion-composer__resize"
            role="separator"
            tabindex="0"
            aria-orientation="horizontal"
            aria-valuemin={minimumHeight}
            aria-valuemax={maximumHeight}
            aria-valuenow={height}
            aria-label={`Resize discussion composer, ${height} pixels high`}
            onpointerdown={beginResize}
            onkeydown={(event) => {
              if (event.key === "ArrowUp") commitHeight(height + 16);
              if (event.key === "ArrowDown") commitHeight(height - 16);
              if (event.key === "Home") commitHeight(minimumHeight);
              if (event.key === "End") commitHeight(maximumHeight);
            }}
          ></div>
        {/if}
        <header class="discussion-composer__dock-header">
          {#if presentation === "minimized"}
            <button
              type="button"
              class="discussion-composer__dock-title"
              aria-label={`Restore composer. ${dockTitle}`}
              onclick={expand}
            >
              <ReplyIcon aria-hidden="true" />
              <span>{dockTitle}</span>
            </button>
          {:else}
            <div class="discussion-composer__dock-title">
              <ReplyIcon aria-hidden="true" />
              <span>{dockTitle}</span>
            </div>
          {/if}
          <Tooltip.Provider>
            {#if presentation !== "minimized"}
              {@render dockControl(
                "Minimize composer",
                () => {
                  presentation = "minimized";
                },
                MinusIcon,
              )}
              {@render dockControl(
                presentation === "fullscreen"
                  ? "Exit fullscreen composer"
                  : "Fullscreen composer",
                () => {
                  presentation =
                    presentation === "fullscreen" ? "open" : "fullscreen";
                },
                Maximize2Icon,
              )}
            {/if}
            {@render dockControl("Close composer", closeDock, XIcon)}
          </Tooltip.Provider>
        </header>
      {/if}
      {#if open}
        <CommunityChatComposer
          bind:ref={composer}
          bind:value={comment}
          {members}
          {rooms}
          {communityEmojis}
          {...signedInPubkey === "" ? {} : { currentMemberId: signedInPubkey }}
          {...replyContext === undefined ? {} : { context: replyContext }}
          {...draftKey === undefined ? {} : { draftKey }}
          {...draftStore === undefined ? {} : { draftStore }}
          busy={publishing}
          {...composerStatus === undefined ? {} : { composerStatus }}
          {...onDismissComposerStatus === undefined
            ? {}
            : { onDismissComposerStatus }}
          ariaLabel={replyingTo
            ? "Reply to discussion"
            : `Discussion about ${name}`}
          submitLabel="Publish comment"
          placeholder={replyingTo ? "Write your reply…" : "Write your post…"}
          additionalActions={identityAction}
          onCancel={cancelComposer}
          {...replyingTo === undefined ? {} : { onCancelContext: cancelReply }}
          onSubmit={(submission) => publish(submission.content)}
        />
      {/if}
    </div>
  {:else}
    <Button
      bind:ref={trigger}
      type="button"
      variant="outline"
      class="discussion-composer__trigger"
      aria-label={`Start a discussion about ${name}`}
      disabled={publishing}
      onclick={expand}
    >
      Start a discussion…
    </Button>
  {/if}
</div>

<style>
  .discussion-composer {
    --ui-ai-chat-composer-radius: 0.85rem;

    width: 100%;
    scroll-margin-top: 6rem;
  }

  .discussion-composer__panel {
    width: 100%;
  }

  .discussion-composer[data-variant="docked"] .discussion-composer__panel {
    position: fixed;
    z-index: 45;
    bottom: var(--discussion-dock-bottom, 0.75rem);
    left: var(--discussion-dock-center-x, 50%);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(
      48rem,
      calc(
        var(--discussion-dock-available-width, 100vw) -
          (var(--discussion-dock-inline-padding, 1rem) * 2)
      )
    );
    max-width: calc(100vw - 1rem);
    height: var(--discussion-dock-height, 20rem);
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--background);
    box-shadow:
      0 1.25rem 3.5rem rgb(0 0 0 / 22%),
      0 0 0 1px color-mix(in srgb, var(--foreground) 4%, transparent);
    transform: translateX(-50%);
  }

  .discussion-composer[data-presentation="minimized"]
    .discussion-composer__panel {
    width: min(
      26rem,
      calc(
        var(--discussion-dock-available-width, 100vw) -
          (var(--discussion-dock-inline-padding, 1rem) * 2)
      )
    );
    height: auto;
  }

  .discussion-composer[data-presentation="fullscreen"]
    .discussion-composer__panel {
    top: var(--discussion-dock-top, 0);
    right: var(--discussion-dock-right, 0);
    bottom: max(0px, calc(var(--discussion-dock-bottom, 0px) - 0.75rem));
    left: var(--discussion-dock-left, 0);
    width: auto;
    max-width: none;
    height: auto;
    border-radius: 0;
    transform: none;
  }

  .discussion-composer__dock-header {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    min-height: 2.5rem;
    border-bottom: 1px solid var(--border);
    padding: 0.25rem 0.4rem 0.25rem 0.75rem;
    background: var(--muted);
  }

  .discussion-composer[data-presentation="minimized"]
    .discussion-composer__dock-header {
    border-bottom: 0;
  }

  .discussion-composer__dock-title {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 0.4rem;
    overflow: hidden;
    border: 0;
    padding: 0;
    color: var(--foreground);
    background: transparent;
    font: inherit;
    font-weight: 650;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .discussion-composer__dock-title > :global(svg) {
    width: 0.95rem;
    height: 0.95rem;
    flex: 0 0 auto;
  }

  .discussion-composer__dock-title > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .discussion-composer[data-presentation="minimized"]
    .discussion-composer__dock-title {
    cursor: pointer;
  }

  .discussion-composer[data-presentation="minimized"]
    .discussion-composer__dock-title:hover,
  .discussion-composer[data-presentation="minimized"]
    .discussion-composer__dock-title:focus-visible {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  :global(.discussion-composer__dock-control[data-ui-component="button"]) {
    color: var(--muted-foreground);
  }

  :global(.discussion-composer__dock-control[data-ui-component="button"]:hover),
  :global(
      .discussion-composer__dock-control[data-ui-component="button"]:focus-visible
    ) {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }

  .discussion-composer__resize {
    position: absolute;
    z-index: 2;
    top: -0.25rem;
    right: 0;
    left: 0;
    height: 0.5rem;
    cursor: ns-resize;
    touch-action: none;
    background: transparent;
  }

  .discussion-composer__resize::before {
    position: absolute;
    top: 0.22rem;
    left: 50%;
    width: 3rem;
    height: 0.22rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--muted-foreground) 58%, transparent);
    content: "";
    transform: translateX(-50%);
    transition:
      width 120ms ease,
      background-color 120ms ease;
  }

  .discussion-composer__resize:hover::before,
  .discussion-composer__resize:focus-visible::before {
    width: 3.5rem;
    background: var(--muted-foreground);
  }

  .discussion-composer__resize:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }

  .discussion-composer[data-variant="docked"]
    :global([data-ui-component="community-chat-composer"]) {
    --community-chat-composer-editor-max-height-override: max(
      7rem,
      calc(var(--discussion-dock-height, 20rem) - 10rem)
    );

    box-sizing: border-box;
    min-height: 0;
    height: 100%;
    padding: 0.75rem;
    border: 0;
    border-radius: 0;
  }

  .discussion-composer[data-variant="docked"]
    :global([data-ui-component="ai-chat-composer"]) {
    min-height: 0;
    height: 100%;
  }

  .discussion-composer[data-variant="docked"]
    :global([data-ui-component="ai-chat-composer"] > [data-ui-part="body"]) {
    min-height: 0;
    flex: 1;
  }

  .discussion-composer[data-variant="docked"]
    :global([data-ui-component="ai-chat-composer"] [data-ui-part="input-area"]),
  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__editor-wrap),
  .discussion-composer[data-variant="docked"]
    :global(
      .community-chat-composer__editor-scroll-area[data-ui-component="scroll-area"]
    ),
  .discussion-composer[data-variant="docked"]
    :global(
      .community-chat-composer__editor-scroll-area
        > [data-ui-part="scroll-area-viewport"]
    ) {
    display: flex;
    min-height: 0;
    flex: 1;
    height: 100%;
    max-height: none;
  }

  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira.mira),
  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira .mira__body),
  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira .mira__pane),
  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira .mira__editor-scroll),
  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira .mira-code-editor),
  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira .cm-editor) {
    min-height: 0;
    height: 100%;
  }

  .discussion-composer[data-variant="docked"]
    :global(.community-chat-composer__mira .cm-editor > .cm-scroller) {
    overflow-y: auto;
  }

  .discussion-composer[data-presentation="fullscreen"]
    :global([data-ui-component="community-chat-composer"]) {
    --community-chat-composer-editor-max-height-override: calc(
      100dvh - var(--discussion-dock-top, 0px) -
        var(--discussion-dock-bottom, 0px) - 10rem
    );
  }

  :global(.discussion-composer__trigger[data-ui-component="button"]) {
    width: 100%;
    height: 3.25rem;
    justify-content: flex-start;
    border-style: dashed;
    border-color: color-mix(in srgb, var(--border) 72%, transparent);
    border-radius: 0.75rem;
    padding-inline: 1rem;
    color: var(--muted-foreground);
    background: transparent;
    font-size: 0.95rem;
    font-weight: 400;
  }

  :global(.discussion-composer__trigger[data-ui-component="button"]:hover),
  :global(
      .discussion-composer__trigger[data-ui-component="button"]:focus-visible
    ) {
    border-color: var(--border);
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
  }

  :global(.discussion-composer__identity) {
    max-width: min(100%, 20rem);
    justify-content: flex-start;
    padding-inline-start: 0.3rem;
    color: var(--foreground);
  }

  .discussion-composer__avatar {
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    flex: 0 0 auto;
    place-items: center;
    overflow: hidden;
    border: 1px solid hsl(var(--avatar-hue) 55% 55% / 0.48);
    border-radius: 50%;
    background: hsl(var(--avatar-hue) 42% 28%);
    color: hsl(var(--avatar-hue) 70% 90%);
    font-size: 0.62rem;
    font-weight: 700;
  }

  .discussion-composer__avatar--large {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 0.85rem;
  }

  .discussion-composer__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :global(.discussion-composer__profile) {
    display: grid;
    gap: 0.75rem;
    width: min(20rem, calc(100vw - 1rem));
  }

  .discussion-composer__profile-heading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .discussion-composer__profile-heading h3 {
    margin: 0;
    font-size: 0.95rem;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }
</style>
