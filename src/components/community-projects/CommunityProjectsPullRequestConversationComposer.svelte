<script lang="ts">
  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsPersistedComposer from "./CommunityProjectsPersistedComposer.svelte";

  let {
    value = $bindable(""),
    pullRequestId,
    viewer,
    communityId,
    members = [],
    rooms = [],
    communityEmojis = [],
    busy = false,
    canCollaborate = false,
    onSubmit,
  }: {
    value?: string;
    pullRequestId: string;
    viewer?: string;
    communityId?: string;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    busy?: boolean;
    canCollaborate?: boolean;
    onSubmit: (content: string) => void;
  } = $props();
</script>

<CommunityProjectsPersistedComposer
  class="community-projects__conversation-composer"
  bind:value
  surface="pull-request"
  target={pullRequestId}
  {viewer}
  {...communityId === undefined ? {} : { communityId }}
  placeholder="Add to the review conversation"
  ariaLabel="Pull request comment"
  submitLabel="Comment"
  {members}
  {rooms}
  {communityEmojis}
  {busy}
  disabled={!canCollaborate}
  disabledReason="Sign in to comment on this review"
  onSubmit={(submission) => onSubmit(submission.content)}
/>
