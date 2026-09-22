<script lang="ts">
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";

  import type { CommunityEntityLinkIcon } from "../../community/community-links.js";

  let { icon }: { icon: CommunityEntityLinkIcon } = $props();
</script>

{#if icon === "message-circle"}
  <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
{:else if icon === "hash"}
  <HashIcon data-icon="inline-start" aria-hidden="true" />
{:else if icon === "folder-kanban"}
  <FolderKanbanIcon data-icon="inline-start" aria-hidden="true" />
{:else if icon === "folder-git-2"}
  <FolderGit2Icon data-icon="inline-start" aria-hidden="true" />
{:else if icon === "history"}
  <HistoryIcon data-icon="inline-start" aria-hidden="true" />
{:else if icon === "circle-dot"}
  <CircleDotIcon data-icon="inline-start" aria-hidden="true" />
{:else}
  <GitCommitHorizontalIcon data-icon="inline-start" aria-hidden="true" />
{/if}
