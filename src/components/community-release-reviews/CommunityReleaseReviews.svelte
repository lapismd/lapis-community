<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import CircleSlashIcon from "@lucide/svelte/icons/circle-slash";
  import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
  import Clock3Icon from "@lucide/svelte/icons/clock-3";

  import type {
    RegistryCatalogDataSource,
    RegistryReleaseReviewEntry,
  } from "../../registry/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { communityChipToneForState } from "../community-chip/model.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import RegistryReleaseDisclosure from "../registry-release-disclosure/RegistryReleaseDisclosure.svelte";
  import { groupCommunityReleaseReviews } from "./model.js";

  let {
    entries = [],
    source,
    loading = false,
    error = "",
    members = [],
    onOpenPlugin,
  }: {
    entries?: readonly RegistryReleaseReviewEntry[];
    source: RegistryCatalogDataSource;
    loading?: boolean;
    error?: string;
    members?: readonly CommunityMemberModel[];
    onOpenPlugin?: (pluginId: string) => void;
  } = $props();

  type ReviewSectionId = "pending" | "reviewed" | "blocked";

  const groups = $derived(groupCommunityReleaseReviews(entries));
  const sections = $derived([
    {
      id: "pending" as const,
      label: "Pending review",
      entries: groups.pending,
      icon: Clock3Icon,
    },
    {
      id: "reviewed" as const,
      label: "Reviewed",
      entries: groups.reviewed,
      icon: ClipboardCheckIcon,
    },
    {
      id: "blocked" as const,
      label: "Blocked",
      entries: groups.blocked,
      icon: CircleSlashIcon,
    },
  ]);
  let activeSections = $state<ReviewSectionId[]>([
    "pending",
    "reviewed",
    "blocked",
  ]);
  const selectedSections = $derived(
    sections.filter((section) => activeSections.includes(section.id)),
  );
  const memberById = $derived(
    new Map(members.map((member) => [member.id, member] as const)),
  );

  function stateLabel(entry: RegistryReleaseReviewEntry): string {
    const state = entry.inspection.state;
    return state[0]!.toLocaleUpperCase() + state.slice(1);
  }

  function releaseLabel(entry: RegistryReleaseReviewEntry): string {
    return (
      entry.inspection.preview?.entry.name ??
      entry.inspection.pluginId ??
      "Plugin release"
    );
  }

  function shortKey(pubkey: string): string {
    return pubkey.length > 16
      ? `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`
      : pubkey;
  }

  function releaseAuthor(
    entry: RegistryReleaseReviewEntry,
  ): CommunityMemberModel {
    const pubkey = entry.releaseEvent.pubkey;
    return (
      memberById.get(pubkey) ?? {
        id: pubkey,
        name: shortKey(pubkey),
        handle: shortKey(pubkey),
        initials: pubkey.slice(0, 2).toLocaleUpperCase(),
      }
    );
  }
</script>

<div
  class="community-release-reviews"
  data-ui-component="community-release-reviews"
  aria-busy={loading}
