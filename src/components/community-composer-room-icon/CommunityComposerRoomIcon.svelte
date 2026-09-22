<script lang="ts">
  import HashIcon from "@lucide/svelte/icons/hash";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";

  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    room,
  }: {
    room: Pick<CommunityRoomModel, "kind" | "isProjectChannel">;
  } = $props();
</script>

{#if room.kind === "forum"}
  <MessagesSquareIcon
    data-icon="inline-start"
    data-ui-part="composer-room-icon"
    data-room-kind="forum"
    aria-hidden="true"
  />
{:else if room.kind === "channel" && room.isProjectChannel}
  <CommunityProjectChannelIcon data-room-kind="project-channel" />
{:else}
  <HashIcon
    data-icon="inline-start"
    data-ui-part="composer-room-icon"
    data-room-kind="channel"
    aria-hidden="true"
  />
{/if}
