<script lang="ts">
  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsPersistedComposer from "./CommunityProjectsPersistedComposer.svelte";

  let {
    value = $bindable(""),
    taskId,
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
    taskId: string;
    viewer?: string;
    communityId?: string;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    busy?: boolean;
    canCollaborate?: boolean;
    onSubmit: (content: string) => void | Promise<void>;
  } = $props();
</script>

<CommunityProjectsPersistedComposer
  class="community-projects__task-composer"
  bind:value
  surface="task"
  target={taskId}
  {viewer}
  {...communityId === undefined ? {} : { communityId }}
  placeholder="Add a comment…"
  ariaLabel="Task comment"
  submitLabel="Comment"
  {members}
  {rooms}
  {communityEmojis}
  {busy}
  disabled={!canCollaborate}
  disabledReason="Sign in to comment on this task"
  onSubmit={(submission) => onSubmit(submission.content)}
/>
