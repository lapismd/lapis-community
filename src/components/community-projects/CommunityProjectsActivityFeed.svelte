<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import {
    createBrowserProjectActivityFilterStore,
    filterProjectActivity,
    isProjectActivityFilterAll,
    projectActivityDigest,
    projectActivityWeekItems,
    type ProjectActivityFilterId,
    type ProjectActivityFilterPage,
    type ProjectActivityFilterStore,
  } from "../../projects/activity-filters.js";
  import type { ProjectForgeActivityItem } from "../../projects/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import {
    activityCopyableIds,
    activityDetailPresentation,
  } from "./community-projects-activity-detail.js";
  import CommunityProjectsActivityFilter from "./CommunityProjectsActivityFilter.svelte";
  import CommunityProjectsMemberHover from "./CommunityProjectsMemberHover.svelte";
  import CommunityProjectsRevisionGraphIds from "./CommunityProjectsRevisionGraphIds.svelte";
  import { communityProjectsMemberForPubkey } from "./projects-member.js";

  let {
    loading = false,
    activity = [],
    filterPage = "projects",
    filterStore,
    members = [],
    rooms = [],
    communityEmojis = [],
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    canSelectProject = false,
    projectName,
    onOpenProject,
    onOpenItem,
  }: {
    loading?: boolean | undefined;
    activity?: readonly ProjectForgeActivityItem[] | undefined;
    filterPage?: ProjectActivityFilterPage | undefined;
    filterStore?: ProjectActivityFilterStore | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onWaveMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    canSelectProject?: boolean | undefined;
    projectName: (coordinate: string) => string;
    onOpenProject: (coordinate: string) => void;
    onOpenItem: (item: ProjectForgeActivityItem) => void;
  } = $props();

  const activityFilterStore = $derived(
    filterStore ?? createBrowserProjectActivityFilterStore({ page: filterPage }),
  );
  let pageFilters = $state<
    Partial<Record<ProjectActivityFilterPage, ProjectActivityFilterId[]>>
  >({});
  const activityFilter = $derived(
    pageFilters[filterPage] ?? activityFilterStore.load(),
  );
  const visibleActivity = $derived(
    filterProjectActivity(activity, activityFilter),
  );
  const weekActivity = $derived(projectActivityWeekItems(visibleActivity));
  const weekActivityCount = $derived(weekActivity.length);
  const weekActivityDigest = $derived(projectActivityDigest(visibleActivity));

  function selectActivityFilter(value: ProjectActivityFilterId[]): void {
    pageFilters[filterPage] = value;
    activityFilterStore.save(value);
  }
</script>

<div
  class="community-projects__workspace community-projects__workspace--activity"
