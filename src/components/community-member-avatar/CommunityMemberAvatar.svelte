<script lang="ts">
  import { communityMemberAvatarContent } from "../../community/avatar-content.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import {
    communityMemberAvatarFallbackTone,
    communityMemberAvatarShape,
  } from "./model.js";
  import { useCommunityMemberPresence } from "../community-member-hover-card/presence-context.js";
  import "./community-member-avatar.css";

  let {
    member,
    size = "medium",
    showPresence = false,
    decorative = false,
    presence: presenceOverride,
    shape,
  }: {
    member: CommunityMemberModel;
    size?: "inline" | "xsmall" | "small" | "medium" | "large" | "xlarge";
    shape?: "circle" | "rounded";
    showPresence?: boolean;
    decorative?: boolean;
    presence?: CommunityMemberModel["presence"] | "unknown";
  } = $props();

  const resolvedShape = $derived(shape ?? communityMemberAvatarShape(member));
  const resolvePresence = useCommunityMemberPresence();
  const presence = $derived(
    presenceOverride ??
      resolvePresence?.(member) ??
      member.presence ??
      "offline",
  );
  const content = $derived(communityMemberAvatarContent(member));
  const fallbackTone = $derived(communityMemberAvatarFallbackTone(member.name));
  const presenceLabel = $derived(
    presence === "online"
      ? "Online"
      : presence === "away"
        ? "Away"
        : presence === "unknown"
          ? "Presence unknown"
          : "Offline",
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
  data-shape={resolvedShape}
  aria-hidden={decorative ? "true" : undefined}
  aria-label={accessibleLabel}
  role={decorative ? undefined : "img"}
>
  <span
    class="community-member-avatar__image"
    data-ui-part="image"
    data-content={content.kind}
    data-fallback-tone={content.kind === "initials" ? fallbackTone : undefined}
  >
    {#if content.kind === "image"}
      <img src={content.src} alt="" />
    {:else if content.kind === "emoji"}
      <span data-ui-part="emoji" aria-hidden="true">{content.emoji}</span>
    {:else}
      <span aria-hidden="true">{content.initials}</span>
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
