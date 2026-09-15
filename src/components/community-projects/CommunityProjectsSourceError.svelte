<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    message,
    homeChannelId,
    homeChannelName,
    rooms = [],
    onSelectChannel,
  }: {
    message: string;
    homeChannelId?: string | undefined;
    homeChannelName?: string | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    onSelectChannel?: ((roomId: string) => void) | undefined;
  } = $props();

  const room = $derived(
    homeChannelId
      ? rooms.find(
          (candidate) =>
            candidate.groupId === homeChannelId ||
            candidate.id === homeChannelId,
        )
      : undefined,
  );
</script>

<div class="community-projects__source-error" role="alert">
  <p>
    {message === "repository_access_denied"
      ? "Your current identity is not a member of this project's channel."
      : message}
  </p>
  {#if message === "repository_access_denied" && homeChannelId}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onclick={() => onSelectChannel?.(room?.id ?? homeChannelId)}
    >
      Open #{room?.name ?? homeChannelName ?? homeChannelId} to join
    </Button>
  {/if}
</div>
