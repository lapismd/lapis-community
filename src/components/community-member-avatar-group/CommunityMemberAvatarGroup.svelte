<script lang="ts">
  import type { ComponentProps } from "svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import { communityMemberAvatarShape } from "../community-member-avatar/model.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  let {
    members,
    label = "Members",
    avatarSize = "small",
    ...actions
  }: Pick<
    ComponentProps<typeof CommunityMemberHoverCard>,
    | "onOpenProfile"
    | "onMessage"
    | "onWave"
    | "onViewActivity"
    | "openDelay"
    | "avatarSize"
  > & { members: readonly CommunityMemberModel[]; label?: string } = $props();
</script>

<div
  class="community-member-avatar-group"
  data-avatar-size={avatarSize}
  role="group"
  aria-label={label}
>
  {#each members as member (member.id)}
    <div
      class="community-member-avatar-group__member"
      data-shape={communityMemberAvatarShape(member)}
    >
      <CommunityMemberHoverCard {member} {avatarSize} {...actions} />
    </div>
  {/each}
</div>

<style>
  .community-member-avatar-group {
    --community-member-avatar-group-overlap: 0.5rem;

    display: flex;
    align-items: center;
    flex-wrap: wrap;
    padding-inline-start: var(--community-member-avatar-group-overlap);
  }
  .community-member-avatar-group[data-avatar-size="xsmall"] {
    --community-member-avatar-group-overlap: 0.4rem;
  }
  .community-member-avatar-group__member {
    position: relative;
    margin-inline-start: calc(
      -1 * var(--community-member-avatar-group-overlap)
    );
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--background);
  }
  .community-member-avatar-group__member[data-shape="rounded"] {
    border-radius: 25%;
  }
  .community-member-avatar-group__member:hover,
  .community-member-avatar-group__member:focus-within {
    z-index: 1;
  }
</style>
