<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";

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
  }: {
    room: CommunityRoomModel;
    details: CommunityDetailsModel;
    members: CommunityMemberModel[];
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
      <Badge variant="outline">{room.kind}</Badge>
      {#if room.private}<Badge variant="secondary">Private</Badge>{/if}
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
          <span class="community-details__avatar" aria-hidden="true"
            >{member.initials}</span
          >
          <span>
            <strong>{member.name}</strong>
            <small>@{member.handle}</small>
          </span>
          <i
            role="img"
            class:online={member.presence === "online"}
            aria-label={member.presence ?? "offline"}
          ></i>
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
    font-size: 0.82rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  p,
  li {
    color: var(--muted-foreground);
    font-size: 0.82rem;
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
    font-size: 0.76rem;
  }

  .community-details__members {
    display: grid;
    gap: 0.35rem;
  }

  .community-details__member {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
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
    font-size: 0.8rem;
  }

  .community-details__member small {
    color: var(--muted-foreground);
    font-size: 0.68rem;
  }

  .community-details__avatar {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.6rem;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.65rem;
    font-weight: 700;
  }

  i {
    width: 0.5rem;
    height: 0.5rem;
    border: 1px solid var(--muted-foreground);
    border-radius: 999px;
  }

  i.online {
    border-color: oklch(0.66 0.16 150);
    background: oklch(0.66 0.16 150);
  }
</style>
