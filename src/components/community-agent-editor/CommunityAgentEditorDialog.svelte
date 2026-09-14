<script lang="ts">
  import { untrack } from "svelte";
  import {
    ConfirmDialog,
    DialogFrame,
  } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import UnlinkIcon from "@lucide/svelte/icons/unlink";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import CommunityAvatarPicker from "../community-avatar-picker/CommunityAvatarPicker.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityAgentIdentity,
    CommunityAgentNameMode,
    CommunityAgentPersona,
    CommunityAgentRuntimeState,
    CommunityAgentSaveInput,
  } from "../../community/agent-contracts.js";

  let {
    open = $bindable(false),
    agent,
    personas = [],
    runtime,
    connected = true,
    closeLabel = "Close agent editor",
    onSaveAgent,
    onSaveRuntime,
    onUnlinkPersona,
    onDeletePersona,
  }: {
    open?: boolean;
    agent?: CommunityAgentIdentity | undefined;
    personas?: readonly CommunityAgentPersona[];
    runtime?: CommunityAgentRuntimeState | undefined;
    connected?: boolean;
    closeLabel?: string;
    onSaveAgent: (input: CommunityAgentSaveInput) => Promise<void>;
    onSaveRuntime?:
      | ((input: {
          runtimeAgent?: string;
          model?: string;
          thinking?: "off" | "low" | "medium" | "high";
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
  let personaName = $state("");
  let personaDescription = $state("");
  let personaAvatar = $state("");
  let personaPrompt = $state("");
  let personaSlug = $state("");
  let instanceName = $state("");
  let nameMode = $state<CommunityAgentNameMode>("instance");
  let personaSelection = $state("__new__");
  let runtimeAgent = $state("");
  let runtimeModel = $state("");
  let runtimeThinking = $state<"off" | "low" | "medium" | "high">("medium");
  let runtimeConfigMode = $state<"defaults" | "custom">("defaults");
  let unlinkConfirmOpen = $state(false);
  let deleteConfirmOpen = $state(false);

  const editorPersona = $derived(
    personas.find((persona) => persona.slug === personaSelection),
  );
  const runtimeAgents = $derived(
    runtime?.runtimeAgents.length
      ? runtime.runtimeAgents
      : runtime
        ? [
            {
              id: runtime.effective.runtimeAgent,
              label: runtime.effective.runtimeAgent,
            },
          ]
        : [],
  );
  const modelOptions = $derived.by(() => {
    const option = runtime?.catalog.configOptions.find(
      ({ id, category }) => id === "model" || category === "model",
    );
    return (
      option?.options ??
      runtime?.catalog.models.map((value) => ({ value, name: value })) ??
      []
    );
  });
  const thinkingOptions = $derived.by(() => {
    const option = runtime?.catalog.configOptions.find(
      ({ id, category }) =>
        category === "thought" ||
        ["thought_level", "thinking", "effort", "reasoning_effort"].includes(
          id,
        ),
    );
    return (
      option?.options?.filter(
        ({ value }) =>
          value === "off" ||
          value === "low" ||
          value === "medium" ||
          value === "high",
      ) ?? []
    );
  });
  const configuredRuntimeAgentLabel = $derived(
    runtimeAgents.find(({ id }) => id === runtime?.configured.runtimeAgent)
      ?.label ??
      runtime?.configured.runtimeAgent ??
      runtime?.catalog.agent ??
      runtime?.effective.runtimeAgent ??
      "Harness default",
  );
  const configuredModelLabel = $derived(
    (modelOptions.find(({ value }) => value === runtime?.configured.model)
      ?.name ??
      runtime?.configured.model ??
      runtime?.catalog.currentModel ??
      runtime?.effective.model) ||
      "Harness default",
  );
  const configuredThinkingLabel = $derived(
    thinkingOptions.find(({ value }) => value === runtime?.configured.thinking)
      ?.name ??
      runtime?.configured.thinking ??
      runtime?.effective.thinking ??
      "Harness default",
  );
  const runtimeDefaults = $derived.by(() => {
    if (!runtime) return [];
    return [
      { label: "Harness", value: configuredRuntimeAgentLabel },
      { label: "Model", value: configuredModelLabel },
      { label: "Thinking", value: configuredThinkingLabel },
      { label: "Host", value: runtime.host.id },
      ...(runtime.host.workspace
        ? [{ label: "Workspace", value: runtime.host.workspace }]
        : []),
      ...(runtime.bootstrapRevision
        ? [{ label: "Bootstrap", value: runtime.bootstrapRevision }]
        : []),
    ];
  });

  $effect(() => {
    if (!open || !agent) {
      loadedAgent = "";
      return;
    }
    const key = [
      agent.pubkey,
      agent.persona?.slug ?? "",
      agent.instance?.personaId ?? "",
    ].join(":");
    if (loadedAgent === key) return;
    untrack(() => {
      personaName = agent.persona?.displayName ?? agent.name;
      personaDescription = agent.persona?.description ?? agent.about;
      personaAvatar = agent.persona?.avatarUrl ?? agent.avatarUrl ?? "";
      personaPrompt = agent.persona?.systemPrompt ?? "";
      personaSlug =
        agent.persona?.slug ??
        agent.instance?.personaId ??
        personaSlugFromName(agent.name);
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
        "medium") as typeof runtimeThinking;
      runtimeConfigMode = runtime.saved ? "custom" : "defaults";
    });
    loadedRuntime = key;
  });

  function selectPersona(value: string): void {
    personaSelection = value;
    const selected = personas.find((persona) => persona.slug === value);
    if (selected) {
      personaName = selected.displayName;
      personaDescription = selected.description;
      personaAvatar = selected.avatarUrl ?? "";
      personaPrompt = selected.systemPrompt ?? "";
      personaSlug = selected.slug;
      return;
    }
    if (!agent) return;
    personaName = agent.name;
    personaDescription = agent.about;
    personaAvatar = agent.avatarUrl ?? "";
    personaPrompt = "";
    personaSlug = agent.instance?.personaId ?? personaSlugFromName(agent.name);
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
        "Persona ID must use lowercase letters, numbers, hyphens, or underscores.";
      return;
    }
    pending = true;
    error = "";
    try {
      await onSaveAgent({
        pubkey: agent.pubkey,
        personaSlug: slug,
        displayName,
        description: personaDescription,
        avatarUrl: personaAvatar,
        systemPrompt: personaPrompt,
        nameMode,
        instanceName,
      });
      if (runtime && onSaveRuntime && runtimeConfigMode === "custom") {
        await onSaveRuntime({
          runtimeAgent,
          ...(runtimeModel ? { model: runtimeModel } : {}),
          thinking: runtimeThinking,
        });
      }
      open = false;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Agent update failed.";
    } finally {
      pending = false;
    }
  }

  function personaSlugFromName(value: string): string {
    return (
      value
        .toLowerCase()
        .normalize("NFKD")
        .replaceAll(/[^a-z0-9_-]+/g, "-")
        .replaceAll(/^-+|-+$/g, "")
        .slice(0, 64) || "agent"
    );
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
        {#if agent?.instance?.personaId && (onUnlinkPersona || onDeletePersona)}
          <div class="agent-editor__persona-management">
            {#if onUnlinkPersona}
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onclick={() => (unlinkConfirmOpen = true)}
                ><UnlinkIcon aria-hidden="true" />Unlink persona</Button
              >
            {/if}
            {#if onDeletePersona && editorPersona}
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onclick={() => (deleteConfirmOpen = true)}
                ><TrashIcon aria-hidden="true" />Delete persona</Button
              >
            {/if}
          </div>
        {/if}
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
        {#if personas.length > 0}
          <Field.Field>
            <Field.Label for={`${editorId}-persona-source`}>Persona</Field.Label
            >
            <Select.Root
              type="single"
              value={personaSelection}
              onValueChange={selectPersona}
              disabled={pending || !connected}
            >
              <Select.Trigger id={`${editorId}-persona-source`}
                >{editorPersona?.displayName ??
                  "Create a new persona"}</Select.Trigger
              >
              <Select.Content>
                <Select.Item value="__new__">Create a new persona</Select.Item>
                {#each personas as persona (persona.slug)}
                  <Select.Item value={persona.slug}
                    >{persona.displayName}</Select.Item
                  >
                {/each}
              </Select.Content>
            </Select.Root>
            <Field.Description>
              Choose an existing reusable persona or create one for this agent.
            </Field.Description>
          </Field.Field>
        {/if}
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
          <Field.Label for={`${editorId}-persona-id`}>Persona ID</Field.Label>
          <Input
            id={`${editorId}-persona-id`}
            bind:value={personaSlug}
            disabled={pending || editorPersona !== undefined}
          />
          <Field.Description>
            The stable ID remains unchanged when the persona is renamed.
          </Field.Description>
        </Field.Field>
        <Field.Field>
          <Field.Label for={`${editorId}-persona-name-mode`}
            >Instance name</Field.Label
          >
          <Select.Root
            type="single"
            value={nameMode}
            onValueChange={(value) =>
              (nameMode = value as CommunityAgentNameMode)}
            disabled={pending || !agent}
          >
            <Select.Trigger id={`${editorId}-persona-name-mode`}
              >{nameMode === "inherited"
                ? "Use persona name"
                : "Keep instance name"}</Select.Trigger
            >
            <Select.Content>
              <Select.Item value="instance">Keep instance name</Select.Item>
              <Select.Item value="inherited">Use persona name</Select.Item>
            </Select.Content>
          </Select.Root>
          <Field.Description>
            Inheritance stays explicit even while the two names match.
          </Field.Description>
        </Field.Field>
        {#if nameMode === "instance"}
          <Field.Field>
            <Field.Label for={`${editorId}-instance-name`}
              >Independent instance name</Field.Label
            >
            <Input
              id={`${editorId}-instance-name`}
              bind:value={instanceName}
              disabled={pending || !agent}
            />
          </Field.Field>
        {/if}
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
            Saved with the persona. A configured controller applies changes
            before the agent's next idle turn.
          </Field.Description>
        </Field.Field>
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
              <Field.Field>
                <Field.Label for={`${editorId}-runtime-agent`}
                  >Agent harness</Field.Label
                >
                <Select.Root
                  type="single"
                  value={runtimeAgent}
                  onValueChange={(value) => (runtimeAgent = value)}
                  disabled={pending}
                >
                  <Select.Trigger id={`${editorId}-runtime-agent`}
                    >{runtimeAgents.find(({ id }) => id === runtimeAgent)
                      ?.label ?? runtimeAgent}</Select.Trigger
                  >
                  <Select.Content>
                    {#each runtimeAgents as entry (entry.id)}
                      <Select.Item value={entry.id}>{entry.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </Field.Field>
              <Field.Field>
                <Field.Label for={`${editorId}-runtime-model`}
                  >Model</Field.Label
                >
                <Select.Root
                  type="single"
                  value={runtimeModel}
                  onValueChange={(value) => (runtimeModel = value)}
                  disabled={pending}
                >
                  <Select.Trigger id={`${editorId}-runtime-model`}
                    >{modelOptions.find(({ value }) => value === runtimeModel)
                      ?.name ?? runtimeModel}</Select.Trigger
                  >
                  <Select.Content>
                    {#each modelOptions as option (option.value)}
                      <Select.Item value={option.value}
                        >{option.name}</Select.Item
                      >
                    {/each}
                  </Select.Content>
                </Select.Root>
              </Field.Field>
              {#if thinkingOptions.length > 0}
                <Field.Field>
                  <Field.Label for={`${editorId}-runtime-thinking`}
                    >Thinking</Field.Label
                  >
                  <Select.Root
                    type="single"
                    value={runtimeThinking}
                    onValueChange={(value) =>
                      (runtimeThinking = value as typeof runtimeThinking)}
                    disabled={pending}
                  >
                    <Select.Trigger id={`${editorId}-runtime-thinking`}
                      >{thinkingOptions.find(
                        ({ value }) => value === runtimeThinking,
                      )?.name ?? runtimeThinking}</Select.Trigger
                    >
                    <Select.Content>
                      {#each thinkingOptions as option (option.value)}
                        <Select.Item value={option.value}
                          >{option.name}</Select.Item
                        >
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </Field.Field>
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
<ConfirmDialog
  bind:open={unlinkConfirmOpen}
  title={`Unlink persona from ${agent?.name ?? "this agent"}?`}
  description="The agent and its public profile remain. Presentation falls back to the agent-signed profile, and the saved prompt is not copied into the public instance record."
  confirmLabel="Unlink persona"
  onConfirm={async () => {
    if (!agent || !onUnlinkPersona) return;
    await onUnlinkPersona(agent.name);
    open = false;
  }}
/>
<ConfirmDialog
  bind:open={deleteConfirmOpen}
  title={`Delete persona ${editorPersona?.displayName ?? ""}?`}
  description="The agent remains linked to an unresolved persona and falls back to its agent-signed public profile until you recreate or relink it."
  confirmLabel="Delete persona"
  destructive
  onConfirm={async () => {
    if (!editorPersona || !onDeletePersona) return;
    await onDeletePersona(editorPersona.slug);
    open = false;
  }}
/>

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
  .agent-editor__persona-management {
    display: grid;
    width: 100%;
    gap: 0.625rem;
  }
  .agent-editor__persona-management :global(button) {
    justify-content: flex-start;
    width: 100%;
  }
  .agent-editor__persona-management :global(svg) {
    width: 1rem;
    height: 1rem;
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
