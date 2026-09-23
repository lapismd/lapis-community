<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgeProject,
    ProjectForgeRepository,
  } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunityProjectsCreateTask } from "./model.js";

  let {
    open = $bindable(false),
    draft = $bindable({
      project: "",
      repository: "",
      category: "issue" as const,
      title: "",
      content: "",
    }),
    selectedProject,
    selectedRepository,
    projects = [],
    repositories = [],
    taskProject,
    hasScope = false,
    busy = false,
    operation = "",
    localError = "",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    onOpenChange,
    onSelectProject,
    onSelectRepository,
    onSubmit,
  }: {
    open?: boolean | undefined;
    draft?: CommunityProjectsCreateTask | undefined;
    selectedProject?: ProjectForgeProject | undefined;
    selectedRepository?: ProjectForgeRepository | undefined;
    projects?: readonly ProjectForgeProject[] | undefined;
    repositories?: readonly ProjectForgeRepository[] | undefined;
    taskProject?: ProjectForgeProject | undefined;
    hasScope?: boolean | undefined;
    busy?: boolean | undefined;
    operation?: string | undefined;
    localError?: string | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    onOpenChange: () => void;
    onSelectProject: (value: string) => void;
    onSelectRepository: (value: string) => void;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
  <DialogFrame size="wide">
    {#snippet title()}Create a task{/snippet}
    {#snippet description()}
      {selectedRepository
        ? `Add this task to ${selectedRepository.name}.`
        : selectedProject
          ? `Add this task to ${selectedProject.name}.`
          : "Track work against a project or a repository."}
    {/snippet}

    <form
      id="communityprojects-form-4"
      class="community-projects__project-form"
      onsubmit={onSubmit}
    >
      <Field.Group class="community-projects__project-fields">
        <div class="community-projects__project-options">
          <div class="community-projects__project-option">
            <span>Category</span>
            <Select.Root
              type="single"
              value={draft.category}
              onValueChange={(value) => {
                if (
                  value === "issue" ||
                  value === "change-request" ||
                  value === "improvement"
                )
                  draft.category = value;
              }}
            >
              <Select.Trigger aria-label="Task category">
                {draft.category === "change-request"
                  ? "Change request"
                  : draft.category === "improvement"
                    ? "Improvement"
                    : "Issue"}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Item value="issue" label="Issue">Issue</Select.Item>
                  <Select.Item value="change-request" label="Change request">
                    Change request
                  </Select.Item>
                  <Select.Item value="improvement" label="Improvement">
                    Improvement
                  </Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>

          {#if selectedRepository}
            <div class="community-projects__project-option">
              <span>Repository</span>
              <span class="community-projects__project-option-value">
                {selectedRepository.name}
              </span>
            </div>
          {:else if selectedProject}
            <div class="community-projects__project-option">
              <span>Project</span>
              <span class="community-projects__project-option-value">
                {selectedProject.name}
              </span>
            </div>
          {:else}
            <div class="community-projects__project-option">
              <span>Project <small>Optional</small></span>
              <Select.Root
                type="single"
                value={draft.project || "none"}
                onValueChange={(value) => {
                  if (value) onSelectProject(value);
                }}
              >
                <Select.Trigger aria-label="Task project">
                  {taskProject?.name ?? "No project"}
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
            </div>

            <div class="community-projects__project-option">
              <span>Repository</span>
              <Select.Root
                type="single"
                value={draft.repository}
                onValueChange={(value) => {
                  if (value) onSelectRepository(value);
                }}
              >
                <Select.Trigger aria-label="Task repository scope">
                  {draft.repository === "project"
                    ? "Project-wide"
                    : (repositories.find(
                        (repository) =>
                          repository.address.coordinate === draft.repository,
                      )?.name ?? "Choose repository")}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#if draft.project}
                      <Select.Item value="project" label="Project-wide">
                        Project-wide
                      </Select.Item>
                    {/if}
                    {#each repositories as repository (repository.address.coordinate)}
                      <Select.Item
                        value={repository.address.coordinate}
                        label={repository.name}>{repository.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
          {/if}
        </div>

        <Field.Field>
          <Field.Label for="task-title">Title</Field.Label>
          <Input
            id="task-title"
            bind:value={draft.title}
            placeholder="Describe the task"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="task-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={draft.content}
            placeholder="Add context, expected behaviour, or reproduction steps"
            ariaLabel="Task description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            mode="form"
          />
        </Field.Field>
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
    </form>

    {#snippet footer()}
      <Button
        form="communityprojects-form-4"
        type="submit"
        disabled={busy || !hasScope || !draft.title.trim()}
      >
        {busy ? operation : "Create task"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>