>
  {#if error}
    <p class="community-release-reviews__notice" role="alert">{error}</p>
  {/if}

  {#if loading && entries.length === 0}
    <div class="community-release-reviews__loading" role="status">
      <span class="sr-only">Loading plugin release reviews</span>
      {#each Array(3) as _}
        <div class="community-release-reviews__skeleton">
          <Skeleton class="community-release-reviews__skeleton-title" />
          <Skeleton class="community-release-reviews__skeleton-line" />
        </div>
      {/each}
    </div>
  {:else if entries.length === 0}
    <Empty.Root class="community-release-reviews__empty" role="status">
      <Empty.Header>
        <Empty.Media variant="icon">
          {#if source.loadReleaseReviewEntries === undefined}
            <CircleSlashIcon aria-hidden="true" />
          {:else}
            <ClipboardCheckIcon aria-hidden="true" />
          {/if}
        </Empty.Media>
        <Empty.Title>
          {source.loadReleaseReviewEntries === undefined
            ? "Reviews unavailable"
            : "No plugin releases yet"}
        </Empty.Title>
        <Empty.Description>
          {source.loadReleaseReviewEntries === undefined
            ? "This registry source does not expose its signed review ledger."
            : "Posted plugin releases will appear here for review."}
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <ToggleGroup.Root
      type="multiple"
      bind:value={activeSections}
      variant="outline"
      size="sm"
      spacing={0}
      class="community-release-reviews__filters"
      aria-label="Review status"
    >
      {#each sections as section (section.id)}
        {@const SectionIcon = section.icon}
        <ToggleGroup.Item
          value={section.id}
          disabled={section.entries.length === 0}
        >
          <SectionIcon data-icon="inline-start" aria-hidden="true" />
          <span>{section.label}</span>
          <CommunityChip variant="muted" size="indicator">
            {section.entries.length}
          </CommunityChip>
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>

    {#each selectedSections as section (section.id)}
      <section
        class="community-release-reviews__section"
        aria-labelledby={`community-release-reviews-${section.id}`}
      >
        <h2 class="sr-only" id={`community-release-reviews-${section.id}`}>
          {section.label}
        </h2>
        <div class="community-release-reviews__list">
          {#each section.entries as entry (entry.releaseEvent.id)}
            {@const author = releaseAuthor(entry)}
            <article
              class="community-release-reviews__entry"
              aria-label={`${releaseLabel(entry)} ${stateLabel(entry)}`}
            >
              <div class="community-release-reviews__meta">
                <div class="community-release-reviews__title">
                  <CommunityMemberAvatar
                    member={author}
                    size="xsmall"
                    decorative
                  />
                  <div class="community-release-reviews__title-copy">
                    <strong>{releaseLabel(entry)}</strong>
                    {#if entry.inspection.version}
                      <span class="community-release-reviews__version"
                        >{entry.inspection.version}</span
                      >
                    {/if}
                  </div>
                </div>
                <CommunityChip
                  tone={communityChipToneForState(entry.inspection.state)}
                >
                  {stateLabel(entry)}
                </CommunityChip>
              </div>
              <p class="community-release-reviews__byline">
                Posted by {author.name} ·
                <CommunityRelativeTime
                  timestamp={entry.releaseEvent.created_at}
                />
              </p>
              <RegistryReleaseDisclosure
                eventId={entry.releaseEvent.id}
                {source}
                {...onOpenPlugin === undefined ? {} : { onOpenPlugin }}
              />
            </article>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .community-release-reviews {
    display: grid;
    min-height: 100%;
    align-content: start;
    gap: 1.5rem;
    padding: 0.25rem 0.25rem 2rem;
  }

  .community-release-reviews__notice {
    margin: 0;
    padding: 0.75rem 1rem;
    border: 1px solid color-mix(in oklab, var(--destructive) 30%, transparent);
    border-radius: var(--radius-md, 0.5rem);
    background: color-mix(in oklab, var(--destructive) 8%, transparent);
    color: var(--destructive);
    font-size: 0.875rem;
  }

  .community-release-reviews__loading,
  .community-release-reviews__list {
    display: grid;
    gap: 0.75rem;
  }

  .community-release-reviews__skeleton {
    display: grid;
    gap: 0.625rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, 0.75rem);
  }

  :global(.community-release-reviews__skeleton-title) {
    width: 12rem;
    max-width: 60%;
    height: 1rem;
  }

  :global(.community-release-reviews__skeleton-line) {
    width: 100%;
    height: 3.5rem;
  }

  :global(.community-release-reviews__empty) {
    align-self: center;
    min-height: 22rem;
  }

  .community-release-reviews__section {
    display: grid;
    gap: 0.75rem;
  }

  .community-release-reviews__meta,
  .community-release-reviews__title,
  .community-release-reviews__title-copy {
    display: flex;
    min-width: 0;
    align-items: center;
  }

  :global(.community-release-reviews__filters) {
    width: fit-content;
    max-width: 100%;
  }

  :global(.community-release-reviews__filters [data-ui-part="community-chip"]) {
    margin-inline-start: 0.15rem;
  }

  .community-release-reviews__entry {
    display: grid;
    gap: 0.625rem;
    padding: 0.875rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--background);
    transition: background-color 120ms ease;
  }

  .community-release-reviews__entry:hover,
  .community-release-reviews__entry:focus-within {
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
  }

  .community-release-reviews__entry:hover
    :global(.registry-release-disclosure__trigger),
  .community-release-reviews__entry:focus-within
    :global(.registry-release-disclosure__trigger) {
    background: var(--background);
  }

  .community-release-reviews__meta {
    justify-content: space-between;
    gap: 0.75rem;
  }

  .community-release-reviews__title {
    overflow: hidden;
    gap: 0.625rem;
  }

  .community-release-reviews__title-copy {
    overflow: hidden;
    gap: 0.45rem;
  }

  .community-release-reviews__meta strong,
  .community-release-reviews__version {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-release-reviews__version,
  .community-release-reviews__byline {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .community-release-reviews__byline {
    margin: 0;
  }
</style>
