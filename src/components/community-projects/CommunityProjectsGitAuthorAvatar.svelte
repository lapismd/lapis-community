<script lang="ts">
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";

  import { initials } from "../../community/materialize-shared.js";
  import { repositoryLogGravatarUrl } from "../../projects/repository-log-author.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    email = "",
    name = "",
    size = "small",
  }: {
    email?: string | undefined;
    name?: string | undefined;
    size?: "xsmall" | "small";
  } = $props();

  const trimmedEmail = $derived(email.trim());
  const member = $derived(gitAuthorMember(name, trimmedEmail));

  function gitAuthorMember(
    displayName: string,
    authorEmail: string,
  ): CommunityMemberModel {
    const label = displayName.trim() || authorEmail || "Author";
    const avatarUrl = repositoryLogGravatarUrl(authorEmail);
    return {
      id: authorEmail || label,
      name: label,
      handle: authorEmail || label,
      initials: initials(label),
      ...(avatarUrl ? { avatarUrl } : {}),
    };
  }
</script>

{#if trimmedEmail}
  <Tooltip.Provider delayDuration={0}>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <span
            {...props}
            class="community-projects-git-author-avatar"
            data-ui-part="git-author"
            role="img"
            aria-label={trimmedEmail}
          >
            <CommunityMemberAvatar {member} {size} decorative />
          </span>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>{trimmedEmail}</Tooltip.Content
      >
    </Tooltip.Root>
  </Tooltip.Provider>
{:else}
  <span class="community-projects-git-author-avatar" data-ui-part="git-author">
    <CommunityMemberAvatar {member} {size} decorative />
  </span>
{/if}

<style>
  .community-projects-git-author-avatar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
  }
</style>
