<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { untrack } from "svelte";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import { createBrowserCommunityComposerDraftStore } from "../community-chat-composer/browser-draft-store.js";
  import { communityComposerDraftKey } from "../community-chat-composer/composer-draft-keys.js";
  import CommunityPersistedComposer from "../community-chat-composer/CommunityPersistedComposer.svelte";
  import type {
    CommunityComposerDraftStore,
    CommunityComposerSubmission,
    CommunityMessageMediaAdapter,
  } from "../community-chat-composer/model.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    value = $bindable(""),
    members,
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    communityId,
    draftStore,
    mediaAdapter,
    busy = false,
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    onSubmit,
  }: {
    value?: string;
    members: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    currentMemberId: string;
    communityId?: string;
    draftStore?: CommunityComposerDraftStore;
    mediaAdapter?: CommunityMessageMediaAdapter;
    busy?: boolean;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void;
    onDismissComposerStatus?: () => void;
    onSubmit: (submission: CommunityComposerSubmission) => void | Promise<void>;
  } = $props();

  const resolvedStore = untrack(
    () =>
      draftStore ??
      (typeof window === "undefined"
        ? undefined
        : createBrowserCommunityComposerDraftStore()),
  );
  const draftKey = $derived(
    communityComposerDraftKey({
      viewer: currentMemberId,
      communityId,
      surface: "pulse",
      target: "composer",
    }),
  );
</script>

<CommunityPersistedComposer
  bind:value
  {draftKey}
  {...resolvedStore === undefined ? {} : { draftStore: resolvedStore }}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  placeholder="What’s on your mind?"
  ariaLabel="Pulse composer"
  submitLabel="Post note"
  {busy}
  {...mediaAdapter === undefined ? {} : { mediaAdapter }}
  {...composerStatus === undefined ? {} : { composerStatus }}
  {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
  {...onDismissComposerStatus === undefined ? {} : { onDismissComposerStatus }}
  {onSubmit}
/>
