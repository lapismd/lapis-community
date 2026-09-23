<script lang="ts">
  import { untrack } from "svelte";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import { createBrowserCommunityComposerDraftStore } from "../community-chat-composer/browser-draft-store.js";
  import {
    communityComposerDraftKey,
    type CommunityComposerDraftSurface,
  } from "../community-chat-composer/composer-draft-keys.js";
  import CommunityPersistedComposer from "../community-chat-composer/CommunityPersistedComposer.svelte";
  import type { CommunityComposerSubmission } from "../community-chat-composer/model.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    value = $bindable(""),
    surface,
    target,
    viewer,
    communityId,
    class: className = "",
    placeholder,
    ariaLabel,
    submitLabel,
    members = [],
    rooms = [],
    communityEmojis = [],
    busy = false,
    disabled = false,
    disabledReason,
    onCancel,
    onSubmit,
  }: {
    value?: string;
    surface: CommunityComposerDraftSurface;
    target: string;
    viewer?: string | undefined;
    communityId?: string | undefined;
    class?: string;
    placeholder: string;
    ariaLabel: string;
    submitLabel: string;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    busy?: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onCancel?: () => void;
    onSubmit: (submission: CommunityComposerSubmission) => void | Promise<void>;
  } = $props();

  const draftStore = untrack(() =>
    typeof window === "undefined"
      ? undefined
      : createBrowserCommunityComposerDraftStore(),
  );
  const draftKey = $derived(
    communityComposerDraftKey({
      viewer,
      communityId,
      surface,
      target,
    }),
  );
</script>

<CommunityPersistedComposer
  class={className}
  bind:value
  {draftKey}
  {...draftStore === undefined ? {} : { draftStore }}
  {members}
  {rooms}
  {communityEmojis}
  {...viewer === undefined ? {} : { currentMemberId: viewer }}
  {placeholder}
  {ariaLabel}
  {submitLabel}
  {busy}
  {disabled}
  {...disabledReason === undefined ? {} : { disabledReason }}
  {...onCancel === undefined ? {} : { onCancel }}
  {onSubmit}
/>
