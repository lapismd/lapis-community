<script lang="ts">
  import { untrack } from "svelte";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import CommunityMemberCommand from "../community-member-command/CommunityMemberCommand.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityAvatarPicker from "../community-avatar-picker/CommunityAvatarPicker.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityAgentEditorModelField from "./CommunityAgentEditorModelField.svelte";
  import CommunityAgentEditorThinkingField from "./CommunityAgentEditorThinkingField.svelte";
  import type {
    CommunityAgentIdentity,
    CommunityAgentNameMode,
    CommunityAgentPersona,
    CommunityAgentRuntimeState,
    CommunityAgentSaveInput,
  } from "../../community/agent-contracts.js";
  import { queueEditorRuntimeRefresh } from "../../community/agent-editor-catalog-refresh.js";
  import { editorCombinedModelRows } from "../../community/agent-editor-model-rows.js";
  import { editorRuntimeDraft } from "../../community/agent-editor-runtime.js";
  import { editorRuntimeDefaultRows } from "../../community/agent-editor-runtime-defaults.js";
  import { editorConfiguredRuntimeLabels } from "../../community/agent-editor-runtime-labels.js";
  import { editorRuntimeSaveInput } from "../../community/agent-editor-runtime-save.js";
  import { editorPersonaSelection } from "../../community/agent-editor-persona-selection.js";
  import { personaSlugFromName } from "../../community/agent-persona-slug.js";
  import type { CommunityAgentRuntimeThinking } from "../../community/agent-runtime-contracts.js";

  let {
    open = $bindable(false),
    agent,
    members = [],
    memberResults = [],
    onSearchMembers,
    personas = [],
    runtime,
    connected = true,
    closeLabel = "Close agent editor",
    onLoadRuntime,
    onSaveAgent,
    onSaveRuntime,
    onUnlinkPersona,
    onDeletePersona,
  }: {
    open?: boolean;
    agent?: CommunityAgentIdentity | undefined;
    members?: readonly CommunityMemberModel[];
    memberResults?: readonly CommunityMemberModel[];
    onSearchMembers?: ((query: string) => void) | undefined;
    personas?: readonly CommunityAgentPersona[];
    runtime?: CommunityAgentRuntimeState | undefined;
    connected?: boolean;
    closeLabel?: string;
    onLoadRuntime?: (() => Promise<CommunityAgentRuntimeState>) | undefined;
    onSaveAgent: (input: CommunityAgentSaveInput) => Promise<void>;
    onSaveRuntime?:
      | ((input: {
          runtimeAgent?: string;
          model?: string;
          thinking?: CommunityAgentRuntimeThinking;
        }) => Promise<CommunityAgentRuntimeState>)
      | undefined;
    onUnlinkPersona?: ((fallbackName: string) => Promise<void>) | undefined;
    onDeletePersona?: ((slug: string) => Promise<void>) | undefined;
  } = $props();

  const editorId = $props.id();
  let pending = $state(false);
  let error = $state("");
  let loadedAgent = $state("");
  let loadedRuntime = $state("");
  let runtimeRefreshKey = $state("");
  let personaName = $state("");
  let approvedParticipants = $state<string[]>([]);
  let selectedMembers = $state<CommunityMemberModel[]>([]);
  const selectableMembers = $derived(
    [...members, ...selectedMembers].filter(
      (member) =>
        member.id !== agent?.ownerPubkey && member.id !== agent?.pubkey,
    ),
  );
  const selectableResults = $derived(
    memberResults.filter(
      (member) =>
        member.id !== agent?.ownerPubkey && member.id !== agent?.pubkey,
    ),
  );
  function toggleParticipant(member: CommunityMemberModel) {
    if (approvedParticipants.includes(member.id)) {
      approvedParticipants = approvedParticipants.filter(
        (id) => id !== member.id,
      );
    } else {
      approvedParticipants = [...approvedParticipants, member.id];
      selectedMembers = [
        ...selectedMembers.filter((candidate) => candidate.id !== member.id),
        member,
      ];
    }
  }
  let personaDescription = $state("");
  let personaAvatar = $state("");
  let personaPrompt = $state("");
  let personaSlug = $state("");
  let instanceName = $state("");
  let nameMode = $state<CommunityAgentNameMode>("instance");
  let personaSelection = $state("__new__");
  let runtimeAgent = $state("");
  let runtimeModel = $state("");
  let runtimeThinking = $state<CommunityAgentRuntimeThinking | "">("");
  let runtimeConfigMode = $state<"defaults" | "custom">("defaults");
  let unlinkConfirmOpen = $state(false);
  let deleteConfirmOpen = $state(false);

  const configured = $derived(editorConfiguredRuntimeLabels(runtime));
  const draft = $derived(
    editorRuntimeDraft(runtime, runtimeAgent, {
      model: runtimeModel,
      thinking: runtimeThinking,
    }),
  );
  const modelRows = $derived(editorCombinedModelRows(runtime));
  const runtimeDefaults = $derived(
    runtime
      ? editorRuntimeDefaultRows(runtime, {
          harness: configured.harness,
          model: configured.model,
          ...(configured.thinking ? { thinking: configured.thinking } : {}),
        })
      : [],
  );

  $effect(() => {
    if (!open || !agent) {
      loadedAgent = "";
      runtimeRefreshKey = "";
      return;
    }
    const key = [
      agent.pubkey,
      agent.persona?.slug ?? "",
      agent.instance?.personaId ?? "",
    ].join(":");
    if (loadedAgent === key) return;
    untrack(() => {
      personaName = agent.name;
      approvedParticipants = [...(agent.instance?.dmAllowlist ?? [])];
      selectedMembers = [...members, ...memberResults].filter((member) =>
        approvedParticipants.includes(member.id),
      );
      personaDescription = agent.persona?.description ?? agent.about;
      personaAvatar = agent.persona?.avatarUrl ?? agent.avatarUrl ?? "";
      personaPrompt = agent.persona?.systemPrompt ?? "";
      personaSlug =
        agent.persona?.slug ??
        agent.instance?.personaId ??
        `agent-${agent.pubkey.slice(0, 16)}`;
      instanceName = agent.instance?.name || agent.name;
      nameMode = agent.instance?.nameMode ?? "instance";
      personaSelection = agent.persona?.slug ?? "__new__";
      runtimeConfigMode = runtime?.saved ? "custom" : "defaults";
      error = "";
    });
    loadedAgent = key;
  });

  $effect(() => {
    if (!runtime) {
      loadedRuntime = "";
      return;
    }
    const key = [
      runtime.agentId,
      runtime.saved?.updatedAt ?? "defaults",
      runtime.effective.runtimeAgent,
      runtime.effective.model ?? "",
      runtime.effective.thinking ?? "",
    ].join(":");
    if (loadedRuntime === key) return;
    untrack(() => {
      runtimeAgent = runtime.effective.runtimeAgent;
      runtimeModel =
        runtime.effective.model ?? runtime.catalog.currentModel ?? "";
      runtimeThinking = (runtime.effective.thinking ??
        "") as typeof runtimeThinking;
      runtimeConfigMode = runtime.saved ? "custom" : "defaults";
    });
    loadedRuntime = key;
  });

  $effect(() => {
    const pubkey = open && agent ? agent.pubkey : "";
    const cached = runtime;
    const load = onLoadRuntime;
    untrack(() => {
      const next = queueEditorRuntimeRefresh({
        open,
        pubkey,
        runtime: cached,
        runtimeAgent,
        requestedKey: runtimeRefreshKey,
        load,
      });
      runtimeRefreshKey = next.requestedKey;
      void next.task?.catch((cause) => {
        if (pubkey && !runtimeRefreshKey.startsWith(pubkey)) return;
        error =
          cause instanceof Error ? cause.message : "Could not load runtime";
      });
    });
  });

  function selectPersona(value: string): void {
    personaSelection = value;
    ({
      personaName,
      personaDescription,
      personaAvatar,
      personaPrompt,
      personaSlug,
    } = editorPersonaSelection(value, personas, agent, personaSlug));
  }

  async function save(): Promise<void> {
    if (!agent) return;
    const displayName = personaName.trim();
    const slug = personaSlug.trim() || personaSlugFromName(displayName);
    if (!displayName) {
      error = "Enter an agent name.";
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) {
      error =
        "The saved agent configuration ID is invalid. Reopen the editor and try again.";
      return;
    }
    pending = true;
    error = "";
    try {
      const dmAllowlist = [...new Set(approvedParticipants)];
      await onSaveAgent({
        pubkey: agent.pubkey,
        personaSlug: slug,
        displayName,
        description: personaDescription,
        avatarUrl: personaAvatar,
        systemPrompt: personaPrompt,
        nameMode,
        instanceName: displayName,
        dmAllowlist,
      });
      if (runtime && onSaveRuntime && runtimeConfigMode === "custom") {
        await onSaveRuntime(
          editorRuntimeSaveInput(
            runtimeAgent,
            draft.selection,
            draft.thinkingOptions,
          ),
        );
      }
      open = false;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Agent update failed.";
    } finally {
      pending = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <DialogFrame
    title="Edit agent"
    description="Manage the agent presentation, saved instructions, and runtime defaults."
    descriptionHidden
    size="large"
    surface="inset"
    class="agent-editor"
    busy={pending}
    {closeLabel}
    onInteractOutside={(event) => {
      if (pending) event.preventDefault();
    }}
    onEscapeKeydown={(event) => {
      if (pending) event.preventDefault();
    }}
  >
    {#snippet sidebar()}
      <div class="agent-editor__sidebar">
        <CommunityAvatarPicker
          bind:value={personaAvatar}
          label="Choose agent image"
          disabled={pending || !agent}
          size="medium"
          fallbackName={personaName || agent?.name || "Agent"}
        />
      </div>
    {/snippet}
    <form
      id={`${editorId}-form`}
      class="agent-editor__form"
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field.Group>
        <Field.Field>
          <Field.Label for={`${editorId}-persona-name`}>Agent name</Field.Label>
          <Input
            id={`${editorId}-persona-name`}
            bind:value={personaName}
            disabled={pending || !agent}
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label>Description <span>Optional</span></Field.Label>
          <CommunityChatComposer
            mode="form"
            bind:value={personaDescription}
            ariaLabel="Agent description"
            placeholder="What this agent does, in a sentence"
          />
        </Field.Field>
        <Field.Field>
          <Field.Label>Agent instructions</Field.Label>
          <CommunityChatComposer
            mode="form"
            bind:value={personaPrompt}
            ariaLabel="Agent instructions"
            placeholder="Describe how this agent should work."
          />
          <Field.Description>
            A configured controller applies changes before the agent's next idle
            turn.
          </Field.Description>
        </Field.Field>
        <Field.Field role="group" aria-label="Who can message this agent">
          <Field.Title>Who can message this agent</Field.Title>
          <CommunityMemberCommand
            presentation="inline"
            mode="select"
            searchLabel="Search community users"
            members={selectableMembers}
            results={selectableResults}
            selectedIds={approvedParticipants}
            selectionLabel="Approved people"
            maxSelected={128}
            disabled={pending || !connected}
            onSearch={(query) => onSearchMembers?.(query)}
            onSelect={toggleParticipant}
            onRemove={(member) => {
              approvedParticipants = approvedParticipants.filter(
                (id) => id !== member.id,
              );
            }}
          />
          <Field.Description>
            You can always message this agent. Select other community users to
            allow them too. Every participant in a group must be approved; group
            replies require a mention or a reply to the agent.
          </Field.Description>
        </Field.Field>
        {#if agent?.personaStatus === "unresolved"}<p role="status">
            This agent’s saved configuration is missing. Save these details to
            restore it.
          </p>{/if}
        {#if runtime && onSaveRuntime}
          <div class="agent-editor__runtime-editor">
            <h3>AI configuration</h3>
            <Tabs.Root
              value={runtimeConfigMode}
              onValueChange={(value) =>
                (runtimeConfigMode = value as typeof runtimeConfigMode)}
            >
              <Tabs.List class="agent-editor__runtime-mode">
                <Tabs.Trigger value="defaults"
                  >Use harness defaults</Tabs.Trigger
                >
                <Tabs.Trigger value="custom"
                  >Customize for this agent</Tabs.Trigger
                >
              </Tabs.List>
            </Tabs.Root>
            {#if runtimeConfigMode === "defaults"}
              <dl class="agent-editor__runtime-defaults">
                {#each runtimeDefaults as item (item.label)}
                  <div>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                {/each}
              </dl>
            {:else}
              <CommunityAgentEditorModelField
                id={`${editorId}-runtime-model`}
                {pending}
                rows={modelRows}
                {runtimeAgent}
                model={runtimeModel}
                onSelect={(row) => {
                  runtimeAgent = row.runtimeAgent;
                  runtimeModel = row.model;
                  runtimeThinking = "";
                }}
              />
              {#if draft.thinkingOptions.length > 0}
                <CommunityAgentEditorThinkingField
                  id={`${editorId}-runtime-thinking`}
                  {pending}
                  thinking={draft.selection.thinking}
                  options={draft.thinkingOptions}
                  onValueChange={(value) => (runtimeThinking = value)}
                />
              {/if}
            {/if}
          </div>
        {/if}
        {#if error}<Field.Error>{error}</Field.Error>{/if}
      </Field.Group>
    </form>
    {#snippet footer()}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onclick={() => (open = false)}>Cancel</Button
      >
      <Button
        type="submit"
        form={`${editorId}-form`}
        disabled={pending || !agent}
        >{pending ? "Saving..." : "Save changes"}</Button
      >
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<style>
  .agent-editor__form {
    display: block;
  }
  .agent-editor__sidebar {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 0.875rem;
  }
  :global(.agent-editor [data-ui-part="dialog-frame-sidebar"]),
  :global(.agent-editor [data-ui-part="dialog-frame-body"]) {
    overflow-y: auto;
  }

  .agent-editor__runtime-editor {
    display: grid;
    gap: 1rem;
    padding-top: 0.5rem;
  }
  .agent-editor__runtime-editor h3 {
    margin: 0;
    font-size: var(--community-text-section);
    line-height: 1.4;
    font-weight: 700;
  }
  :global(.agent-editor__runtime-mode) {
    width: 100%;
  }
  :global(.agent-editor__runtime-mode > button) {
    flex: 1;
  }
  .agent-editor__runtime-defaults {
    display: grid;
    gap: 0;
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--card);
  }
  .agent-editor__runtime-defaults > div {
    display: grid;
    grid-template-columns: minmax(7rem, 0.35fr) minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }
  .agent-editor__runtime-defaults > div + div {
    border-top: 1px solid var(--border);
  }
  .agent-editor__runtime-defaults dt {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
  .agent-editor__runtime-defaults dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--foreground);
    font-weight: 600;
  }
</style>
