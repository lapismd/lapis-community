<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityProjectsMemberHover from "./CommunityProjectsMemberHover.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type { ProjectForgeRepository } from "../../projects/index.js";
  import CommunityProjectsRepositorySections from "./CommunityProjectsRepositorySections.svelte";

  let {
    members = [],
    groups = [],
    listLayout = "list",
    empty = "The project channel roster is unavailable.",
    onOpenProfile,
    onMessageMember,
    onWaveMember,
  }: {
    members?: readonly CommunityMemberModel[] | undefined;
    groups?: readonly {
      repository: ProjectForgeRepository;
      items: CommunityMemberModel[];
    }[];
    listLayout?: string | undefined;
    empty?: string | undefined;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?: ((member: CommunityMemberModel) => void) | undefined;
    onWaveMember?: ((member: CommunityMemberModel) => void) | undefined;
  } = $props();
</script>

{#snippet personRow(member: CommunityMemberModel)}
  <article data-interactive={onOpenProfile === undefined ? undefined : "true"}>
    {#if onOpenProfile}
      <button
        type="button"
        class="community-projects__person-target"
        aria-label={`Open ${member.name}'s profile`}
        onclick={() => onOpenProfile?.(member)}
      ></button>
    {/if}
    <span class="community-projects__person-avatar">
      <CommunityProjectsMemberHover
        {member}
        avatarSize="medium"
        {onOpenProfile}
        {onMessageMember}
        {onWaveMember}
      />
    </span>
    <div class="community-projects__person-copy">
      <strong>{member.name}</strong><span>{member.handle}</span>
    </div>
    {#if member.role}
      <CommunityChip
        class="community-projects__person-role"
        size="compact"
        tone="accent">{member.role}</CommunityChip
      >
    {/if}
  </article>
{/snippet}

{#if groups.length > 0}
  <CommunityProjectsRepositorySections
    sections={groups.map((group) => ({
      repository: group.repository,
      count: group.items.length,
    }))}
    {empty}
  >
    {#snippet children(repository)}
      <div class="community-projects__people" data-layout={listLayout}>
        {#each groups.find((group) => group.repository.address.coordinate === repository.address.coordinate)?.items ?? [] as member (member.id)}
          {@render personRow(member)}
        {/each}
      </div>
    {/snippet}
  </CommunityProjectsRepositorySections>
{:else}
  <div class="community-projects__people" data-layout={listLayout}>
    {#each members as member (member.id)}
      {@render personRow(member)}
    {:else}
      <p class="community-projects__status">{empty}</p>
    {/each}
  </div>
{/if}
