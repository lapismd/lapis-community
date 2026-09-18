<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import FileIcon from "@lucide/svelte/icons/file";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type { ProjectForgeProtectionDocumentInput } from "../../projects/protection-document.js";
  import type {
    ProjectForgeRepositoryCapabilities,
    ProjectForgeTreeResponse,
  } from "../../projects/model.js";
  import type { OwnersDocument } from "../../projects/owners.js";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsRepositorySettings from "./CommunityProjectsRepositorySettings.svelte";

  let {
    surface = "overview", tree,
    loading = false,
    canCollaborate = false,
    hasSources = false,
    sourceError = "",
    capabilities,
    owners,
    members = [],
    rooms = [],
    communityEmojis = [],
    homeChannelId,
    canMaintain = false,
    onSelectChannel,
    onSaveProtection,
    sourceErrorSnippet,
  }: {
    surface?: "overview" | "options" | undefined; tree?: ProjectForgeTreeResponse | undefined;
    loading?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    hasSources?: boolean | undefined;
    sourceError?: string | undefined;
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
    owners?: OwnersDocument | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    homeChannelId?: string | undefined;
    canMaintain?: boolean | undefined;
    onSelectChannel?: ((roomId: string) => void) | undefined;
    onSaveProtection?:
      | ((input: ProjectForgeProtectionDocumentInput) => Promise<void>)
      | undefined;
    sourceErrorSnippet?: import("svelte").Snippet | undefined;
  } = $props();

  const peopleChannel = $derived.by(() => {
    const room = rooms.find((c) => c.groupId === homeChannelId || c.id === homeChannelId);
    return homeChannelId
      ? { name: room?.name ?? homeChannelId, roomId: room?.id ?? homeChannelId }
      : undefined;
  });
</script>

<article class="community-projects__workspace" class:community-projects__readme={surface !== "options"}>
  {#if surface === "options"}
    <CommunityProjectsRepositorySettings
      {capabilities}
      {owners}
      peopleChannelName={peopleChannel?.name}
      {canMaintain}
      onOpenPeople={peopleChannel && onSelectChannel
        ? () => onSelectChannel(peopleChannel.roomId)
        : undefined}
      {onSaveProtection}
    />
  {:else if tree?.readme}
    <CommunityMarkdownContent
      fullWidth
      content={tree.readme}
      {members}
      {rooms}
      {communityEmojis}
    />
  {:else if loading}
    <div
      class="community-projects__overview-skeleton"
      role="status"
      aria-label="Loading repository overview"
    >
      <div aria-hidden="true">
        <Skeleton class="community-projects__overview-skeleton-title" />
        <div class="community-projects__overview-skeleton-paragraph">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    </div>
  {:else if !canCollaborate && hasSources}
    <Empty.Root class="community-projects__empty">
      <Empty.Header>
        <Empty.Media variant="icon"><FileIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title>Sign in to view repository files</Empty.Title>
        <Empty.Description>
          Repository source reads use your Nostr identity to enforce the
          project's channel access at the relay gateway.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else if sourceError}
    {@render sourceErrorSnippet?.()}
  {:else}
    <Empty.Root class="community-projects__empty">
      <Empty.Header>
        <Empty.Media variant="icon"><FileIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title>No repository overview yet</Empty.Title>
        <Empty.Description>
          Add a README to a repository with relay-advertised browsing to show it
          here. Community does not assume local Git access.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</article>
