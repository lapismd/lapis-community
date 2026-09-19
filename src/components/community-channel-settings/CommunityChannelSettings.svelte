<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShell } from "@lapismd/design-core/shell";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import BookOpenTextIcon from "@lucide/svelte/icons/book-open-text";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CommunityChannelCanvas from "../community-channel-canvas/CommunityChannelCanvas.svelte";
  import type { CommunityChannelCanvasModel } from "../../community/channel-canvas.js";

  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import "./CommunityChannelSettings.css";

  let {
    room,
    members,
    description,
    canArchive = false,
    writerPolicySupported = false,
    groupInvitesSupported = false,
    onClose,
    onAction,
    canvas,
    initialCanvasContent = "",
    onLoadCanvas,
    onSaveCanvas,
  }: {
    room: CommunityRoomModel;
    members: CommunityMemberModel[];
    description: string;
    canArchive?: boolean;
    writerPolicySupported?: boolean;
    groupInvitesSupported?: boolean;
    onClose: () => void;
    onAction: (action: string) => void;
    canvas?: CommunityChannelCanvasModel;
    initialCanvasContent?: string;
    onLoadCanvas?: () => Promise<void>;
    onSaveCanvas?: (
      content: string,
      expectedEventId: string | null,
    ) => Promise<void>;
  } = $props();

  const roomType = $derived(room.kind === "forum" ? "Forum" : "Channel");
  let canvasOpen = $state(false);
  const roomId = $derived(room.id);
  $effect(() => {
    roomId;
    canvasOpen = false;
  });
  $effect(() => {
    if (!canvas) canvasOpen = false;
  });
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
  const canManageMembers = $derived(
    room.permissions?.manageMembers.state === undefined ||
      room.permissions.manageMembers.state === "enabled",
  );
  const hasDangerActions = $derived(canLeave || canDelete);
</script>

<AppShell.Sidebar.Header class="lc-channel-settings__header">
  {#if canvasOpen}
    <Button
      variant="ghost"
      onclick={() => {
        canvasOpen = false;
      }}><ArrowLeftIcon aria-hidden="true" />Back to channel</Button
    >
  {:else}<strong>{roomType} settings</strong>{/if}
  <AppShell.Sidebar.Close
    label={`Close ${roomType.toLowerCase()} settings`}
    onclick={onClose}
  />
</AppShell.Sidebar.Header>

<AppShell.Sidebar.Body
  class={canvasOpen ? "lc-channel-settings__body--canvas" : undefined}
>
  <div
    class="lc-channel-settings"
    class:lc-channel-settings--canvas={canvasOpen}
  >
    {#if canvasOpen && canvas && onLoadCanvas && onSaveCanvas}
      <CommunityChannelCanvas
        {canvas}
        initialContent={initialCanvasContent}
        onReload={onLoadCanvas}
        onSave={onSaveCanvas}
      />
    {:else}
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
            {#if writerPolicySupported}
              <Button
                variant="ghost"
                class="lc-channel-settings__row"
                onclick={() => onAction("edit-posting")}
              >
                <span>
                  <strong>Posting permissions</strong>
                  <small>
                    {room.postingPolicy === "writers"
                      ? "Writers and administrators"
                      : "Everyone with access"}
                  </small>
                </span>
                <ShieldCheckIcon
                  class="lc-channel-settings__edit-icon"
                  data-icon="inline-end"
                  aria-hidden="true"
                />
              </Button>
            {/if}
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
                <CommunityMemberAvatar {member} size="xsmall" decorative />
              {/each}
            </span>
          </Button>
          {#if room.private && canManageMembers && groupInvitesSupported}
            <Button
              variant="ghost"
              class="lc-channel-settings__row"
              onclick={() => onAction("create-invite")}
            >
              <span>
                <strong>Create invite link</strong>
                <small
                  >Invite someone to this private {roomType.toLowerCase()}.</small
                >
              </span>
              <UserPlusIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          {/if}
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

      {#if canArchive && canUpdate}
        <section class="lc-channel-settings__management-zone">
          <Button
            variant="ghost"
            class="lc-channel-settings__row"
            onclick={() => onAction("archive-channel")}
          >
            <ArchiveIcon data-icon="inline-start" aria-hidden="true" />
            <span>Archive {roomType.toLowerCase()}</span>
          </Button>
        </section>
      {/if}

      {#if canvas && onLoadCanvas && onSaveCanvas}
        <section class="lc-channel-settings__canvas-entry">
          <Button
            variant="ghost"
            class="lc-channel-settings__row"
            onclick={() => {
              canvasOpen = true;
              void Promise.resolve(onLoadCanvas?.()).catch(() => undefined);
            }}
          >
            <BookOpenTextIcon aria-hidden="true" />
            <span
              ><strong>Canvas</strong><small
                >{canvas.content
                  ? canvas.content
                      .replace(/[#*_`>\[\]]/g, "")
                      .replace(/\s+/g, " ")
                      .slice(0, 100)
                  : "Shared channel notes and context"}</small
              ></span
            >
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </section>
      {/if}

      {#if hasDangerActions}
        <section class="lc-channel-settings__danger-zone">
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
      {/if}
    {/if}
  </div>
</AppShell.Sidebar.Body>
