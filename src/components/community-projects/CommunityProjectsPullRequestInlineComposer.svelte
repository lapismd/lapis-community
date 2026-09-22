<script lang="ts">
  import type { FileDiffLineContext } from "@lapismd/design-core/diff";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsPersistedComposer from "./CommunityProjectsPersistedComposer.svelte";
  import { diffLineSide } from "./pull-request-review.js";
  import { reviewComposerDraftScopeReader } from "./review-composer-draft-scope.js";

  let {
    value = $bindable(""),
    context,
    members = [],
    rooms = [],
    communityEmojis = [],
    busy = false,
    canCollaborate = false,
    onCancel,
    onSubmit,
  }: {
    value?: string;
    context: FileDiffLineContext;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    busy?: boolean;
    canCollaborate?: boolean;
    onCancel: () => void;
    onSubmit: (content: string) => void;
  } = $props();

  const readScope = reviewComposerDraftScopeReader();
  const draftTarget = $derived.by(() => {
    const scope = readScope?.();
    const side = diffLineSide(context.variant);
    const line = context.lineNumber ?? 0;
    return [scope?.pullRequestId ?? "", context.path, side, line].join(":");
  });
  const viewer = $derived(readScope?.()?.viewer);
  const communityId = $derived(readScope?.()?.communityId);
</script>

<CommunityProjectsPersistedComposer
  class="community-projects__inline-composer"
  bind:value
  surface="pull-request-inline"
  target={draftTarget}
  {...viewer === undefined ? {} : { viewer }}
  {...communityId === undefined ? {} : { communityId }}
  placeholder="Leave a comment on this line…"
  ariaLabel={`Comment on ${context.path} line ${context.lineNumber}`}
  submitLabel="Comment"
  {members}
  {rooms}
  {communityEmojis}
  {busy}
  disabled={!canCollaborate}
  disabledReason="Sign in to comment on this review"
  {onCancel}
  onSubmit={(submission) => onSubmit(submission.content)}
/>
