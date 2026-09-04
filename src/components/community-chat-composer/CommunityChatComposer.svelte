<script lang="ts">
  import "@lapismd/mira/styles.css";

  import Mira, {
    type MiraHandle,
    type MiraMarkdownActionId,
  } from "@lapismd/mira";
  import {
    Composer,
    ComposerDrawer,
    type ComposerStatus,
  } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Progress } from "@lapismd/design-core/shadcn/progress";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import AtSignIcon from "@lucide/svelte/icons/at-sign";
  import BoldIcon from "@lucide/svelte/icons/bold";
  import CodeIcon from "@lucide/svelte/icons/code";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import HashIcon from "@lucide/svelte/icons/hash";
  import ItalicIcon from "@lucide/svelte/icons/italic";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ListIcon from "@lucide/svelte/icons/list";
  import ListOrderedIcon from "@lucide/svelte/icons/list-ordered";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import PaperclipIcon from "@lucide/svelte/icons/paperclip";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import QuoteIcon from "@lucide/svelte/icons/quote";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SendIcon from "@lucide/svelte/icons/send";
  import SmileIcon from "@lucide/svelte/icons/smile";
  import SquareCodeIcon from "@lucide/svelte/icons/square-code";
  import StrikethroughIcon from "@lucide/svelte/icons/strikethrough";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import TypeIcon from "@lucide/svelte/icons/type";
  import XIcon from "@lucide/svelte/icons/x";
  import type { EditorView } from "@codemirror/view";
  import { onMount, tick, type Snippet, untrack } from "svelte";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityReplyContext from "../community-reply-context/CommunityReplyContext.svelte";
  import "../community-composer-status.css";
  import {
    communityEmojiAutocompleteItems,
    communityMemberAutocompleteItems,
    communityRoomAutocompleteItems,
    detectCommunityComposerAutocomplete,
    type CommunityComposerAutocompleteItem,
    type CommunityComposerAutocompleteQuery,
  } from "./autocomplete.js";
  import {
    createCommunityComposerExtension,
    refreshCommunityComposerTokenDecorations,
  } from "./composer-extension.js";
  import {
    communityEmojiToken,
    formatCommunityAttachmentSize,
    isFencedCodePosition,
    isInlineCodePosition,
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
    composerStatus,
    busy = false,
    ariaLabel = "Message composer",
    submitLabel,
    additionalActions,
    onSubmit,
    onCancel,
    onCancelContext,
    onEditLastMessage,
    onRetryComposerStatus,
    onDismissComposerStatus,
    class: className = "",
    ref = $bindable(null),
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
    composerStatus?: ComposerStatus;
    busy?: boolean;
    ariaLabel?: string;
    submitLabel?: string;
    additionalActions?: Snippet;
    onSubmit?: (
      submission: CommunityComposerSubmission,
    ) => void | Promise<void>;
    onCancel?: () => void;
    onCancelContext?: () => void;
    onEditLastMessage?: () => void;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    class?: string;
    ref?: HTMLDivElement | null;
  } = $props();

  let mira = $state<MiraHandle>();
  let editorView = $state<EditorView>();
  let fileInput = $state<HTMLInputElement>();
  let autocompleteList = $state<HTMLDivElement | null>(null);
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
  let autocompleteQuery = $state<CommunityComposerAutocompleteQuery>();
  let autocompleteItems = $state<CommunityComposerAutocompleteItem[]>([]);
  let autocompleteSelectedIndex = $state(0);
  let autocompletePlacement = $state<"above" | "below">("above");
  let autocompleteGeneration = 0;
  let retryStatusPending = $state(false);
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
  const activeStatus = $derived<ComposerStatus | undefined>(
    submitError
      ? {
          type: "error",
          message: submitError,
        }
      : (composerStatus ??
          (disabled
            ? { type: "warning", message: disabledReason }
            : undefined)),
  );

  const composerExtension = createCommunityComposerExtension({
    members: () => members,
    rooms: () => rooms,
    emojis: () => communityEmojis,
    disabled: () => disabled || busy || !onSubmit,
    editing: () => context?.kind === "edit",
    autocompleteOpen: () => autocompleteItems.length > 0,
    onView(view) {
      editorView = view;
    },
    onSelection(state) {
      editorView = state.view;
      selectionFrom = state.selectionFrom;
      selectionTo = state.selectionTo;
      updateActiveActions(state.view);
    },
    onAutocompleteQuery: updateAutocomplete,
    onAutocompleteMove(direction) {
      if (autocompleteItems.length === 0) return;
      autocompleteSelectedIndex =
        (autocompleteSelectedIndex + direction + autocompleteItems.length) %
        autocompleteItems.length;
      void tick().then(() => {
        autocompleteList
          ?.querySelector<HTMLElement>("[aria-selected='true']")
          ?.scrollIntoView({ block: "nearest" });
      });
    },
    onAutocompleteAccept() {
      return selectAutocomplete(autocompleteSelectedIndex);
    },
    onAutocompleteDismiss() {
      clearAutocomplete();
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

  onMount(() => {
    const reposition = () => scheduleAutocompletePlacement();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  });

  $effect(() => {
    tokenModelSignature;
    const view = editorView;
    if (view) {
      refreshCommunityComposerTokenDecorations(view);
      const selection = view.state.selection.main;
      const editorValue = view.state.doc.toString();
      updateAutocomplete(
        selection.empty &&
          !isFencedCodePosition(editorValue, selection.head) &&
          !isInlineCodePosition(editorValue, selection.head)
          ? detectCommunityComposerAutocomplete(
              editorValue,
              selection.head,
              members,
            )
          : null,
      );
    }
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

  function updateAutocomplete(
    query: CommunityComposerAutocompleteQuery | null,
  ): void {
    autocompleteGeneration += 1;
    autocompleteQuery = query ?? undefined;
    autocompleteSelectedIndex = 0;
    if (!query) {
      autocompleteItems = [];
      return;
    }
    if (query.kind === "member") {
      autocompleteItems = communityMemberAutocompleteItems(
        members,
        query.query,
      );
      scheduleAutocompletePlacement();
      return;
    }
    if (query.kind === "room") {
      autocompleteItems = communityRoomAutocompleteItems(rooms, query.query);
      scheduleAutocompletePlacement();
      return;
    }
    autocompleteItems = [];
    const generation = autocompleteGeneration;
    void communityEmojiAutocompleteItems(communityEmojis, query.query).then(
      (items) => {
        if (generation !== autocompleteGeneration) return;
        autocompleteItems = items;
        scheduleAutocompletePlacement();
      },
    );
  }

  function scheduleAutocompletePlacement(): void {
    if (autocompleteItems.length === 0) return;
    void tick().then(updateAutocompletePlacement);
  }

  function updateAutocompletePlacement(): void {
    if (!ref || !autocompleteList || autocompleteItems.length === 0) return;
    const composerBounds = ref.getBoundingClientRect();
    let boundaryTop = 0;
    let ancestor = ref.parentElement;
    while (ancestor) {
      const style = getComputedStyle(ancestor);
      if (
        /(auto|scroll|hidden|clip)/u.test(
          `${style.overflow} ${style.overflowY}`,
        )
      ) {
        const bounds = ancestor.getBoundingClientRect();
        boundaryTop = Math.max(boundaryTop, bounds.top);
      }
      ancestor = ancestor.parentElement;
    }
    const gap = 0.4 * Number.parseFloat(getComputedStyle(ref).fontSize);
    const popupHeight = autocompleteList.getBoundingClientRect().height;
    autocompletePlacement =
      composerBounds.top - boundaryTop - gap >= popupHeight ? "above" : "below";
  }

  function clearAutocomplete(): void {
    autocompleteGeneration += 1;
    autocompleteQuery = undefined;
    autocompleteItems = [];
    autocompleteSelectedIndex = 0;
  }

  function selectAutocomplete(index: number): boolean {
    const item = autocompleteItems[index];
    const query = autocompleteQuery;
    const view = editorView;
    if (!item || !query || !view) return false;
    const insert =
      item.member !== undefined
        ? `@${item.member.name} `
        : item.room !== undefined
          ? `#${item.room.name} `
          : item.customEmoji !== undefined
            ? `:${item.customEmoji.shortcode}: `
            : `${item.native ?? ""} `;
    if (insert.trim() === "") return false;
    view.dispatch({
      changes: { from: query.from, to: query.to, insert },
      selection: { anchor: query.from + insert.length },
    });
    if (item.member) {
      selectedMentionPubkeys = addUnique(
        selectedMentionPubkeys,
        item.member.id,
      );
    }
    if (item.room) {
      selectedChannelIds = addUnique(selectedChannelIds, item.room.id);
    }
    clearAutocomplete();
    view.focus();
    return true;
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
    editorView?.focus();
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

  function attachmentStatusLabel(
    attachment: CommunityComposerAttachment,
  ): string {
    if (attachment.status === "uploading") {
      return `Uploading ${Math.round(attachment.progress ?? 0)}%`;
    }
    if (attachment.status === "failed") {
      return attachment.error ?? "Upload failed";
    }
    if (attachment.status === "uploaded") {
      return `Ready, ${formatCommunityAttachmentSize(attachment.size)}`;
    }
    return `Waiting, ${formatCommunityAttachmentSize(attachment.size)}`;
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

  async function retryComposerStatus(): Promise<void> {
    if (retryStatusPending) return;
    retryStatusPending = true;
    try {
      if (submitError) {
        await submit();
      } else {
        await onRetryComposerStatus?.();
      }
    } finally {
      retryStatusPending = false;
    }
  }

  function dismissComposerStatus(): void {
    if (submitError) submitError = "";
    onDismissComposerStatus?.();
  }
</script>

<div
  bind:this={ref}
  class={`community-chat-composer ${className}`.trim()}
  data-ui-component="community-chat-composer"
  data-disabled={disabled ? "" : undefined}
  data-formatting-open={formattingOpen ? "" : undefined}
  role="group"
  aria-label={ariaLabel}
  ondragover={handleDragOver}
  ondrop={handleDrop}
>
  {#if autocompleteQuery && autocompleteItems.length}
    <div
      class="community-chat-composer__autocomplete-layer"
      data-ui-part="composer-autocomplete-layer"
      data-kind={autocompleteQuery.kind}
      data-placement={autocompletePlacement}
    >
      <ScrollArea
        bind:ref={autocompleteList}
        class="community-chat-composer__autocomplete"
        orientation="vertical"
        onpointerdown={(event) => event.preventDefault()}
      >
        <div
          class="community-chat-composer__autocomplete-options"
          role="listbox"
          tabindex="-1"
          aria-label={`${autocompleteQuery.kind === "member" ? "People" : autocompleteQuery.kind === "room" ? "Channels" : "Emoji"} suggestions`}
        >
          {#each autocompleteItems as item, index (item.id)}
            <button
              type="button"
              role="option"
              aria-selected={index === autocompleteSelectedIndex}
              tabindex="-1"
              class:community-chat-composer__autocomplete-option--selected={index ===
                autocompleteSelectedIndex}
              class="community-chat-composer__autocomplete-option"
              onclick={() => selectAutocomplete(index)}
            >
              <span class="community-chat-composer__autocomplete-icon">
                {#if item.member}
                  <CommunityMemberAvatar
                    member={item.member}
                    size="small"
                    decorative
                  />
                {:else if item.room}
                  <HashIcon aria-hidden="true" />
                {:else if item.customEmoji}
                  <img
                    src={item.customEmoji.url}
                    alt={`:${item.customEmoji.shortcode}:`}
                  />
                {:else if item.native}
                  <span aria-hidden="true">{item.native}</span>
                {:else}
                  <SmileIcon aria-hidden="true" />
                {/if}
              </span>
              <span class="community-chat-composer__autocomplete-copy">
                <strong
                  >{item.kind === "member"
                    ? `@${item.label}`
                    : item.kind === "room"
                      ? `#${item.label}`
                      : `:${item.label}:`}</strong
                >
                {#if item.detail}
                  <small>{item.detail}</small>
                {/if}
              </span>
            </button>
          {/each}
        </div>
      </ScrollArea>
    </div>
  {/if}

  <Composer
    class="community-chat-composer__surface"
    {value}
    density="spacious"
    elevation="low"
    disabled={disabled || busy}
    interactiveDrawerWhenDisabled={activeStatus !== undefined}
    {...activeStatus === undefined ? {} : { status: activeStatus }}
    statusPosition="top"
    aria-label={ariaLabel}
    title={disabled ? disabledReason : undefined}
    onSubmit={() => void submit()}
  >
    {#snippet drawer()}
      {#if activeStatus && (submitError || onRetryComposerStatus || onDismissComposerStatus)}
        <span
          class="community-composer-status-actions"
          data-ui-part="composer-status-actions"
        >
          {#if submitError || onRetryComposerStatus}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Retry"
              title="Retry"
              disabled={retryStatusPending}
              onclick={retryComposerStatus}
            >
              {#if retryStatusPending}
                <LoaderCircleIcon
                  class="community-chat-composer__spinner"
                  aria-hidden="true"
                />
              {:else}
                <RotateCcwIcon aria-hidden="true" />
              {/if}
            </Button>
          {/if}
          {#if submitError || onDismissComposerStatus}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss"
              title="Dismiss"
              onclick={dismissComposerStatus}
            >
              <XIcon aria-hidden="true" />
            </Button>
          {/if}
        </span>
      {/if}
      {#if context?.kind === "reply"}
        <CommunityReplyContext
          target={context.target}
          {...onCancelContext === undefined
            ? {}
            : { onCancel: onCancelContext }}
        />
      {:else if context?.kind === "edit"}
        <ComposerDrawer
          class="community-chat-composer__context-drawer"
          role="group"
          aria-label="Editing message"
        >
          <div
            class="community-chat-composer__context"
            data-ui-part="composer-context"
          >
            <span class="community-chat-composer__context-icon">
              <PencilLineIcon aria-hidden="true" />
            </span>
            <span class="community-chat-composer__context-copy">
              <strong>Editing message</strong>
            </span>
            {#if onCancelContext}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Cancel edit"
                onclick={onCancelContext}
              >
                <XIcon aria-hidden="true" />
              </Button>
            {/if}
          </div>
        </ComposerDrawer>
      {/if}
    {/snippet}

    {#snippet input()}
      {#if attachments.length}
        <div
          class="community-chat-composer__attachments"
          data-ui-part="composer-attachments"
          role="list"
          aria-label="Message attachments"
        >
          {#each attachments as attachment (attachment.id)}
            <div
              class="community-chat-composer__attachment"
              data-status={attachment.status}
              role="listitem"
              aria-label={`${attachment.name}. ${attachmentStatusLabel(attachment)}`}
              title={attachment.name}
            >
              <div class="community-chat-composer__attachment-preview">
                {#if attachment.previewUrl && attachment.mimeType.startsWith("image/")}
                  <img src={attachment.previewUrl} alt="" />
                {:else}
                  <FileTextIcon aria-hidden="true" />
                {/if}
              </div>
              <span class="community-chat-composer__sr-only">
                {attachment.name}. {attachmentStatusLabel(attachment)}
              </span>
              {#if attachment.status === "uploading"}
                <Progress
                  value={attachment.progress ?? 0}
                  aria-label={`Uploading ${attachment.name}`}
                />
              {/if}
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
            </div>
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
        <ScrollArea
          type="auto"
          orientation="vertical"
          class="community-chat-composer__editor-scroll-area"
        >
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
        </ScrollArea>
      </div>
    {/snippet}

    {#snippet footerActions()}
      <div
        class="community-chat-composer__toolbar-main"
        role="toolbar"
        aria-label="Message formatting and actions"
        data-ui-part="composer-toolbar"
      >
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
              disabled={disabled ||
                busy ||
                attachments.length >= maxAttachments}
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
      {#if additionalActions}{@render additionalActions()}{/if}
    {/snippet}

    {#snippet sendButton()}
      {#if onCancel}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onclick={onCancel}>Cancel</Button
        >
      {/if}
      <Button
        type="button"
        size="icon-sm"
        class="community-chat-composer__send"
        aria-label={submitLabel ??
          (context?.kind === "edit" ? "Save message" : "Send message")}
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
    {/snippet}
  </Composer>

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
  }

  :global(
      .community-chat-composer__surface[data-ui-component="ai-chat-composer"]
    ) {
    --ui-ai-chat-composer-radius: 0.75rem;
    --ui-ai-chat-composer-padding: 0.65rem;
    width: 100%;
  }

  .community-chat-composer__autocomplete-layer {
    position: absolute;
    z-index: 50;
    right: 0;
    bottom: calc(100% + 0.4rem);
    left: 0;
    padding-inline: 0.2rem;
  }

  .community-chat-composer__autocomplete-layer[data-placement="below"] {
    top: calc(100% + 0.4rem);
    bottom: auto;
  }

  :global(
      .community-chat-composer__autocomplete[data-ui-component="scroll-area"]
    ) {
    max-height: 12rem;
    border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    border-radius: 0.75rem;
    background: var(--popover);
    box-shadow:
      0 14px 36px color-mix(in srgb, var(--foreground) 16%, transparent),
      0 1px 2px color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  :global(
      .community-chat-composer__autocomplete
        > [data-ui-part="scroll-area-viewport"]
    ) {
    max-height: 12rem;
  }

  .community-chat-composer__autocomplete-options {
    display: grid;
    gap: 0.125rem;
    padding: 0.25rem;
  }

  .community-chat-composer__autocomplete-option {
    display: flex;
    width: 100%;
    min-height: 2.65rem;
    align-items: center;
    gap: 0.65rem;
    padding: 0.35rem 0.65rem;
    border: 0;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--popover-foreground);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .community-chat-composer__autocomplete-option:hover,
  .community-chat-composer__autocomplete-option--selected {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .community-chat-composer__autocomplete-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--muted) 72%, transparent);
    font-size: 1.2rem;
  }

  .community-chat-composer__autocomplete-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .community-chat-composer__autocomplete-icon > img {
    width: 1.35rem;
    height: 1.35rem;
    object-fit: contain;
  }

  .community-chat-composer__autocomplete-copy {
    display: grid;
    min-width: 0;
    gap: 0.08rem;
  }

  .community-chat-composer__autocomplete-copy strong,
  .community-chat-composer__autocomplete-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-chat-composer__autocomplete-copy strong {
    font-size: 0.82rem;
    font-weight: 620;
  }

  .community-chat-composer__autocomplete-copy small {
    color: var(--muted-foreground);
    font-size: 0.7rem;
  }

  .community-chat-composer__context {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 2rem;
    align-items: center;
    gap: 0.65rem;
    color: var(--muted-foreground);
  }

  :global(
      .community-chat-composer__context-drawer[data-ui-component="ai-chat-composer-drawer"]
    ) {
    border-radius: 0.75rem 0.75rem 0 0;
  }

  :global(
      .community-chat-composer__surface[data-ui-component="ai-chat-composer"][data-disabled="true"][data-interactive-drawer-when-disabled="true"]:has(
          > [data-ui-part="status"][data-position="top"]
        )
        > [data-ui-part="body"]
        > [data-ui-part="input-area"]
    ),
  :global(
      .community-chat-composer__surface[data-ui-component="ai-chat-composer"][data-disabled="true"][data-interactive-drawer-when-disabled="true"]:has(
          > [data-ui-part="status"][data-position="top"]
        )
        > [data-ui-part="body"]
        > [data-ui-part="footer"]
    ) {
    opacity: 0.7;
  }

  .community-chat-composer__context-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.45rem;
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .community-chat-composer__context-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .community-chat-composer__context-copy {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.1rem;
  }

  .community-chat-composer__context-copy strong {
    overflow: hidden;
    color: var(--foreground);
    font-size: 0.78rem;
    font-weight: 620;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-chat-composer__context-copy span {
    overflow: hidden;
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-chat-composer__attachments {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-block: 0.1rem 0.45rem;
  }

  .community-chat-composer__attachment {
    position: relative;
    display: grid;
    width: 4.25rem;
    height: 4.25rem;
    flex: 0 0 4.25rem;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--muted) 70%, var(--background));
  }

  .community-chat-composer__attachment[data-status="failed"] {
    border-color: color-mix(in srgb, var(--destructive) 45%, var(--border));
  }

  .community-chat-composer__attachment-preview,
  .community-chat-composer__attachment-preview > img {
    width: 100%;
    height: 100%;
  }

  .community-chat-composer__attachment-preview {
    display: grid;
    place-items: center;
    color: var(--muted-foreground);
  }

  .community-chat-composer__attachment-preview > img {
    object-fit: cover;
  }

  .community-chat-composer__attachment-preview > :global(svg) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .community-chat-composer__attachment > :global([data-ui-part="progress"]) {
    position: absolute;
    z-index: 2;
    right: 0.25rem;
    bottom: 0.25rem;
    left: 0.25rem;
    height: 0.18rem;
  }

  .community-chat-composer__attachment-actions {
    position: absolute;
    z-index: 3;
    top: 0.2rem;
    right: 0.2rem;
    display: flex;
    align-items: center;
    gap: 0.1rem;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .community-chat-composer__attachment:hover
    .community-chat-composer__attachment-actions,
  .community-chat-composer__attachment:focus-within
    .community-chat-composer__attachment-actions,
  .community-chat-composer__attachment[data-status="failed"]
    .community-chat-composer__attachment-actions {
    opacity: 1;
  }

  .community-chat-composer__attachment-actions
    :global([data-ui-component="button"]) {
    width: 1.45rem;
    height: 1.45rem;
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--background) 88%, transparent);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 15%, transparent);
    backdrop-filter: blur(6px);
  }

  .community-chat-composer__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
    margin: -1px;
    white-space: nowrap;
  }

  .community-chat-composer__editor-wrap {
    --community-chat-composer-editor-max-height: calc(7 * 0.9rem * 1.55);

    position: relative;
    width: 100%;
    min-width: 0;
  }

  :global(
      .community-chat-composer__editor-scroll-area[data-ui-component="scroll-area"]
    ),
  :global(
      .community-chat-composer__editor-scroll-area
        > [data-ui-part="scroll-area-viewport"]
    ) {
    width: 100%;
    min-height: 3.25rem;
    max-height: var(--community-chat-composer-editor-max-height);
  }

  :global(
      .community-chat-composer__editor-scroll-area
        > [data-ui-part="scroll-area-viewport"]:focus-visible
    ) {
    outline: none;
    box-shadow: none;
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
    --file-line-width: 100%;
    --file-margins-x: 0;
    --file-margins-y: 0;
    --mira-editor-padding: 0;
    --mira-font-size: 0.9rem;
    --mira-line-height: 1.55;
    width: 100%;
    height: auto;
    min-height: 3.25rem;
    border: 0;
    background: transparent;
  }

  :global(.community-chat-composer__mira .mira__body),
  :global(.community-chat-composer__mira .mira__pane),
  :global(.community-chat-composer__mira .mira__editor-scroll),
  :global(.community-chat-composer__mira .mira-code-editor) {
    min-height: 3.25rem;
    border: 0;
    background: transparent;
  }

  :global(.community-chat-composer__mira .cm-editor) {
    --file-line-width: 100%;
    --file-margins-x: 0;
    --file-margins-y: 0;
    min-height: 3.25rem;
    max-height: none;
    background: transparent;
  }

  :global(.community-chat-composer__mira .cm-editor > .cm-scroller) {
    padding: 0;
    overflow: visible;
    scrollbar-gutter: auto;
  }

  :global(.community-chat-composer__mira .cm-cursor) {
    border-inline-start: 2px solid var(--foreground);
    margin-inline-start: -1px;
  }

  :global(.community-chat-composer__mira .cm-placeholder) {
    padding-inline-start: 0.25rem;
  }

  :global(
      .community-chat-composer__surface[data-ui-component="ai-chat-composer"][data-disabled="true"]
        .community-chat-composer__mira
        .cm-placeholder
    ) {
    color: var(--foreground);
  }

  :global(.community-chat-composer__mira .cm-gutters) {
    display: none;
  }

  :global(.community-chat-composer__mira .cm-focused) {
    outline: none;
  }

  :global(.community-chat-composer__mira .community-composer-token--mention) {
    padding: 0.06em 0.24em;
    border-radius: calc(var(--radius) - 0.2rem);
    background: var(--secondary);
    box-decoration-break: clone;
    color: var(--secondary-foreground);
    font-weight: 650;
    -webkit-box-decoration-break: clone;
  }

  :global(.community-chat-composer__mira .community-composer-token--channel) {
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
    .community-chat-composer__selection-toolbar {
      display: none;
    }
  }

  @media (hover: none) {
    .community-chat-composer__attachment-actions {
      opacity: 1;
    }
  }
</style>
