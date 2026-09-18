<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type { ProjectForgeProject } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import { roomMaintainAvailability } from "../../community/channel-authority.js";
  import type { CommunityProjectsCreateRepository } from "./model.js";

  let {
    open = $bindable(false),
    draft = $bindable({
      project: "",
      channelId: "",
      name: "",
      identifier: "",
      description: "",
      mode: "hosted" as const,
      cloneUrl: "",
      webUrl: "",
    }),
    selectedProject,
    projects = [],
    channels = [],
    busy = false,
    operation = "",
    localError = "",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    onOpenChange,
    onSelectProject,
    onSubmit,
  }: {
    open?: boolean | undefined;
    draft?: CommunityProjectsCreateRepository | undefined;
    selectedProject?: ProjectForgeProject | undefined;
    projects?: readonly ProjectForgeProject[] | undefined;
    channels?: readonly CommunityRoomModel[] | undefined;
    busy?: boolean | undefined;
    operation?: string | undefined;
    localError?: string | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    onOpenChange: () => void;
    onSelectProject: (value: string) => void;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();

  function roomForChannel(channelId: string): CommunityRoomModel | undefined {
    return (
      rooms.find((room) => (room.groupId ?? room.id) === channelId) ??
      channels.find((channel) => (channel.groupId ?? channel.id) === channelId)
    );
  }

  const selectedChannelMaintain = $derived(
    roomMaintainAvailability(roomForChannel(draft.channelId)),
  );
  const canCreateOnSelectedChannel = $derived(
    selectedChannelMaintain.state === "enabled",
  );
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
  <DialogFrame size="wide">
    {#snippet title()}Create a new repository{/snippet}
    {#snippet description()}
      Add a relay-hosted repository or connect an existing external Git
      repository. You can optionally add it to a project.
    {/snippet}

    <form
      id="communityprojects-form-2"
      class="community-projects__project-form"
      onsubmit={onSubmit}
    >
      <Field.Group class="community-projects__project-fields">
        <Field.Field>
          <Field.Label for="repository-name">Name</Field.Label>
          <Input
            id="repository-name"
            bind:value={draft.name}
            placeholder="repository-name"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="repository-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={draft.description}
            placeholder="What this repository is for"
            ariaLabel="Repository description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            mode="form"
          />
        </Field.Field>

        <div class="community-projects__project-options">
          <div class="community-projects__project-option">
            <span>Project <small>Optional</small></span>
            {#if selectedProject}
              <span class="community-projects__project-option-value">
                {selectedProject.name}
              </span>
            {:else}
              <Select.Root
                type="single"
                value={draft.project || "none"}
                onValueChange={(value) => {
                  if (value) onSelectProject(value);
                }}
              >
                <Select.Trigger aria-label="Repository project">
                  {projects.find(
                    (project) => project.address.coordinate === draft.project,
                  )?.name ?? "No project"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    <Select.Item value="none" label="No project">
                      No project
                    </Select.Item>
                    {#each projects as project (project.address.coordinate)}
                      <Select.Item
                        value={project.address.coordinate}
                        label={project.name}>{project.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            {/if}
          </div>

          {#if !draft.project}
            <div class="community-projects__project-option">
              <span>Repository channel</span>
              <Select.Root
                type="single"
                value={draft.channelId}
                onValueChange={(value) => {
                  if (value) draft.channelId = value;
                }}
              >
                <Select.Trigger aria-label="Repository channel">
                  {channels.find(
                    (channel) =>
                      (channel.groupId ?? channel.id) === draft.channelId,
                  )?.name ?? "Choose channel"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each channels as channel (channel.id)}
                      {@const availability = roomMaintainAvailability(
                        roomForChannel(channel.groupId ?? channel.id),
                      )}
                      <Select.Item
                        value={channel.groupId ?? channel.id}
                        label={`#${channel.name}`}
                        disabled={availability.state !== "enabled"}
                        >#{channel.name}{availability.state === "enabled"
                          ? ""
                          : ` — ${availability.reason ?? "Requires maintainer"}`}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
          {/if}

          <div class="community-projects__project-option">
            <span>Backing</span>
            <Select.Root
              type="single"
              value={draft.mode}
              onValueChange={(value) => {
                if (value === "hosted" || value === "external")
                  draft.mode = value;
              }}
            >
              <Select.Trigger aria-label="Repository backing">
                {draft.mode === "hosted" ? "Hosted by relay" : "External Git"}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Item value="hosted" label="Hosted by relay">
                    Hosted by relay
                  </Select.Item>
                  <Select.Item value="external" label="External Git">
                    External Git
                  </Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        {#if draft.mode === "external"}
          <Field.Field>
            <Field.Label for="repository-clone">Clone URL</Field.Label>
            <Input
              id="repository-clone"
              type="url"
              bind:value={draft.cloneUrl}
              placeholder="https://github.com/owner/repository.git"
              required
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="repository-web">
              Web URL <span>Optional</span>
            </Field.Label>
            <Input
              id="repository-web"
              type="url"
              bind:value={draft.webUrl}
              placeholder="https://github.com/owner/repository"
            />
          </Field.Field>
        {/if}
        {#if draft.channelId && !canCreateOnSelectedChannel}
          <Field.Error>{selectedChannelMaintain.reason}</Field.Error>
        {:else if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
    </form>

    {#snippet footer()}
      <Button
        form="communityprojects-form-2"
        type="submit"
        disabled={busy ||
          !draft.channelId ||
          !draft.name.trim() ||
          !canCreateOnSelectedChannel}
      >
        {busy ? operation : "Create repository"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>
