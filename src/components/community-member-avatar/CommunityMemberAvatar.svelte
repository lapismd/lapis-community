<script lang="ts">
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    size = "medium",
    showPresence = false,
    decorative = false,
  }: {
    member: CommunityMemberModel;
    size?: "xsmall" | "small" | "medium" | "large";
    showPresence?: boolean;
    decorative?: boolean;
  } = $props();

  const presence = $derived(member.presence ?? "offline");
  const presenceLabel = $derived(
    presence === "online" ? "Online" : presence === "away" ? "Away" : "Offline",
  );
  const accessibleLabel = $derived(
    decorative
      ? undefined
      : showPresence
        ? `${member.name}, ${presenceLabel}`
        : `${member.name} avatar`,
  );
</script>

<span
  class="community-member-avatar"
  data-ui-component="community-member-avatar"
  data-size={size}
  aria-hidden={decorative ? "true" : undefined}
  aria-label={accessibleLabel}
  role={decorative ? undefined : "img"}
>
  <span class="community-member-avatar__image" data-ui-part="image">
    {#if member.avatarUrl}
      <img src={member.avatarUrl} alt="" />
    {:else}
      <span aria-hidden="true">{member.initials}</span>
    {/if}
  </span>
  {#if showPresence}
    <span
      class="community-member-avatar__presence"
      data-ui-part="presence"
      data-presence={presence}
      aria-hidden="true"
    ></span>
  {/if}
</span>

<style>
  .community-member-avatar {
    --community-member-avatar-size: 2.25rem;
    --community-member-avatar-presence-size: 0.625rem;

    position: relative;
    display: block;
    width: var(--community-member-avatar-size);
    height: var(--community-member-avatar-size);
    flex: none;
  }

  .community-member-avatar[data-size="small"] {
    --community-member-avatar-size: 2rem;
    --community-member-avatar-presence-size: 0.55rem;
  }

  .community-member-avatar[data-size="xsmall"] {
    --community-member-avatar-size: 1.5rem;
    --community-member-avatar-presence-size: 0.45rem;
  }

  .community-member-avatar[data-size="large"] {
    --community-member-avatar-size: 4rem;
    --community-member-avatar-presence-size: 0.85rem;
  }

  .community-member-avatar__image {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    overflow: hidden;
    border-radius: 50%;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: calc(var(--community-member-avatar-size) * 0.3);
    font-weight: 700;
  }

  .community-member-avatar__image img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
  }

  .community-member-avatar__presence {
    position: absolute;
    right: -0.08rem;
    bottom: -0.08rem;
    width: var(--community-member-avatar-presence-size);
    height: var(--community-member-avatar-presence-size);
    border: 2px solid
      var(--community-member-avatar-presence-ring, var(--background));
    border-radius: 50%;
    background: var(--muted-foreground);
  }

  .community-member-avatar__presence[data-presence="online"] {
    background: var(--success, #08b94e);
  }

  .community-member-avatar__presence[data-presence="away"] {
    background: var(--warning, #d99a00);
  }
</style>
