<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunityProjectsCreateProject } from "./model.js";

  let {
    open = $bindable(false),
    mode = "create",
    draft = $bindable({
      name: "",
      identifier: "",
      description: "",
      channelId: "",
      visibility: "public" as const,
      listing: "listed" as const,
    }),
    channels = [],
    channelCommandOpen = false,
    busy = false,
    operation = "",
    localError = "",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    onOpenChange,
    onOpenChannelPicker,
    onSubmit,
  }: {
    open?: boolean | undefined;
    mode?: "create" | "edit" | undefined;
    draft?:
      | (CommunityProjectsCreateProject & {
          visibility: "public" | "private";
        })
      | undefined;
    channels?: readonly CommunityRoomModel[] | undefined;
    channelCommandOpen?: boolean | undefined;
    busy?: boolean | undefined;
    operation?: string | undefined;
    localError?: string | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    onOpenChange: () => void;
    onOpenChannelPicker: () => void;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
  <DialogFrame size="wide">
    {#snippet title()}
      {mode === "edit" ? "Project settings" : "Create a new project"}
    {/snippet}
    {#snippet description()}
      {mode === "edit"
        ? "Change the project details shared through its signed announcement."
        : "Bring an existing Community channel together with repositories, tasks, and reviews."}
    {/snippet}

    <form
      id="communityprojects-form-1"
      class="community-projects__project-form"
      onsubmit={onSubmit}
    >
      <Field.Group class="community-projects__project-fields">
        <Field.Field>
          <Field.Label for="project-name">Name</Field.Label>
          <Input
            id="project-name"
            bind:value={draft.name}
            placeholder="relay-forge-sandbox"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="project-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={draft.description}
            placeholder="What this project should become"
            ariaLabel="Project description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            mode="form"
          />
        </Field.Field>

        <div class="community-projects__project-options">
          <div
            class="community-projects__project-option"
            aria-label="Project visibility"
          >
            <span>Visibility</span>
            <span class="community-projects__project-option-choice">
              {draft.visibility === "private" ? "Private" : "Public"}
            </span>
          </div>

          <button
            type="button"
            class="community-projects__project-option community-projects__project-channel-trigger"
            aria-haspopup="dialog"
            aria-expanded={channelCommandOpen}
            onclick={onOpenChannelPicker}
          >
            <span>Project channel</span>
            <span class="community-projects__project-option-choice">
              {channels.find(
                (channel) =>
                  (channel.groupId ?? channel.id) === draft.channelId,
              )?.name ?? "Choose channel"}
              <ChevronDownIcon aria-hidden="true" />
            </span>
          </button>

          <div class="community-projects__project-option">
            <span>Project list</span>
            <Select.Root
              type="single"
              value={draft.listing}
              onValueChange={(value) => {
                if (value === "listed" || value === "unlisted")
                  draft.listing = value;
              }}
            >
              <Select.Trigger aria-label="Project list">
                {draft.listing === "unlisted" ? "Unlisted" : "Listed"}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="listed" label="Listed">Listed</Select.Item>
                <Select.Item value="unlisted" label="Unlisted"
                  >Unlisted</Select.Item
                >
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
    </form>

    {#snippet footer()}
      <Button
        form="communityprojects-form-1"
        type="submit"
        disabled={busy || !draft.name.trim() || !draft.channelId}
      >
        {busy ? operation : mode === "edit" ? "Save changes" : "Create project"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>
