<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityComposerRoomIcon from "../community-composer-room-icon/CommunityComposerRoomIcon.svelte";
  import { useCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
  import "../community-entity-chip/community-entity-link.css";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityComposerRemovableChip from "./CommunityComposerRemovableChip.svelte";

  let {
    room,
    onRemove,
  }: {
    room: CommunityRoomModel;
    onRemove: () => void;
  } = $props();

  const navigation = useCommunityEntityNavigation();
  const text = $derived(`#${room.name.trim()}`);
</script>

<CommunityComposerRemovableChip label={text} {onRemove}
  ><CommunityChip
    class="community-entity-link community-composer-token-action"
    variant="muted"
    size="inline"
    title={text}
    ariaLabel={text}
    buttonProps={{ "data-link-kind": room.kind }}
    onclick={() => navigation?.open({ kind: "channel", roomId: room.id })}
  >
    {#snippet leading()}
      <CommunityComposerRoomIcon {room} />
    {/snippet}<span class="community-entity-label">{text}</span></CommunityChip
  ></CommunityComposerRemovableChip
>
