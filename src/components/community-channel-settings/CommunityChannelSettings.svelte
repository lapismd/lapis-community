<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShell } from "@lapismd/design-core/shell";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import "./CommunityChannelSettings.css";

  let {
    room,
    members,
    description,
    canArchive = false,
    onClose = () => {},
    onAction = () => {},
  }: {
    room: CommunityRoomModel;
    members: CommunityMemberModel[];
    description: string;
    canArchive?: boolean;
    onClose?: () => void;
    onAction?: (action: string) => void;
  } = $props();

  const roomType = $derived(room.kind === "forum" ? "Forum" : "Channel");
  const canUpdate = $derived(
    room.permissions?.update.state === undefined ||
      room.permissions.update.state === "enabled",
  );
  const canLeave = $derived(
    room.permissions?.leave.state === undefined ||
      room.permissions.leave.state === "enabled",
  );
  const canDelete = $derived(
    room.permissions?.delete.state === undefined ||
      room.permissions.delete.state === "enabled",
  );
</script>

<AppShell.Sidebar.Header class="lc-channel-settings__header">
  <strong>{roomType} settings</strong>
  <AppShell.Sidebar.Close
    label={`Close ${roomType.toLowerCase()} settings`}
    onclick={onClose}
  />
</AppShell.Sidebar.Header>

<AppShell.Sidebar.Body>
  <div class="lc-channel-settings">
    <div class="lc-channel-settings__identity">
      <span class="lc-channel-settings__image" aria-hidden="true">
        {#if room.kind === "forum"}
          <MessagesSquareIcon />
        {:else}
          <HashIcon />
        {/if}
      </span>
      <strong>{room.name}</strong>
      <p>{description}</p>
    </div>

    <section class="lc-channel-settings__details">
      <h2>Details</h2>
      <div class="lc-channel-settings__details-card">
        {#if canUpdate}
          <Button
            variant="ghost"
            class="lc-channel-settings__row"
            onclick={() => onAction("edit-type")}
          >
            <span>
              <strong>{roomType} type</strong>
              <small
                >{room.kind === "channel"
                  ? "Ongoing"
                  : "Posts and replies"}</small
              >
            </span>
            <PencilIcon
              class="lc-channel-settings__edit-icon"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="ghost"
            class="lc-channel-settings__row"
            onclick={() => onAction("edit-visibility")}
          >
            <span>
              <strong>Visibility</strong>
              <small>{room.private ? "Private" : "Public"}</small>
            </span>
            <PencilIcon
              class="lc-channel-settings__edit-icon"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
        {/if}
        <Button
          variant="ghost"
          class="lc-channel-settings__row"
          onclick={() => onAction("members")}
        >
          <span>
            <strong>Members</strong>
            <small>{room.memberCount ?? members.length} members</small>
          </span>
          <span class="lc-channel-settings__avatars" aria-hidden="true">
            {#each members.slice(0, 3) as member (member.id)}
              <i>{member.initials}</i>
            {/each}
          </span>
        </Button>
        <Button
          variant="ghost"
          class="lc-channel-settings__row"
          onclick={() => onAction("copy-channel-id")}
        >
          <span>
            <strong>{roomType} ID</strong>
            <small>{room.id}</small>
          </span>
          <CopyIcon
            class="lc-channel-settings__copy-icon"
            data-icon="inline-end"
            aria-hidden="true"
          />
        </Button>
      </div>
    </section>

    <section class="lc-channel-settings__danger-zone">
      {#if canArchive && canUpdate}
        <Button
          variant="ghost"
          class="lc-channel-settings__row"
          onclick={() => onAction("archive-channel")}
        >
          <ArchiveIcon data-icon="inline-start" aria-hidden="true" />
          <span>Archive {roomType.toLowerCase()}</span>
        </Button>
      {/if}
      {#if canLeave}
        <Button
          variant="ghost"
          class="lc-channel-settings__row lc-channel-settings__destructive"
          onclick={() => onAction("leave-channel")}
        >
          <LogOutIcon data-icon="inline-start" aria-hidden="true" />
          <span>Leave {roomType.toLowerCase()}</span>
        </Button>
      {/if}
      {#if canDelete}
        <Button
          variant="ghost"
          class="lc-channel-settings__row lc-channel-settings__destructive"
          onclick={() => onAction("delete-channel")}
        >
          <Trash2Icon data-icon="inline-start" aria-hidden="true" />
          <span>Delete {roomType.toLowerCase()}</span>
        </Button>
      {/if}
    </section>
  </div>
</AppShell.Sidebar.Body>
