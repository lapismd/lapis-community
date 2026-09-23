<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatarGroup from "../community-member-avatar-group/CommunityMemberAvatarGroup.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    label,
    avatarLabel = "Reply participants",
    participants,
    onOpenThread,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
  }: {
    label?: string | undefined;
    avatarLabel?: string;
    participants: readonly CommunityMemberModel[];
    onOpenThread?: (() => void) | undefined;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onWaveMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onViewMemberActivity?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
  } = $props();

  const visibleParticipants = $derived(participants.slice(0, 3));
</script>

{#if visibleParticipants.length || label}
  <div class="community-message-reply-summary">
    {#if visibleParticipants.length}
      <CommunityMemberAvatarGroup
        members={visibleParticipants}
        label={avatarLabel}
        avatarSize="xsmall"
        {...onOpenProfile === undefined ? {} : { onOpenProfile }}
        {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
        {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
        {...onViewMemberActivity === undefined
          ? {}
          : { onViewActivity: onViewMemberActivity }}
      />
    {/if}
    {#if label}
      <CommunityChip
        variant="muted"
        size="compact"
        ariaLabel={label}
        {...onOpenThread === undefined ? {} : { onclick: onOpenThread }}
      >
        {label}
      </CommunityChip>
    {/if}
  </div>
{/if}

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