>
  <header class="community-projects__page-heading">
    <div class="community-projects__page-heading-copy">
      <h1>Projects Activity</h1>
      <p>{weekActivityDigest}</p>
    </div>
    <CommunityProjectsActivityFilter
      value={activityFilter}
      onChange={selectActivityFilter}
    />
  </header>
  <div class="community-projects__section-divider">
    <span>{loading || weekActivityCount > 0 ? "This week" : "Earlier"}</span>
  </div>
  <div class="community-projects__activity">
    {#if loading && activity.length === 0}
      <div
        class="community-projects__activity-loading"
        role="status"
        aria-label="Loading project activity"
      >
        {#each [0, 1, 2, 3] as row (row)}
          <div
            class="community-projects__activity-item community-projects__activity-item--skeleton"
            aria-hidden="true"
          >
            <Skeleton class="community-projects__activity-skeleton-avatar" />
            <span class="community-projects__activity-line"></span>
            <div class="community-projects__activity-copy">
              <div>
                <Skeleton class="community-projects__activity-skeleton-actor" />
                <Skeleton
                  class="community-projects__activity-skeleton-action"
                />
              </div>
              <Skeleton class="community-projects__activity-skeleton-time" />
              <div class="community-projects__activity-skeleton-card">
                <Skeleton class="community-projects__activity-skeleton-title" />
                <Skeleton class="community-projects__activity-skeleton-body" />
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      {#each visibleActivity as item (item.id)}
        {@const actor = communityProjectsMemberForPubkey(
          members,
          item.actorPubkey || "relay",
        )}
        {@const detail = activityDetailPresentation(item)}
        {@const copyable = activityCopyableIds(item)}
        <article class="community-projects__activity-item">
          <CommunityProjectsMemberHover
            member={actor}
            avatarSize="medium"
            {onOpenProfile}
            {onMessageMember}
            {onWaveMember}
          />
          <span class="community-projects__activity-line" aria-hidden="true"
          ></span>
          <div class="community-projects__activity-copy">
            <div class="community-projects__activity-meta">
              <div class="community-projects__activity-byline">
                <div>
                  <strong>{actor.name}</strong>
                  <span>{item.action}</span>
                  <button
                    type="button"
                    class="community-projects__activity-project-link"
                    disabled={!canSelectProject}
                    onclick={() => onOpenProject(item.projectCoordinate)}
                  >
                    {projectName(item.projectCoordinate)}
                  </button>
                </div>
                <CommunityRelativeTime timestamp={item.createdAt} />
              </div>
              {#if detail.kind === "hash"}
                <CommunityProjectsRevisionGraphIds
                  commitId={detail.value}
                  commitLabel={detail.copyLabel}
                  placement="inline"
                />
              {:else if detail.kind === "chip" && detail.icon === "sync"}
                <CommunityChip
                  class="community-projects__activity-status"
                  size="compact"
                  variant={detail.variant}
                  tone={detail.tone}
                  shape={detail.shape}
                >
                  {#snippet leading()}<RefreshCwIcon
                      aria-hidden="true"
                    />{/snippet}
                  {detail.label}
                </CommunityChip>
              {:else if detail.kind === "chip"}
                <CommunityChip
                  class="community-projects__activity-status"
                  size="compact"
                  variant={detail.variant}
                  tone={detail.tone}
                  shape={detail.shape}
                >
                  {detail.label}
                </CommunityChip>
              {/if}
            </div>
            {#snippet card()}
              <span
                class="community-projects__activity-title"
                class:community-projects__activity-title--with-ids={Boolean(
                  copyable.title,
                )}
                data-activity-kind={item.kind}
              >
                {#if item.kind === "approval"}
                  <CheckIcon aria-hidden="true" />
                {:else if item.kind === "changes-requested"}
                  <TriangleAlertIcon aria-hidden="true" />
                {:else if item.kind === "review-request"}
                  <UserPlusIcon aria-hidden="true" />
                {:else if item.kind === "review"}
                  <GitPullRequestIcon aria-hidden="true" />
                {:else if item.kind === "commit" || item.kind === "review-update"}
                  <GitCommitHorizontalIcon aria-hidden="true" />
                {:else if item.kind === "repository"}
                  <FolderGit2Icon aria-hidden="true" />
                {:else if item.kind === "project"}
                  <FolderKanbanIcon aria-hidden="true" />
                {:else if item.kind === "task"}
                  <CircleDotIcon aria-hidden="true" />
                {:else if item.kind === "assignment" && item.detail === "unassign"}
                  <UserMinusIcon aria-hidden="true" />
                {:else if item.kind === "assignment"}
                  <UserPlusIcon aria-hidden="true" />
                {:else if item.kind === "comment"}
                  <MessageSquareIcon aria-hidden="true" />
                {:else}
                  <CodeXmlIcon aria-hidden="true" />
                {/if}
                {#if copyable.title}
                  <span class="community-projects__activity-copy-ids">
                    <CommunityProjectsRevisionGraphIds
                      commitId={copyable.title.value}
                      commitLabel={copyable.title.copyLabel}
                      placement="inline"
                    />
                    {#if copyable.body}
                      <CommunityProjectsRevisionGraphIds
                        commitId={copyable.body.value}
                        commitLabel={copyable.body.copyLabel}
                        placement="inline"
                      />
                    {/if}
                  </span>
                {:else}
                  <strong>{item.title}</strong>
                {/if}
              </span>
              {#if !copyable.title && item.body}
                <CommunityMarkdownContent
                  class="community-projects__activity-body"
                  content={item.body}
                  {members}
                  {rooms}
                  {communityEmojis}
                />
              {/if}
            {/snippet}
            {#if copyable.title}
              <div class="community-projects__activity-card">
                {@render card()}
              </div>
            {:else}
              <button
                type="button"
                class="community-projects__activity-card"
                onclick={() => onOpenItem(item)}
              >
                {@render card()}
              </button>
            {/if}
          </div>
        </article>
      {:else}
        <p class="community-projects__status">
          {isProjectActivityFilterAll(activityFilter)
            ? "No project activity yet."
            : "No matching activity."}
        </p>
      {/each}
    {/if}
  </div>
</div>
