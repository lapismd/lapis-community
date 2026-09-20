<script lang="ts">
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    avatarSize = "xsmall",
    trigger = "avatar",
    triggerLabel = member.name,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
  }: {
    member: CommunityMemberModel;
    avatarSize?: "xsmall" | "small" | "medium" | undefined;
    trigger?: "avatar" | "mention" | undefined;
    triggerLabel?: string | undefined;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onWaveMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
  } = $props();
</script>

<span class="community-projects-member-hover">
  <CommunityMemberHoverCard
    {member}
    {avatarSize}
    {trigger}
    {triggerLabel}
    {...onOpenProfile === undefined ? {} : { onOpenProfile }}
    {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
    {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
  />
</span>

<style>
  .community-projects-member-hover {
    display: contents;
  }
</style>
