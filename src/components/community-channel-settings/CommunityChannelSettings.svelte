<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShell } from "@lapismd/design-core/shell";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
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
    onAction = () => {},
  }: {
    room: CommunityRoomModel;
    members: CommunityMemberModel[];
    description: string;
    onAction?: (action: string) => void;
  } = $props();
</script>

<AppShell.Sidebar.Header class="lc-channel-settings__header">
  <strong>Channel Settings</strong>
  <AppShell.Sidebar.Close label="Close channel settings" />
</AppShell.Sidebar.Header>

<AppShell.Sidebar.Body>
  <div class="lc-channel-settings">
    <div class="lc-channel-settings__identity">
      <span class="lc-channel-settings__image" aria-hidden="true">
        <HashIcon />
      </span>
      <strong>{room.name}</strong>
      <p>{description}</p>
    </div>

    <section class="lc-channel-settings__details">
      <h2>Details</h2>
      <div class="lc-channel-settings__details-card">
        <Button
          variant="ghost"
          class="lc-channel-settings__row"
          onclick={() => onAction("edit-type")}
        >
          <span>
            <strong>Channel type</strong>
            <small>{room.kind === "channel" ? "Ongoing" : room.kind}</small>
          </span>
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
        </Button>
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
            <strong>Channel ID</strong>
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
      <Button
        variant="ghost"
        class="lc-channel-settings__row"
        onclick={() => onAction("leave-channel")}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />
        <span>Leave channel</span>
      </Button>
      <Button
        variant="ghost"
        class="lc-channel-settings__row"
        onclick={() => onAction("archive-channel")}
      >
        <ArchiveIcon data-icon="inline-start" aria-hidden="true" />
        <span>Archive channel</span>
      </Button>
      <Button
        variant="ghost"
        class="lc-channel-settings__row lc-channel-settings__delete"
        onclick={() => onAction("delete-channel")}
      >
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
        <span>Delete channel</span>
      </Button>
    </section>
  </div>
</AppShell.Sidebar.Body>
