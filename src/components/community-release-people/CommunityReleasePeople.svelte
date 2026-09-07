<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
  import PackageIcon from "@lucide/svelte/icons/package";
  import UsersIcon from "@lucide/svelte/icons/users";

  import type { RegistryReleaseReviewEntry } from "../../registry/index.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import { communityReleaseMemberActivity } from "./model.js";

  let {
    members,
    entries = [],
    activityLoading = false,
    activityUnavailable = false,
    completeness = "unavailable",
    onOpenProfile,
  }: {
    members: readonly CommunityMemberModel[];
    entries?: readonly RegistryReleaseReviewEntry[];
    activityLoading?: boolean;
    activityUnavailable?: boolean;
    completeness?: "complete" | "partial" | "unavailable";
    onOpenProfile?: (member: CommunityMemberModel) => void;
  } = $props();

  const sortedMembers = $derived(
    members.toSorted(
      (left, right) =>
        left.name.localeCompare(right.name, undefined, {
          sensitivity: "base",
        }) || left.id.localeCompare(right.id),
    ),
  );
  const activity = $derived(communityReleaseMemberActivity(entries));
  const incomplete = $derived(completeness !== "complete");

  function activityLabel(value: number): string {
    return activityLoading || activityUnavailable ? "—" : String(value);
  }
</script>

<div
  class="community-release-people"
  data-ui-component="community-release-people"
>
  {#if incomplete}
    <p class="community-release-people__notice" role="status">
      {completeness === "partial"
        ? "Member history is still syncing. This list may grow."
        : "The relay has not provided a complete member list."}
    </p>
  {/if}

  {#if sortedMembers.length === 0}
    <Empty.Root class="community-release-people__empty" role="status">
      <Empty.Header>
        <Empty.Media variant="icon"
          ><UsersIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title>No people to show</Empty.Title>
        <Empty.Description>
          Members appear after the plugin-releases roster is available.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="community-release-people__table" role="list">
      {#each sortedMembers as member (member.id)}
        {@const counts = activity.get(member.id) ?? {
          releaseCount: 0,
          curatorDecisionCount: 0,
        }}
        <div class="community-release-people__row" role="listitem">
          <button
            type="button"
            class="community-release-people__identity"
            aria-label={`Open ${member.name}'s profile`}
            disabled={onOpenProfile === undefined}
            onclick={() => onOpenProfile?.(member)}
          >
            <CommunityMemberAvatar {member} size="small" decorative />
            <span>
              <strong>{member.name}</strong>
              <small>
                {member.role ?? member.handle}
                {#if member.role && member.handle}
                  · {member.handle}{/if}
              </small>
            </span>
          </button>
          <div class="community-release-people__metrics">
            <span
              aria-label={`${member.name} authored ${activityLabel(counts.releaseCount)} releases`}
              title="Release posts"
            >
              <PackageIcon aria-hidden="true" />
              {activityLabel(counts.releaseCount)}
            </span>
            <span
              aria-label={`${member.name} signed ${activityLabel(counts.curatorDecisionCount)} curator decisions`}
              title="Curator decisions"
            >
              <ClipboardCheckIcon aria-hidden="true" />
              {activityLabel(counts.curatorDecisionCount)}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .community-release-people {
    display: grid;
    min-height: 100%;
    align-content: start;
    gap: 0.75rem;
    padding: 0.25rem 0.25rem 2rem;
  }

  .community-release-people__notice {
    margin: 0;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md, 0.5rem);
    background: var(--muted);
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }

  :global(.community-release-people__empty) {
    align-self: center;
    min-height: 22rem;
  }

  .community-release-people__table {
    display: grid;
  }

  .community-release-people__row {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 0.5rem;
    border-block-end: 1px solid var(--border);
  }

  .community-release-people__identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
  }

  .community-release-people__identity:not(:disabled) {
    cursor: pointer;
  }

  .community-release-people__identity:not(:disabled):hover strong,
  .community-release-people__identity:not(:disabled):focus-visible strong {
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .community-release-people__identity:focus-visible {
    border-radius: var(--radius-sm, 0.375rem);
    outline: 2px solid var(--ring);
    outline-offset: 0.2rem;
  }

  .community-release-people__identity > span {
    display: grid;
    min-width: 0;
    gap: 0.1rem;
  }

  .community-release-people__identity strong,
  .community-release-people__identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-release-people__identity strong {
    font-size: 0.875rem;
  }

  .community-release-people__identity small {
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .community-release-people__metrics,
  .community-release-people__metrics span {
    display: flex;
    align-items: center;
  }

  .community-release-people__metrics {
    gap: 1rem;
  }

  .community-release-people__metrics span {
    min-width: 3.25rem;
    justify-content: flex-start;
    gap: 0.375rem;
    color: var(--muted-foreground);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .community-release-people__metrics :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  @media (max-width: 40rem) {
    .community-release-people__row {
      align-items: start;
    }

    .community-release-people__metrics {
      gap: 0.5rem;
    }

    .community-release-people__metrics span {
      min-width: 2.25rem;
    }
  }
</style>
