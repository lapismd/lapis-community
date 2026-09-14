<script lang="ts">
  import { untrack } from "svelte";
  import { decode } from "nostr-tools/nip19";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
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
  let approvedParticipants = $state("");
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
      personaName = agent.name;
      approvedParticipants = agent.instance?.dmAllowlist?.join(", ") ?? "";
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
        "The saved agent configuration ID is invalid. Reopen the editor and try again.";
      return;
    }
    pending = true;
    error = "";
    try {
      const dmAllowlist = [
        ...new Set(
          approvedParticipants
            .split(/[\s,;]+/)
            .filter(Boolean)
            .map((value) => {
              if (/^[0-9a-f]{64}$/.test(value)) return value;
              const key = decode(value);
              if (key.type !== "npub")
                throw new Error(
                  "Use a hexadecimal or npub public key for each approved person",
                );
              return key.data;
            }),
        ),
      ];
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
        <Field.Field>
          <Field.Label for={`${editorId}-dm-allowlist`}
            >Who can message this agent</Field.Label
          >
          <Input
            id={`${editorId}-dm-allowlist`}
            bind:value={approvedParticipants}
            placeholder="Approved public keys, separated by commas"
            disabled={pending}
          />
          <Field.Description
            >You can always message this agent. Add each other person’s hex or
            npub key. Every participant in a group must be approved; group
            replies require a mention or a reply to the agent.</Field.Description
          >
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
