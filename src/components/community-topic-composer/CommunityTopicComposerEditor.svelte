<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { untrack } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityTopicDraft,
  } from "../../community/index.js";
  import { createBrowserCommunityComposerDraftStore } from "../community-chat-composer/browser-draft-store.js";
  import { communityComposerDraftKey } from "../community-chat-composer/composer-draft-keys.js";
  import { composerDraftScopeReader } from "../community-chat-composer/composer-draft-scope.js";
  import CommunityPersistedComposer from "../community-chat-composer/CommunityPersistedComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    content = $bindable(""),
    forumName,
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    disabled = false,
    disabledReason = "Posting is unavailable",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    pending = false,
    composer = $bindable(null),
    onPublish,
  }: {
    open?: boolean;
    content?: string;
    forumName: string;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    currentMemberId?: string;
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    pending?: boolean;
    composer?: HTMLDivElement | null;
    onPublish: (draft: CommunityTopicDraft) => Promise<void>;
  } = $props();

  const draftStore = untrack(() =>
    typeof window === "undefined"
      ? undefined
      : createBrowserCommunityComposerDraftStore(),
  );
  const readScope = composerDraftScopeReader();
  const draftKey = $derived.by(() => {
    const scope = readScope?.();
    return scope
      ? communityComposerDraftKey({
          viewer: scope.viewer ?? currentMemberId,
          communityId: scope.communityId,
          surface: "forum-topic",
          target: scope.roomId,
        })
      : undefined;
  });

  async function cancel(): Promise<void> {
    open = false;
    content = "";
    if (draftStore && draftKey) await draftStore.remove(draftKey);
  }

  async function publish(value: string): Promise<void> {
    const normalized = value.trim();
    if (!normalized || pending) return;
    const firstLine = normalized.split(/\r?\n/u)[0] ?? normalized;
    await onPublish({
      title:
        firstLine.length > 120
          ? `${firstLine.slice(0, 119).trimEnd()}…`
          : firstLine,
      content: normalized,
      tags: [],
    });
    open = false;
  }
</script>

<CommunityPersistedComposer
  bind:ref={composer}
  bind:value={content}
  draftKey={draftKey ?? "community-composer:unscoped-topic"}
  {...draftStore === undefined || draftKey === undefined ? {} : { draftStore }}
  {members}
  {rooms}
  {communityEmojis}
  {...currentMemberId === undefined ? {} : { currentMemberId }}
  {disabled}
  {disabledReason}
  busy={pending}
  ariaLabel={`New post in ${forumName}`}
  submitLabel="Publish post"
  placeholder="Write your post…"
  {...composerStatus === undefined ? {} : { composerStatus }}
  {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
  {...onDismissComposerStatus === undefined ? {} : { onDismissComposerStatus }}
  onCancel={cancel}
  onSubmit={(submission) => publish(submission.content)}
/>
