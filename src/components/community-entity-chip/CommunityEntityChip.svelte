<script lang="ts">
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";

  import { communityEntityLinkPresentation } from "../../community/community-link-normalize.js";
  import type { CommunityEntityLink } from "../../community/community-links.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { useCommunityEntityNavigation } from "./navigation.js";

  let {
    link,
    label,
  }: {
    link: CommunityEntityLink;
    label?: string;
  } = $props();

  const navigation = useCommunityEntityNavigation();
  const presentation = $derived(communityEntityLinkPresentation(link));
  const text = $derived(
    label?.trim() || navigation?.label(link) || presentation.fallbackLabel,
  );
</script>

<CommunityChip
  variant="muted"
  size="inline"
  ariaLabel={text}
  buttonProps={{ "data-link-kind": presentation.linkKind }}
  onclick={() => navigation?.open(link)}
>
  {#snippet leading()}
    {#if presentation.icon === "message-circle"}
      <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
    {:else if presentation.icon === "hash"}
      <HashIcon data-icon="inline-start" aria-hidden="true" />
    {:else if presentation.icon === "folder-kanban"}
      <FolderKanbanIcon data-icon="inline-start" aria-hidden="true" />
    {:else if presentation.icon === "folder-git-2"}
      <FolderGit2Icon data-icon="inline-start" aria-hidden="true" />
    {:else if presentation.icon === "history"}
      <HistoryIcon data-icon="inline-start" aria-hidden="true" />
    {:else}
      <GitCommitHorizontalIcon data-icon="inline-start" aria-hidden="true" />
    {/if}
  {/snippet}
  {text}
</CommunityChip>
