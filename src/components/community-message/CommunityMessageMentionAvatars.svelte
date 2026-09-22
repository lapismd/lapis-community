<script lang="ts">
  import CommunityMemberAvatarGroup from "../community-member-avatar-group/CommunityMemberAvatarGroup.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  import { taggedMentionAvatarsLabel } from "./implicit-mentions.js";

  let {
    members,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
  }: {
    members: readonly CommunityMemberModel[];
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onViewMemberActivity?: (
      member: CommunityMemberModel,
    ) => void | Promise<void>;
  } = $props();

  const label = $derived(taggedMentionAvatarsLabel(members));
</script>

{#if members.length}
  <div
    class="community-message-mention-avatars"
    data-ui-part="implicit-mentions"
  >
    <CommunityMemberAvatarGroup
      {members}
      {label}
      avatarSize="xsmall"
      {...onOpenProfile === undefined ? {} : { onOpenProfile }}
      {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
      {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
      {...onViewMemberActivity === undefined
        ? {}
        : { onViewActivity: onViewMemberActivity }}
    />
  </div>
{/if}

<style>
  .community-message-mention-avatars {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .community-message-mention-avatars :global(.community-member-avatar-group) {
    flex-wrap: nowrap;
  }
</style>
