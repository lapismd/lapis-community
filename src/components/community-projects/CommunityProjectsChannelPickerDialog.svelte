<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import HashIcon from "@lucide/svelte/icons/hash";

  import type { ProjectForgeProject } from "../../projects/index.js";
  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    mode = "home",
    pending = "",
    target,
    projects = [],
    channels = [],
    projectChannelIds,
    onSelectProject,
    onSelectChannel,
  }: {
    open?: boolean | undefined;
    mode?: "home" | "attach" | undefined;
    pending?: string | undefined;
    target?: ProjectForgeProject | undefined;
    projects?: readonly ProjectForgeProject[] | undefined;
    channels?: readonly CommunityRoomModel[] | undefined;
    projectChannelIds: ReadonlySet<string>;
    onSelectProject: (coordinate: string) => void;
    onSelectChannel: (channel: CommunityRoomModel) => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <DialogFrame
    title={mode === "home"
      ? "Choose a project channel"
      : target
        ? `Add channel to ${target.name}`
        : "Choose a project"}
    description={pending
      ? "Adding channel…"
      : mode === "attach" && !target
        ? "Select the project that will include this channel."
        : "Search the Community channels available to this project."}
    size="form"
    bodyPadding="none"
  >
    {#key `${mode}:${target?.address.coordinate ?? ""}`}
      <Command.Root
        class="community-projects__channel-command"
        aria-busy={pending !== ""}
      >
        <Command.Input
          placeholder={mode === "attach" && !target
            ? "Search projects"
            : "Search channels"}
          aria-label={mode === "attach" && !target
            ? "Search projects"
            : "Search channels"}
          aria-controls="community-project-channel-command-list"
        />
        <Command.List id="community-project-channel-command-list">
          <Command.Empty
            >{mode === "attach" && !target
              ? "No projects available."
              : mode === "home"
                ? "No channels found."
                : "No additional channels available."}</Command.Empty
          >
          {#if mode === "attach" && !target}
            <Command.Group heading="Your projects">
              {#each projects as project (project.address.coordinate)}
                <Command.Item
                  value={project.name}
                  onSelect={() => onSelectProject(project.address.coordinate)}
                >
                  <FolderKanbanIcon aria-hidden="true" />
                  {project.name}
                </Command.Item>
              {/each}
            </Command.Group>
          {:else}
            <Command.Group heading="Channels">
              {#each channels as channel (channel.id)}
                <Command.Item
                  value={`${channel.name} ${channel.groupId ?? channel.id}`}
                  disabled={pending !== ""}
                  onSelect={() => onSelectChannel(channel)}
                >
                  {#if channel.isProjectChannel || projectChannelIds.has(channel.groupId ?? channel.id)}
                    <CommunityProjectChannelIcon />
                  {:else}
                    <HashIcon aria-hidden="true" />
                  {/if}
                  <span class="community-projects__channel-command-copy">
                    <strong>#{channel.name}</strong>
                    <small>{channel.private ? "Private" : "Public"}</small>
                  </span>
                </Command.Item>
              {/each}
            </Command.Group>
          {/if}
        </Command.List>
      </Command.Root>
    {/key}
  </DialogFrame>
</Dialog.Root>
