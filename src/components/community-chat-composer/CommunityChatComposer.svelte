<script lang="ts">
  import "@lapismd/mira/styles.css";

  import Mira, {
    type MiraHandle,
    type MiraMarkdownActionId,
  } from "@lapismd/mira";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Progress } from "@lapismd/design-core/shadcn/progress";
  import AtSignIcon from "@lucide/svelte/icons/at-sign";
  import BoldIcon from "@lucide/svelte/icons/bold";
  import CodeIcon from "@lucide/svelte/icons/code";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import ItalicIcon from "@lucide/svelte/icons/italic";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ListIcon from "@lucide/svelte/icons/list";
  import ListOrderedIcon from "@lucide/svelte/icons/list-ordered";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import MessageSquareReplyIcon from "@lucide/svelte/icons/message-square-reply";
  import PaperclipIcon from "@lucide/svelte/icons/paperclip";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import QuoteIcon from "@lucide/svelte/icons/quote";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SendIcon from "@lucide/svelte/icons/send";
  import SquareCodeIcon from "@lucide/svelte/icons/square-code";
  import StrikethroughIcon from "@lucide/svelte/icons/strikethrough";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import TypeIcon from "@lucide/svelte/icons/type";
  import XIcon from "@lucide/svelte/icons/x";
  import type { EditorView } from "@codemirror/view";
  import { onMount, tick, untrack } from "svelte";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import {
    createCommunityComposerExtension,
    openCommunityComposerAutocomplete,
    refreshCommunityComposerTokenDecorations,
  } from "./composer-extension.js";
  import {
    communityEmojiToken,
    formatCommunityAttachmentSize,
    isSafeCommunityLink,
    resolveCommunityComposerReferences,
    type CommunityComposerAttachment,
    type CommunityComposerContext,
    type CommunityComposerDraftStore,
    type CommunityComposerSubmission,
    type CommunityMessageMediaAdapter,
  } from "./model.js";

  let {
    value = $bindable(""),
    formattingOpen = $bindable(false),
    placeholder = "Message the community",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    context,
    initialAttachments = [],
    maxAttachments = 8,
    draftKey,
    draftStore,
    mediaAdapter,
    disabled = false,
    disabledReason = "Messaging is unavailable",
    busy = false,
    onSubmit,
    onCancelContext,
    onEditLastMessage,
    class: className = "",
  }: {
    value?: string;
    formattingOpen?: boolean;
    placeholder?: string;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    currentMemberId?: string;
    context?: CommunityComposerContext;
    initialAttachments?: readonly CommunityComposerAttachment[];
    maxAttachments?: number;
    draftKey?: string;
    draftStore?: CommunityComposerDraftStore;
    mediaAdapter?: CommunityMessageMediaAdapter;
    disabled?: boolean;
    disabledReason?: string;
    busy?: boolean;
    onSubmit?: (
      submission: CommunityComposerSubmission,
    ) => void | Promise<void>;
    onCancelContext?: () => void;
    onEditLastMessage?: () => void;
    class?: string;
  } = $props();

  let mira = $state<MiraHandle>();
  let editorView = $state<EditorView>();
  let fileInput = $state<HTMLInputElement>();
  let selectionFrom = $state(0);
  let selectionTo = $state(0);
  let selectedMentionPubkeys = $state<string[]>([]);
  let selectedChannelIds = $state<string[]>([]);
  let attachments = $state<CommunityComposerAttachment[]>(
    untrack(() => [...initialAttachments]),
  );
  let linkOpen = $state(false);
  let linkLabel = $state("");
  let linkUrl = $state("");
  let linkError = $state("");
  let linkSelection = $state({ from: 0, to: 0 });
  let submitError = $state("");
  let draftReady = $state(
    untrack(() => draftStore === undefined || draftKey === undefined),
  );
  let activeActions = $state<ReadonlySet<MiraMarkdownActionId>>(new Set());
  const attachmentFiles = new Map<string, File>();
  const attachmentControllers = new Map<string, AbortController>();

  const hasSelection = $derived(selectionTo > selectionFrom);
  const tokenModelSignature = $derived(
    [
      ...members.map((member) => `member:${member.id}:${member.name}`),
      ...rooms.map(
        (room) =>
          `room:${room.id}:${room.name}:${room.kind}:${room.archived === true}`,
      ),
      ...communityEmojis.map(
        (emoji) => `emoji:${emoji.shortcode}:${emoji.url}`,
      ),
    ].join("\u0000"),
  );
  const hasPendingAttachments = $derived(
    attachments.some((attachment) =>
      ["queued", "uploading", "failed"].includes(attachment.status),
    ),
  );
  const canSubmit = $derived(
    !disabled &&
      !busy &&
      !hasPendingAttachments &&
      (value.trim() !== "" || attachments.some((item) => item.uploaded)),
  );

  const composerExtension = createCommunityComposerExtension({
    members: () => members,
    rooms: () => rooms,
    emojis: () => communityEmojis,
    disabled: () => disabled || busy || !onSubmit,
    editing: () => context?.kind === "edit",
    onView(view) {
      editorView = view;
    },
    onSelection(state) {
      editorView = state.view;
      selectionFrom = state.selectionFrom;
      selectionTo = state.selectionTo;
      updateActiveActions(state.view);
    },
    onMention(member) {
      selectedMentionPubkeys = addUnique(selectedMentionPubkeys, member.id);
    },
    onChannel(room) {
      selectedChannelIds = addUnique(selectedChannelIds, room.id);
    },
    onSubmit() {
      void submit();
    },
    onEditLast() {
      if (!onEditLastMessage) return false;
      onEditLastMessage();
      return true;
    },
    onCancelEdit() {
      onCancelContext?.();
    },
  });

  onMount(() => {
    let cancelled = false;
    if (draftStore && draftKey) {
      void draftStore
        .load(draftKey)
        .then((draft) => {
          if (cancelled || !draft) return;
          value = draft.value;
          selectedMentionPubkeys = [...draft.mentionPubkeys];
          selectedChannelIds = [...draft.channelIds];
          attachments = draft.attachments.map((attachment) => ({
            ...attachment,
          }));
        })
        .catch(() => {
          // A draft failure must never block composing.
        })
        .finally(() => {
          if (!cancelled) draftReady = true;
        });
    }
    return () => {
      cancelled = true;
      for (const controller of attachmentControllers.values()) {
        controller.abort();
      }
      for (const attachment of attachments) revokePreview(attachment);
    };
  });

  $effect(() => {
    tokenModelSignature;
    const view = editorView;
    if (view) refreshCommunityComposerTokenDecorations(view);
  });

  $effect(() => {
    if (!draftReady || !draftStore || !draftKey) return;
    const draftValue = value;
    const draftMentions = [...selectedMentionPubkeys];
    const draftChannels = [...selectedChannelIds];
    const draftAttachments = attachments.map((attachment) => {
      const { previewUrl: _previewUrl, ...persisted } = attachment;
      return {
        ...persisted,
        ...(attachment.uploaded?.url
          ? { previewUrl: attachment.uploaded.url }
          : {}),
      };
    });
    const timeout = window.setTimeout(() => {
      if (
        draftValue.trim() === "" &&
        draftAttachments.length === 0 &&
        context === undefined
      ) {
        void draftStore.remove(draftKey).catch(() => {});
        return;
      }
      void draftStore
        .save(draftKey, {
          value: draftValue,
          mentionPubkeys: draftMentions,
          channelIds: draftChannels,
          attachments: draftAttachments,
          updatedAt: Date.now(),
        })
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(timeout);
  });

  function addUnique(values: string[], valueToAdd: string): string[] {
    return values.includes(valueToAdd) ? values : [...values, valueToAdd];
  }

  function updateActiveActions(view: EditorView): void {
    const inlineActions: MiraMarkdownActionId[] = [
      "bold",
      "italic",
      "strikethrough",
      "inlineCode",
      "link",
    ];
    activeActions = new Set(
      inlineActions.filter((action) => isSelectionFormatted(view, action)),
    );
  }

  function isSelectionFormatted(
    view: EditorView,
    action: MiraMarkdownActionId,
  ): boolean {
    const selection = view.state.selection.main;
    if (selection.empty) return false;
    const selected = view.state.sliceDoc(selection.from, selection.to);
    const delimiters =
      action === "bold"
        ? [
            ["**", "**"],
            ["__", "__"],
          ]
        : action === "italic"
          ? [
              ["*", "*"],
              ["_", "_"],
            ]
          : action === "strikethrough"
            ? [["~~", "~~"]]
            : action === "inlineCode"
              ? [["`", "`"]]
              : [];
    if (action === "link") {
      const before = view.state.sliceDoc(
        Math.max(0, selection.from - 1),
        selection.from,
      );
      const after = view.state.sliceDoc(
        selection.to,
        Math.min(view.state.doc.length, selection.to + 2),
      );
      return before === "[" && after === "](";
    }
    return delimiters.some(([open, close]) => {
      if (!open || !close) return false;
      if (selected.startsWith(open) && selected.endsWith(close)) return true;
      return (
        view.state.sliceDoc(
          Math.max(0, selection.from - open.length),
          selection.from,
        ) === open &&
        view.state.sliceDoc(
          selection.to,
          Math.min(view.state.doc.length, selection.to + close.length),
        ) === close
      );
    });
  }

  async function insertReferencePrefix(): Promise<void> {
    mira?.insertMarkdown("@");
    await tick();
    if (editorView) openCommunityComposerAutocomplete(editorView);
  }

  function insertEmoji(emoji: string, custom?: CommunityCustomEmoji): void {
    mira?.insertMarkdown(communityEmojiToken(emoji, custom));
  }

  function applyAction(action: MiraMarkdownActionId): void {
    mira?.applyMarkdownAction(action);
    if (editorView) updateActiveActions(editorView);
  }

  function wrapSelection(
    prefix: string,
    suffix: string,
    placeholder: string,
  ): void {
    const view = editorView;
    if (!view) return;
    const selection = view.state.selection.main;
    const selected = view.state.sliceDoc(selection.from, selection.to);
    const inner = selected || placeholder;
    const insert = `${prefix}${inner}${suffix}`;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: {
        anchor: selection.from + prefix.length,
        head: selection.from + prefix.length + inner.length,
      },
    });
    view.focus();
  }

  function insertCodeBlock(): void {
    wrapSelection("```\n", "\n```", "code");
  }

  function openLinkEditor(): void {
    const view = editorView;
    if (!view) return;
    const selection = view.state.selection.main;
    linkSelection = { from: selection.from, to: selection.to };
    linkLabel = view.state.sliceDoc(selection.from, selection.to);
    linkUrl = "https://";
    linkError = "";
    linkOpen = true;
  }

  function saveLink(): void {
    const view = editorView;
    const label = linkLabel.trim();
    const url = linkUrl.trim();
    if (!view || label === "" || !isSafeCommunityLink(url)) {
      linkError =
        "Add link text and a safe web, email, Nostr, or relative URL.";
      return;
    }
    const insert = `[${label}](${url})`;
    view.dispatch({
      changes: { ...linkSelection, insert },
      selection: { anchor: linkSelection.from + insert.length },
    });
    linkOpen = false;
    view.focus();
  }

  function chooseFiles(): void {
    fileInput?.click();
  }

  function handleFileInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    void addFiles(input.files ? [...input.files] : []);
    input.value = "";
  }

  function handleDragOver(event: DragEvent): void {
    if (!mediaAdapter || disabled || busy) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent): void {
    if (!mediaAdapter || disabled || busy) return;
    event.preventDefault();
    void addFiles(
      event.dataTransfer?.files ? [...event.dataTransfer.files] : [],
    );
  }

  async function addFiles(files: readonly File[]): Promise<void> {
    if (!mediaAdapter || disabled || busy) return;
    const available = Math.max(0, maxAttachments - attachments.length);
    for (const file of files.slice(0, available)) {
      const id =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${file.name}`;
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      const attachment: CommunityComposerAttachment = {
        id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        status: "queued",
        progress: 0,
        ...(previewUrl === undefined ? {} : { previewUrl }),
      };
      attachmentFiles.set(id, file);
      attachments = [...attachments, attachment];
      void uploadAttachment(id);
    }
  }

  async function uploadAttachment(id: string): Promise<void> {
    const adapter = mediaAdapter;
    const file = attachmentFiles.get(id);
    const attachment = attachments.find((item) => item.id === id);
    if (!adapter || !file || !attachment) return;
    const controller = new AbortController();
    attachmentControllers.set(id, controller);
    attachment.status = "uploading";
    attachment.progress = 0;
    delete attachment.error;
    try {
      const uploaded = await adapter.upload(file, {
        signal: controller.signal,
        onProgress(progress) {
          attachment.progress = Math.min(100, Math.max(0, progress));
        },
      });
      attachment.uploaded = uploaded;
      attachment.status = "uploaded";
      attachment.progress = 100;
    } catch (cause) {
      if (controller.signal.aborted) return;
      attachment.status = "failed";
      attachment.error =
        cause instanceof Error
          ? cause.message
          : "Upload could not be completed";
    } finally {
      attachmentControllers.delete(id);
    }
  }

  function retryAttachment(id: string): void {
    void uploadAttachment(id);
  }

  function removeAttachment(id: string): void {
    const attachment = attachments.find((item) => item.id === id);
    if (!attachment) return;
    attachmentControllers.get(id)?.abort();
    attachmentControllers.delete(id);
    attachmentFiles.delete(id);
    revokePreview(attachment);
    if (attachment.uploaded && mediaAdapter?.remove) {
      void mediaAdapter.remove(attachment.uploaded);
    }
    attachments = attachments.filter((item) => item.id !== id);
  }

  function revokePreview(attachment: CommunityComposerAttachment): void {
    if (attachment.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }

  async function submit(): Promise<void> {
    if (!canSubmit || !onSubmit) return;
    submitError = "";
    const references = resolveCommunityComposerReferences(
      value,
      members,
      rooms,
      selectedMentionPubkeys,
      selectedChannelIds,
      currentMemberId,
    );
    try {
      await onSubmit({
        content: value.trim(),
        mentionPubkeys: references.mentionPubkeys,
        channelIds: references.channelIds,
        attachments: attachments.flatMap((attachment) =>
          attachment.uploaded ? [attachment.uploaded] : [],
        ),
        ...(context === undefined ? {} : { context }),
      });
      for (const attachment of attachments) revokePreview(attachment);
      value = "";
      attachments = [];
      attachmentFiles.clear();
      attachmentControllers.clear();
      selectedMentionPubkeys = [];
      selectedChannelIds = [];
      if (draftStore && draftKey) await draftStore.remove(draftKey);
    } catch (cause) {
      submitError =
        cause instanceof Error ? cause.message : "Message could not be sent";
    }
  }
</script>

<div
  class={`community-chat-composer ${className}`.trim()}
  data-ui-component="community-chat-composer"
  data-disabled={disabled ? "" : undefined}
  data-formatting-open={formattingOpen ? "" : undefined}
  role="group"
  aria-label="Message composer"
  ondragover={handleDragOver}
  ondrop={handleDrop}
>
  {#if context}
    <div
      class="community-chat-composer__context"
      data-ui-part="composer-context"
    >
      <span class="community-chat-composer__context-icon">
        {#if context.kind === "reply"}
          <MessageSquareReplyIcon aria-hidden="true" />
        {:else}
          <PencilLineIcon aria-hidden="true" />
        {/if}
      </span>
      <span class="community-chat-composer__context-copy">
        <strong
          >{context.kind === "reply"
            ? `Replying to ${context.label}`
            : "Editing message"}</strong
        >
        {#if context.kind === "reply" && context.excerpt}
          <span>{context.excerpt}</span>
        {/if}
      </span>
      {#if onCancelContext}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={context.kind === "reply" ? "Cancel reply" : "Cancel edit"}
          onclick={onCancelContext}
        >
          <XIcon aria-hidden="true" />
        </Button>
      {/if}
    </div>
  {/if}

  {#if attachments.length}
    <div
      class="community-chat-composer__attachments"
      data-ui-part="composer-attachments"
      aria-label="Message attachments"
    >
      {#each attachments as attachment (attachment.id)}
        <article
          class="community-chat-composer__attachment"
          data-status={attachment.status}
        >
          {#if attachment.previewUrl && attachment.mimeType.startsWith("image/")}
            <img src={attachment.previewUrl} alt="" />
          {:else}
            <span class="community-chat-composer__file-icon">
              <FileTextIcon aria-hidden="true" />
            </span>
          {/if}
          <div class="community-chat-composer__attachment-copy">
            <strong>{attachment.name}</strong>
            <span>
              {#if attachment.status === "uploading"}
                Uploading {Math.round(attachment.progress ?? 0)}%
              {:else if attachment.status === "failed"}
                {attachment.error ?? "Upload failed"}
              {:else if attachment.status === "uploaded"}
                Ready · {formatCommunityAttachmentSize(attachment.size)}
              {:else}
                Waiting · {formatCommunityAttachmentSize(attachment.size)}
              {/if}
            </span>
            {#if attachment.status === "uploading"}
              <Progress
                value={attachment.progress ?? 0}
                aria-label={`Uploading ${attachment.name}`}
              />
            {/if}
          </div>
          <div class="community-chat-composer__attachment-actions">
            {#if attachment.status === "failed" && attachmentFiles.has(attachment.id)}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Retry ${attachment.name}`}
                onclick={() => retryAttachment(attachment.id)}
              >
                <RotateCcwIcon aria-hidden="true" />
              </Button>
            {/if}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${attachment.name}`}
              onclick={() => removeAttachment(attachment.id)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  <div class="community-chat-composer__editor-wrap">
    {#if hasSelection && !disabled && !busy}
      <div
        class="community-chat-composer__selection-toolbar"
        role="toolbar"
        aria-label="Selection formatting"
        data-ui-part="selection-toolbar"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Bold selection"
          onclick={() => applyAction("bold")}
          ><BoldIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Italicize selection"
          onclick={() => applyAction("italic")}
          ><ItalicIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Strike through selection"
          onclick={() => applyAction("strikethrough")}
          ><StrikethroughIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Format selection as inline code"
          onclick={() => applyAction("inlineCode")}
          ><CodeIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Link selection"
          onclick={openLinkEditor}><LinkIcon aria-hidden="true" /></Button
        >
      </div>
    {/if}
    <Mira
      bind:this={mira}
      bind:value
      mode="live-preview"
      extensions={[composerExtension]}
      readonly={disabled || busy}
      {placeholder}
      toolbar={false}
      blockControls={false}
      outline={false}
      htmlPolicy="safe"
      class="community-chat-composer__mira"
    />
  </div>

  {#if submitError}
    <p class="community-chat-composer__error" role="alert">{submitError}</p>
  {:else if disabled}
    <p class="community-chat-composer__disabled-reason">{disabledReason}</p>
  {/if}

  <div
    class="community-chat-composer__toolbar"
    role="toolbar"
    aria-label="Message formatting and actions"
    data-ui-part="composer-toolbar"
  >
    <div class="community-chat-composer__toolbar-main">
      {#if formattingOpen}
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Formatting options"
          aria-pressed="true"
          onclick={() => (formattingOpen = false)}
          ><TypeIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Hide formatting"
          onclick={() => (formattingOpen = false)}
          ><XIcon aria-hidden="true" /></Button
        >
        <span class="community-chat-composer__separator" aria-hidden="true"
        ></span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Bold"
          aria-pressed={activeActions.has("bold")}
          disabled={disabled || busy}
          onclick={() => applyAction("bold")}
          ><BoldIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Italic"
          aria-pressed={activeActions.has("italic")}
          disabled={disabled || busy}
          onclick={() => applyAction("italic")}
          ><ItalicIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Strikethrough"
          aria-pressed={activeActions.has("strikethrough")}
          disabled={disabled || busy}
          onclick={() => applyAction("strikethrough")}
          ><StrikethroughIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Inline code"
          aria-pressed={activeActions.has("inlineCode")}
          disabled={disabled || busy}
          onclick={() => applyAction("inlineCode")}
          ><CodeIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Code block"
          disabled={disabled || busy}
          onclick={insertCodeBlock}
          ><SquareCodeIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Link"
          disabled={disabled || busy}
          onclick={openLinkEditor}><LinkIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Bulleted list"
          disabled={disabled || busy}
          onclick={() => applyAction("bulletList")}
          ><ListIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Numbered list"
          disabled={disabled || busy}
          onclick={() => applyAction("numberedList")}
          ><ListOrderedIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quote"
          disabled={disabled || busy}
          onclick={() => applyAction("quote")}
          ><QuoteIcon aria-hidden="true" /></Button
        >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Spoiler"
          disabled={disabled || busy}
          onclick={() => wrapSelection("||", "||", "spoiler")}
          ><EyeOffIcon aria-hidden="true" /></Button
        >
      {:else}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Mention someone"
          disabled={disabled || busy}
          onclick={insertReferencePrefix}
          ><AtSignIcon aria-hidden="true" /></Button
        >
        {#if mediaAdapter}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Attach files"
            disabled={disabled || busy || attachments.length >= maxAttachments}
            onclick={chooseFiles}><PaperclipIcon aria-hidden="true" /></Button
          >
        {/if}
        <CommunityEmojiPicker
          label="Add emoji"
          disabled={disabled || busy}
          {communityEmojis}
          onSelect={insertEmoji}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Show formatting"
          aria-pressed="false"
          disabled={disabled || busy}
          onclick={() => (formattingOpen = true)}
          ><TypeIcon aria-hidden="true" /></Button
        >
      {/if}
    </div>
    <Button
      type="button"
      size="icon-sm"
      class="community-chat-composer__send"
      aria-label={context?.kind === "edit" ? "Save message" : "Send message"}
      disabled={!canSubmit || !onSubmit}
      onclick={submit}
    >
      {#if busy}
        <LoaderCircleIcon
          class="community-chat-composer__spinner"
          aria-hidden="true"
        />
      {:else}
        <SendIcon aria-hidden="true" />
      {/if}
    </Button>
  </div>

  <input
    bind:this={fileInput}
    class="community-chat-composer__file-input"
    type="file"
    multiple
    tabindex="-1"
    aria-hidden="true"
    onchange={handleFileInput}
  />
</div>

<Dialog.Root bind:open={linkOpen}>
  <Dialog.Content class="community-chat-composer__link-dialog">
    <Dialog.Header>
      <Dialog.Title>Add a link</Dialog.Title>
      <Dialog.Description>
        Link the current selection without leaving the composer.
      </Dialog.Description>
    </Dialog.Header>
    <div class="community-chat-composer__link-fields">
      <label for="community-composer-link-label">Text</label>
      <Input id="community-composer-link-label" bind:value={linkLabel} />
      <label for="community-composer-link-url">URL</label>
      <Input
        id="community-composer-link-url"
        bind:value={linkUrl}
        aria-invalid={linkError ? "true" : undefined}
      />
      {#if linkError}<p role="alert">{linkError}</p>{/if}
    </div>
    <Dialog.Footer>
      <Button type="button" variant="ghost" onclick={() => (linkOpen = false)}
        >Cancel</Button
      >
      <Button type="button" onclick={saveLink}>Add link</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .community-chat-composer {
    position: relative;
    width: 100%;
    overflow: visible;
    border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
    border-radius: 0.72rem;
    background: var(--background);
    box-shadow:
      0 1px 2px color-mix(in srgb, var(--foreground) 7%, transparent),
      0 8px 26px color-mix(in srgb, var(--foreground) 4%, transparent);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .community-chat-composer:focus-within {
    border-color: color-mix(in srgb, var(--ring) 68%, var(--border));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--ring) 16%, transparent),
      0 8px 26px color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  .community-chat-composer[data-disabled] {
    background: color-mix(in srgb, var(--muted) 48%, var(--background));
  }

  .community-chat-composer__context {
    display: flex;
    min-height: 2.8rem;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.65rem 0.5rem;
    border-bottom: 1px solid var(--border);
    color: var(--muted-foreground);
  }

  .community-chat-composer__context-icon,
  .community-chat-composer__file-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.45rem;
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .community-chat-composer__context-icon :global(svg),
  .community-chat-composer__file-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .community-chat-composer__context-copy,
  .community-chat-composer__attachment-copy {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.1rem;
  }

  .community-chat-composer__context-copy strong,
  .community-chat-composer__attachment-copy strong {
    overflow: hidden;
    color: var(--foreground);
    font-size: 0.78rem;
    font-weight: 620;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-chat-composer__context-copy span,
  .community-chat-composer__attachment-copy span {
    overflow: hidden;
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-chat-composer__attachments {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 0.45rem;
    padding: 0.55rem 0.65rem 0;
  }

  .community-chat-composer__attachment {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.55rem;
    padding: 0.42rem;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: color-mix(in srgb, var(--muted) 42%, transparent);
  }

  .community-chat-composer__attachment[data-status="failed"] {
    border-color: color-mix(in srgb, var(--destructive) 45%, var(--border));
  }

  .community-chat-composer__attachment > img {
    width: 2.3rem;
    height: 2.3rem;
    flex: 0 0 auto;
    border-radius: 0.42rem;
    object-fit: cover;
  }

  .community-chat-composer__attachment-copy :global([data-ui-part="progress"]) {
    height: 0.18rem;
    margin-top: 0.18rem;
  }

  .community-chat-composer__attachment-actions {
    display: flex;
    align-items: center;
  }

  .community-chat-composer__editor-wrap {
    position: relative;
  }

  .community-chat-composer__selection-toolbar {
    position: absolute;
    z-index: 10;
    top: 0.35rem;
    left: 50%;
    display: flex;
    align-items: center;
    padding: 0.18rem;
    border: 1px solid var(--border);
    border-radius: 0.52rem;
    background: var(--popover);
    box-shadow: 0 5px 18px
      color-mix(in srgb, var(--foreground) 14%, transparent);
    transform: translate(-50%, -100%);
  }

  :global(.community-chat-composer__mira.mira) {
    --mira-editor-padding: 0.75rem 0.75rem 0.35rem;
    --mira-font-size: 0.9rem;
    --mira-line-height: 1.55;
    min-height: 4.2rem;
    border: 0;
    background: transparent;
  }

  :global(.community-chat-composer__mira .mira__body),
  :global(.community-chat-composer__mira .mira__pane),
  :global(.community-chat-composer__mira .mira__editor-scroll),
  :global(.community-chat-composer__mira .mira-code-editor) {
    min-height: 4.2rem;
    border: 0;
    background: transparent;
  }

  :global(.community-chat-composer__mira .cm-editor) {
    min-height: 4.2rem;
    max-height: 16rem;
    background: transparent;
  }

  :global(.community-chat-composer__mira .cm-scroller) {
    overflow-y: auto;
  }

  :global(.community-chat-composer__mira .cm-gutters) {
    display: none;
  }

  :global(.community-chat-composer__mira .cm-focused) {
    outline: none;
  }

  :global(.community-chat-composer__mira .community-composer-token--reference) {
    color: var(--primary);
    font-weight: 650;
  }

  :global(.community-chat-composer__mira .community-composer-token--emoji) {
    color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
  }

  :global(.community-chat-composer__mira .community-composer-emoji) {
    display: inline-block;
    width: 1.15em;
    height: 1.15em;
    margin-inline: 0.04em;
    object-fit: contain;
    user-select: none;
    vertical-align: -0.2em;
  }

  :global(.community-chat-composer__mira .community-composer-token--spoiler) {
    border-radius: 0.2rem;
    background: var(--foreground);
    color: transparent;
  }

  .community-chat-composer__toolbar {
    display: flex;
    min-height: 2.65rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.28rem 0.36rem 0.36rem;
  }

  .community-chat-composer__toolbar-main {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.05rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .community-chat-composer__toolbar-main::-webkit-scrollbar {
    display: none;
  }

  .community-chat-composer__toolbar-main :global([data-ui-component="button"]) {
    color: var(--muted-foreground);
  }

  .community-chat-composer__toolbar-main
    :global([data-ui-component="button"]:hover),
  .community-chat-composer__toolbar-main
    :global([data-ui-component="button"][aria-pressed="true"]) {
    color: var(--foreground);
  }

  .community-chat-composer__separator {
    width: 1px;
    height: 1.25rem;
    margin-inline: 0.28rem;
    background: var(--border);
  }

  :global(.community-chat-composer__send[data-ui-component="button"]) {
    border-radius: 0.5rem;
  }

  .community-chat-composer__spinner {
    animation: community-composer-spin 800ms linear infinite;
  }

  .community-chat-composer__error,
  .community-chat-composer__disabled-reason {
    margin: 0;
    padding: 0.1rem 0.75rem;
    color: var(--destructive);
    font-size: 0.72rem;
  }

  .community-chat-composer__disabled-reason {
    color: var(--muted-foreground);
  }

  .community-chat-composer__file-input {
    position: fixed;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .community-chat-composer__link-fields {
    display: grid;
    gap: 0.45rem;
  }

  .community-chat-composer__link-fields label {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .community-chat-composer__link-fields p {
    margin: 0;
    color: var(--destructive);
    font-size: 0.75rem;
  }

  :global(.community-chat-composer__link-dialog) {
    width: min(30rem, calc(100vw - 2rem));
    max-width: 30rem;
  }

  @keyframes community-composer-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 38rem) {
    .community-chat-composer[data-formatting-open]
      .community-chat-composer__toolbar {
      align-items: flex-end;
    }

    .community-chat-composer__selection-toolbar {
      display: none;
    }
  }
</style>
