<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatarGroup from "../community-member-avatar-group/CommunityMemberAvatarGroup.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    label,
    participants,
    onOpenThread,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
  }: {
    label: string;
    participants: readonly CommunityMemberModel[];
    onOpenThread?: () => void;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onViewMemberActivity?: (
      member: CommunityMemberModel,
    ) => void | Promise<void>;
  } = $props();

  const visibleParticipants = $derived(participants.slice(0, 3));
</script>

<div class="community-message-reply-summary">
  {#if visibleParticipants.length}
    <CommunityMemberAvatarGroup
      members={visibleParticipants}
      label="Reply participants"
      avatarSize="xsmall"
      {...onOpenProfile === undefined ? {} : { onOpenProfile }}
      {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
      {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
      {...onViewMemberActivity === undefined
        ? {}
        : { onViewActivity: onViewMemberActivity }}
    />
  {/if}
  <CommunityChip
    variant="muted"
    size="compact"
    ariaLabel={label}
    {...onOpenThread === undefined ? {} : { onclick: onOpenThread }}
  >
    {label}
  </CommunityChip>
</div>

<style>
  .community-message-reply-summary {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 0.35rem;
  }

  .community-message-reply-summary :global(.community-member-avatar-group) {
    flex-wrap: nowrap;
  }

  .community-message-reply-summary :global([data-ui-part="community-chip"]) {
    flex: none;
    width: fit-content;
    max-width: 100%;
  }
</style>
