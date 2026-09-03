<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import HandIcon from "@lucide/svelte/icons/hand";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";

  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    onMessage = () => {},
    onWave = () => {},
    onFollow = () => {},
  }: {
    member: CommunityMemberModel;
    onMessage?: () => void;
    onWave?: () => void;
    onFollow?: () => void;
  } = $props();
</script>

<article class="community-member-profile">
  <header>
    <span class="community-member-profile__avatar">
      {#if member.avatarUrl}<img src={member.avatarUrl} alt="" />{:else}{member.initials}{/if}
    </span>
    <div>
      <h2>{member.name}</h2>
      <p>@{member.handle}</p>
    </div>
    <Badge variant="outline">{member.presence ?? "offline"}</Badge>
  </header>

  <div class="community-member-profile__actions">
    <Button variant="default" onclick={onMessage}>
      <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />Message
    </Button>
    <Button variant="outline" onclick={onWave}>
      <HandIcon data-icon="inline-start" aria-hidden="true" />Wave
    </Button>
    <Button variant="outline" onclick={onFollow}>
      <UserPlusIcon data-icon="inline-start" aria-hidden="true" />Follow
    </Button>
  </div>

  <section>
    <h3>About</h3>
    <p>{member.role ? `${member.role} in this community` : "Community member"}</p>
  </section>
</article>

<style>
  .community-member-profile {
    display: grid;
    gap: 1.5rem;
    padding: 1.25rem;
  }

  header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.875rem;
  }

  .community-member-profile__avatar {
    display: grid;
    width: 4rem;
    height: 4rem;
    place-items: center;
    overflow: hidden;
    border-radius: 1rem;
    color: var(--primary-foreground);
    background: var(--primary);
    font-weight: 700;
  }

  .community-member-profile__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  header div,
  section {
    display: grid;
    gap: 0.25rem;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 1.1rem;
  }

  h3 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  p {
    color: var(--muted-foreground);
    font-size: 0.85rem;
  }

  .community-member-profile__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .community-member-profile__actions :global(button:first-child) {
    grid-column: 1 / -1;
  }
</style>
