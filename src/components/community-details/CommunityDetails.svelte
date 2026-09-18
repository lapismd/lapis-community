<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { communityMemberHandleLabel } from "../community-member-avatar/handle.js";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";

  import {
    memberById,
    type CommunityDetailsModel,
    type CommunityMemberModel,
    type CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    room,
    details,
    members,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
  }: {
    room: CommunityRoomModel;
    details: CommunityDetailsModel;
    members: CommunityMemberModel[];
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void;
    onWaveMember?: (member: CommunityMemberModel) => void;
  } = $props();

  const visibleMembers = $derived(
    details.memberIds.map((id) => memberById(members, id)),
  );
</script>

<div class="community-details">
  <section>
    <h2>About {room.name}</h2>
    <p>{details.description}</p>
    <div class="community-details__facts">
      <span>{room.memberCount ?? visibleMembers.length} members</span>
      <CommunityChip>{room.kind}</CommunityChip>
      {#if room.private}<CommunityChip variant="muted">Private</CommunityChip
        >{/if}
    </div>
  </section>

  {#if details.guidelines?.length}
    <section>
      <h2>Guidelines</h2>
      <ul>
        {#each details.guidelines as guideline (guideline)}
          <li>{guideline}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h2>Members</h2>
    <div class="community-details__members">
      {#each visibleMembers as member (member.id)}
        <div class="community-details__member">
          <CommunityMemberHoverCard
            {member}
            avatarSize="small"
            {...onOpenProfile ? { onOpenProfile } : {}}
            {...onMessageMember ? { onMessage: onMessageMember } : {}}
            {...onWaveMember ? { onWave: onWaveMember } : {}}
          />
          <span>
            <strong>{member.name}</strong>
            <small>{communityMemberHandleLabel(member.handle)}</small>
          </span>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .community-details {
    display: grid;
    gap: 1.35rem;
    padding: 1rem;
  }

  section {
    display: grid;
    gap: 0.65rem;
  }

  h2,
  p,
  ul {
    margin: 0;
  }

  h2 {
    font-size: var(--community-text-secondary);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  p,
  li {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1.5;
  }

  ul {
    display: grid;
    gap: 0.4rem;
    padding-inline-start: 1.2rem;
  }

  .community-details__facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-details__members {
    display: grid;
    gap: 0.35rem;
  }

  .community-details__member {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    border-radius: var(--radius);
    padding: 0.35rem;
  }

  .community-details__member > span:nth-child(2) {
    display: grid;
    min-width: 0;
  }

  .community-details__member strong,
  .community-details__member small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-details__member strong {
    font-size: var(--community-text-secondary);
  }

  .community-details__member small {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
</style>
