<script lang="ts">
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import { toast } from "svelte-sonner";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import { onMount, onDestroy } from "svelte";
  import CommunityAgentProcessingControl from "../community-agent-processing-control/CommunityAgentProcessingControl.svelte";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import {
    ConfirmDialog,
    ConfirmButton,
  } from "@lapismd/design-core/forms/dialog";
  import CommunityAvatarPicker from "../community-avatar-picker/CommunityAvatarPicker.svelte";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { nip19 } from "nostr-tools";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import BotIcon from "@lucide/svelte/icons/bot";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import LinkIcon from "@lucide/svelte/icons/link-2";
  import MoreIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import ActivityIcon from "@lucide/svelte/icons/wrench";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import ShieldOffIcon from "@lucide/svelte/icons/shield-off";
  import HashIcon from "@lucide/svelte/icons/hash";
  import CheckIcon from "@lucide/svelte/icons/check";
  import type {
    CommunityAgentIdentity,
    CommunityAgentNameMode,
    CommunityAgentControllerBootstrap,
    CommunityManagedAgentCreateInput,
    CommunityAgentPersona,
    CommunityAgentPersonaSaveInput,
    CommunityAgentSaveInput,
    CommunityAgentRuntimeState,
    CommunityAgentProcessingState,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import CommunityAgentEditorDialog from "../community-agent-editor/CommunityAgentEditorDialog.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityAgentMember, communityPersonaMember } from "./model.js";

  let {
    model,
    members = [],
    memberResults = [],
    onSearchMembers,
    onProfile,
    onActivity,
    onSavePersona,
    onSaveAgent,
    onSaveRuntime,
    onLoadProcessing,
    onSetProcessing,
    onUnlinkPersona,
    onDeletePersona,
    onCreateManagedAgent,
    onClearManagedAgentDraft,
    onCreateReplacement,
    onRevokeManagedAgent,
    onDeleteManagedAgent,
    rooms = [],
    onAddAgentToRoom,
    ownerPubkey = "",
    onRefresh,
    onClearHistory,
    showPageHeader = true,
    showBodyDescription = false,
    adding = $bindable(false),
  }: {
    model: CommunityAgentsState;
    members?: readonly CommunityMemberModel[];
    memberResults?: readonly CommunityMemberModel[];
    onSearchMembers?: ((query: string) => void) | undefined;
    onProfile: (pubkey: string) => void;
    onActivity: (pubkey: string) => void;
    onSavePersona?: (input: CommunityAgentPersonaSaveInput) => Promise<void>;
    onSaveAgent?: (input: CommunityAgentSaveInput) => Promise<void>;
    onSaveRuntime?: (
      pubkey: string,
      defaults: {
        runtimeAgent?: string;
        model?: string;
        thinking?: "off" | "low" | "medium" | "high";
      },
    ) => Promise<CommunityAgentRuntimeState>;
    onLoadProcessing?:
      | ((pubkey: string) => Promise<CommunityAgentProcessingState>)
      | undefined;
    onSetProcessing?:
      | ((
          pubkey: string,
          enabled: boolean,
          revision: number,
        ) => Promise<CommunityAgentProcessingState>)
      | undefined;
    onUnlinkPersona?: (pubkey: string, fallbackName: string) => Promise<void>;
    onDeletePersona?: (slug: string) => Promise<void>;
    onCreateManagedAgent?: (
      input: CommunityManagedAgentCreateInput,
    ) => Promise<CommunityAgentControllerBootstrap>;
    onClearManagedAgentDraft?: () => void;
    onCreateReplacement?: (
      pubkey: string,
    ) => Promise<CommunityAgentControllerBootstrap>;
    onRevokeManagedAgent?: (pubkey: string) => Promise<void>;
    onDeleteManagedAgent?: (pubkey: string) => Promise<void>;
    rooms?: readonly {
      id: string;
      groupId?: string;
      name: string;
      canManage: boolean;
      isProjectChannel?: boolean;
    }[];
    onAddAgentToRoom?: (roomId: string, pubkey: string) => Promise<void>;
    ownerPubkey?: string;
    onRefresh: () => void | Promise<void>;
    onClearHistory: () => Promise<void>;
    /** Keep the local title and refresh action when no application header owns them. */
    showPageHeader?: boolean;
    /** Show the page description inside an application-owned body surface. */
    showBodyDescription?: boolean;
    /** Opens the existing add-agent flow when controlled by an application host. */
    adding?: boolean;
  } = $props();
  const addInputId = "community-agents-add-public-key";
  const roomSearchId = "community-agents-room-search";
  let clearing = $state(false);
  let addingPending = $state(false);
  let feedback = $state("");
  let addFeedback = $state("");
  let agentPublicKey = $state("");
  let agentName = $state("");
  let agentDescription = $state("");
  let agentInstructions = $state("");
  let avatarUrl = $state("");
  let personaSlug = $state("");
  let nameMode = $state<CommunityAgentNameMode>("instance");
  let addMode = $state<"create" | "existing">("create");
  let provisioningMode = $state<"managed" | "existing">("managed");
  let selectedPersonaSlug = $state("");
  let selectedGroupIds = $state<string[]>([]);
  let roomQuery = $state("");
  let managedBundle = $state<CommunityAgentControllerBootstrap>();
  let managedRoomFailures = $state<string[]>([]);
  let managedActionPending = $state("");
  let agentToRevoke = $state("");
  let agentToDelete = $state("");
  let personaToDelete = $state("");
  let personaOpen = $state(false);
  let personaPending = $state(false);
  let personaFeedback = $state("");
  let editorSlug = $state("");
  let editorName = $state("");
  let editorDescription = $state("");
  let editorAvatarUrl = $state("");
  let editorSystemPrompt = $state("");
  let agentEditorOpen = $state(false);
  let agentToEdit = $state<CommunityAgentIdentity>();
  let clearTrigger = $state<HTMLButtonElement | null>(null);
  let addTrigger = $state<HTMLButtonElement | null>(null);
  let directory = $state<HTMLElement>();
  const addable = $derived(
    Boolean(onSaveAgent || onCreateManagedAgent) &&
      model.status !== "loading" &&
      model.status !== "unsupported",
  );
  const managedAvailable = $derived(
    Boolean(model.capabilities.managedAgents && onCreateManagedAgent),
  );
  const normalizedAgentPublicKey = $derived(
    parseAgentPublicKey(agentPublicKey),
  );
  const archived = $derived(
    model.archivedAgents.filter(
      (agent) =>
        !model.agents.some((current) => current.pubkey === agent.pubkey),
    ),
  );
  let savedSetupsOpen = $state(false);
  const setupDrafts = $derived(
    model.setupDrafts ??
      model.personas.filter(
        (persona) =>
          !model.agents.some(
            (agent) => agent.instance?.personaId === persona.slug,
          ),
      ),
  );
  const toastScope = $props.id();
  const previousNotices = new Map<string, string>();
  $effect(() => {
    for (const [kind, message] of Object.entries({
      directory: model.error,
      activity: model.activityError,
      archive: model.archiveError,
      partial:
        model.partial && !model.error
          ? "Some agents could not be loaded. Refresh agents to retry."
          : "",
    })) {
      const id = `${toastScope}-agents-${kind}`;
      if (!message) {
        toast.dismiss(id);
        previousNotices.delete(kind);
      } else if (previousNotices.get(kind) !== message) {
        previousNotices.set(kind, message);
        if (kind === "partial") toast.warning(message, { id });
        else toast.error(message, { id });
      }
    }
  });
  onDestroy(() => {
    for (const kind of previousNotices.keys())
      toast.dismiss(`${toastScope}-agents-${kind}`);
  });
  function continueSetup(persona: CommunityAgentPersona) {
    savedSetupsOpen = false;
    addFeedback = "";
    agentName = persona.displayName;
    agentDescription = persona.description;
    avatarUrl = persona.avatarUrl ?? "";
    agentInstructions = persona.systemPrompt ?? "";
    personaSlug = persona.slug;
    addMode = "create";
    provisioningMode = managedAvailable ? "managed" : "existing";
    adding = true;
  }
  const selectedPersona = $derived(
    model.personas.find((persona) => persona.slug === selectedPersonaSlug),
  );
  const manageableRooms = $derived(rooms.filter((room) => room.canManage));
  const selectedRooms = $derived(
    manageableRooms.filter((room) => selectedGroupIds.includes(room.id)),
  );
  async function addAgent() {
    addFeedback = "";
    if (provisioningMode === "managed") {
      await createManagedAgent();
      return;
    }
    const pubkey = normalizedAgentPublicKey;
    if (!pubkey) {
      addFeedback = "Enter a valid hex or npub public key.";
      return;
    }
    if (model.agents.some((agent) => agent.pubkey === pubkey)) {
      addFeedback = "That agent is already in this directory.";
      return;
    }
    const displayName =
      addMode === "existing"
        ? (selectedPersona?.displayName ?? "")
        : agentName.trim();
    if (!displayName) {
      addFeedback =
        addMode === "existing"
          ? "Choose an agent setup draft."
          : "Enter an agent name.";
      return;
    }
    const slug =
      addMode === "existing"
        ? (selectedPersona?.slug ?? "")
        : personaSlug.trim() ||
          `agent-${crypto.randomUUID().replaceAll("-", "")}`;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) {
      addFeedback = "The saved configuration ID is invalid.";
      return;
    }
    if (!onSaveAgent) {
      addFeedback = "Agent management is unavailable in this runtime.";
      return;
    }
    addingPending = true;
    try {
      await onSaveAgent({
        pubkey,
        personaSlug: slug,
        displayName,
        ...(addMode === "existing"
          ? {
              ...(selectedPersona?.description !== undefined
                ? { description: selectedPersona.description }
                : {}),
              ...(selectedPersona?.avatarUrl !== undefined
                ? { avatarUrl: selectedPersona.avatarUrl }
                : {}),
              ...(selectedPersona?.systemPrompt !== undefined
                ? { systemPrompt: selectedPersona.systemPrompt }
                : {}),
            }
          : {
              description: agentDescription,
              avatarUrl,
              systemPrompt: agentInstructions,
            }),
        nameMode,
        instanceName: displayName,
      });
      adding = false;
      agentPublicKey = "";
      agentName = "";
      agentDescription = "";
      agentInstructions = "";
      avatarUrl = "";
      personaSlug = "";
      nameMode = "instance";
      addMode = "create";
      selectedPersonaSlug = "";
      feedback = "Agent saved. It appears after its profile proves ownership.";
    } catch (error) {
      addFeedback =
        error instanceof Error
          ? error.message
          : "Agent registration could not be saved.";
    } finally {
      addingPending = false;
    }
  }

  async function createManagedAgent() {
    if (!managedAvailable || !onCreateManagedAgent) {
      addFeedback = "This relay does not offer managed agent custody.";
      return;
    }
    const displayName =
      addMode === "existing"
        ? (selectedPersona?.displayName ?? "")
        : agentName.trim();
    if (!displayName) {
      addFeedback =
        addMode === "existing"
          ? "Choose an agent setup draft."
          : "Enter an agent name.";
      return;
    }
    const slug =
      addMode === "existing"
        ? (selectedPersona?.slug ?? "")
        : personaSlug.trim() ||
          `agent-${crypto.randomUUID().replaceAll("-", "")}`;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) {
      addFeedback = "The saved configuration ID is invalid.";
      return;
    }
    addingPending = true;
    try {
      const selectedGroups = selectedRooms.map((room) => ({
        roomId: room.id,
        groupId: room.groupId ?? room.id,
      }));
      const groupIds = selectedGroups.map((room) => room.groupId);
      const bundle = await onCreateManagedAgent({
        personaSlug: slug,
        displayName,
        ...(addMode === "existing"
          ? {
              ...(selectedPersona?.description !== undefined
                ? { description: selectedPersona.description }
                : {}),
              ...(selectedPersona?.avatarUrl !== undefined
                ? { avatarUrl: selectedPersona.avatarUrl }
                : {}),
              ...(selectedPersona?.systemPrompt !== undefined
                ? { systemPrompt: selectedPersona.systemPrompt }
                : {}),
            }
          : {
              description: agentDescription,
              avatarUrl,
              systemPrompt: agentInstructions,
            }),
        nameMode,
        instanceName: displayName,
        groupIds,
      });
      const confirmed: string[] = [];
      const failed: string[] = [];
      for (const { roomId, groupId } of selectedGroups) {
        try {
          if (!onAddAgentToRoom)
            throw new Error("Room membership is unavailable");
          await onAddAgentToRoom(roomId, bundle.agent.pubkey);
          confirmed.push(groupId);
        } catch {
          failed.push(groupId);
        }
      }
      managedBundle = {
        ...bundle,
        confirmedGroups: confirmed,
        requiredLocalChoices: {
          ...bundle.requiredLocalChoices,
          remainingGroups: failed,
        },
      };
      managedRoomFailures = failed;
    } catch (error) {
      addFeedback =
        error instanceof Error
          ? error.message
          : "The managed agent could not be created.";
    } finally {
      addingPending = false;
    }
  }

  function clearManagedSetup() {
    managedBundle = undefined;
    managedRoomFailures = [];
    onClearManagedAgentDraft?.();
  }

  async function copyBundle() {
    if (!managedBundle) return;
    await navigator.clipboard.writeText(JSON.stringify(managedBundle, null, 2));
    feedback = "Controller setup copied.";
  }

  function downloadBundle() {
    if (!managedBundle) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(managedBundle, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `lapis-agent-${managedBundle.agent.pubkey.slice(0, 12)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function replacementSetup(pubkey: string) {
    if (!onCreateReplacement) return;
    managedActionPending = pubkey;
    try {
      managedBundle = await onCreateReplacement(pubkey);
      managedRoomFailures = [];
      adding = true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Replacement setup could not be created.",
      );
    } finally {
      managedActionPending = "";
    }
  }

  let previousOwner = $state("");
  $effect(() => {
    if (previousOwner && ownerPubkey !== previousOwner) clearManagedSetup();
    previousOwner = ownerPubkey;
  });
  $effect(() => {
    if (adding && !managedAvailable && provisioningMode === "managed")
      provisioningMode = "existing";
  });
  $effect(() => {
    if (!agentEditorOpen) agentToEdit = undefined;
  });
  onMount(() => {
    const clear = () => clearManagedSetup();
    window.addEventListener("beforeunload", clear);
    return () => {
      window.removeEventListener("beforeunload", clear);
      clearManagedSetup();
    };
  });

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

  function openPersona(persona: CommunityAgentPersona) {
    personaFeedback = "";
    editorSlug = persona.slug;
    editorName = persona.displayName;
    editorDescription = persona.description;
    editorAvatarUrl = persona.avatarUrl ?? "";
    editorSystemPrompt = persona.systemPrompt ?? "";
    personaOpen = true;
  }

  function openAgentEditor(agent: CommunityAgentIdentity) {
    feedback = "";
    addFeedback = "";
    agentToEdit = agent;
    agentEditorOpen = true;
  }

  async function savePersona() {
    personaFeedback = "";
    const displayName = editorName.trim();
    const slug = editorSlug.trim() || personaSlugFromName(displayName);
    if (!displayName) {
      personaFeedback = "Enter an agent name.";
      return;
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) {
      personaFeedback = "The saved configuration ID is invalid.";
      return;
    }
    if (!onSavePersona) {
      personaFeedback = "Agent management is unavailable in this runtime.";
      return;
    }
    personaPending = true;
    try {
      await onSavePersona({
        personaSlug: slug,
        displayName,
        description: editorDescription,
        avatarUrl: editorAvatarUrl,
        systemPrompt: editorSystemPrompt,
      });
      personaOpen = false;
      feedback = `Persona ${slug} saved.`;
    } catch (error) {
      personaFeedback =
        error instanceof Error
          ? error.message
          : "The persona could not be saved.";
    } finally {
      personaPending = false;
    }
  }

  function parseAgentPublicKey(value: string): string | undefined {
    const normalized = value.trim();
    if (/^[0-9a-f]{64}$/iu.test(normalized)) return normalized.toLowerCase();
    if (!normalized.toLowerCase().startsWith("npub1")) return undefined;
    try {
      const decoded = nip19.decode(normalized);
      return decoded.type === "npub" && typeof decoded.data === "string"
        ? decoded.data
        : undefined;
    } catch {
      return undefined;
    }
  }
</script>

<section
  bind:this={directory}
  tabindex="-1"
  class="agents"
  class:agents--body-header={!showPageHeader}
  aria-label="Your agents"
>
  {#if showPageHeader}
    <header>
      <div>
        <h1>Agents</h1>
        <p>Your registered agents in this community.</p>
      </div>
      <Button
        variant="outline"
        onclick={() => void onRefresh()}
        disabled={model.status === "loading"}
        ><RefreshIcon aria-hidden="true" />Refresh agents</Button
      >
    </header>
  {/if}
  {#if showBodyDescription}
    <p class="agents__description">Your registered agents in this community.</p>
  {/if}
  {#if model.status === "loading" && model.agents.length === 0}<CommunitySkeleton
      layout="gallery"
      label="Loading your agents"
    />
  {:else if model.agents.length === 0 && !addable}
    <div class="agents__empty">
      <BotIcon aria-hidden="true" />
      <h2>
        {model.status === "error" || model.status === "offline"
          ? "Agent directory unavailable"
          : model.status === "unsupported"
            ? "Agent discovery is unavailable on this relay"
            : "No registered agents yet"}
      </h2>
      <p>
        Agents appear after their signed owner profile and discovery record are
        published to this community.
      </p>
    </div>
  {:else}
    <div class="agents__grid">
      <button
        bind:this={addTrigger}
        class="agents__add-card"
        type="button"
        aria-label={addable ? "Add agent" : "Agent registration unavailable"}
        disabled={!addable}
        onclick={() => {
          addFeedback = "";
          adding = true;
        }}
      >
        <PlusIcon aria-hidden="true" />
        <span>Add agent</span>
      </button>
      {#each model.agents as agent (agent.pubkey)}
        <div class="agents__card">
          <button
            class="agents__card-open"
            aria-label={`View ${agent.name}`}
            onclick={() => onProfile(agent.pubkey)}
          ></button>
          <div class="agents__avatar">
            <div class="agents__avatar-content">
              <CommunityMemberAvatar
                member={communityAgentMember(agent)}
                size="xlarge"
                shape="rounded"
                showPresence
                presence={model.presence[agent.pubkey]?.status ?? "unknown"}
              />
              {#if onLoadProcessing && onSetProcessing}
                <div class="agents__processing">
                  <CommunityAgentProcessingControl
                    presentation="card"
                    agentPubkey={agent.pubkey}
                    state={model.processing?.[agent.pubkey]}
                    connected={model.status !== "offline" &&
                      model.status !== "unsupported"}
                    onLoad={() => onLoadProcessing!(agent.pubkey)}
                    onSet={(enabled, revision) =>
                      onSetProcessing!(agent.pubkey, enabled, revision)}
                  />
                </div>
              {/if}
            </div>
          </div>
          <div class="agents__details">
            <strong>{agent.name}</strong>
            <span class="agents__about"
              >{model.runtime?.[agent.pubkey]?.effective.model ||
                "Default model"}</span
            >
            {#if model.working[agent.pubkey]}
              <Reasoning label="Working" streaming />
            {/if}
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  class="agents__card-menu"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${agent.name}`}
                >
                  <MoreIcon aria-hidden="true" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="agents__card-actions" align="end">
              <DropdownMenu.Group>
                {#if onSaveAgent}
                  <DropdownMenu.Item onSelect={() => openAgentEditor(agent)}>
                    <PencilIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Edit agent
                  </DropdownMenu.Item>
                {/if}
                <DropdownMenu.Item onSelect={() => onActivity(agent.pubkey)}>
                  <ActivityIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />Activity log
                </DropdownMenu.Item>
                {#if agent.custody && onCreateReplacement}
                  <DropdownMenu.Item
                    disabled={managedActionPending === agent.pubkey}
                    onSelect={() => void replacementSetup(agent.pubkey)}
                  >
                    <DownloadIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Create replacement setup
                  </DropdownMenu.Item>
                {/if}
                {#if agent.custody && onRevokeManagedAgent}
                  <DropdownMenu.Item
                    onSelect={() => (agentToRevoke = agent.pubkey)}
                    ><ShieldOffIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Revoke controller access</DropdownMenu.Item
                  >
                {/if}
                {#if agent.custody && onDeleteManagedAgent}
                  <DropdownMenu.Item
                    variant="destructive"
                    onSelect={() => (agentToDelete = agent.pubkey)}
                    ><TrashIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Delete</DropdownMenu.Item
                  >
                {/if}
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          {#if agent.personaStatus === "unresolved"}<Button
              class="agents__restore"
              variant="ghost"
              onclick={() => openAgentEditor(agent)}
              >Restore configuration</Button
            >{/if}
        </div>
      {/each}
    </div>
  {/if}
  {#if archived.length > 0}
    <section class="agents__history" aria-label="Previously saved agents">
      <h2>Saved activity</h2>
      <p>History from agents previously verified on this device.</p>
      {#each archived as agent (agent.pubkey)}<Button
          variant="outline"
          onclick={() => onActivity(agent.pubkey)}
          >{agent.name}<CommunityChip size="compact">Historical</CommunityChip
          ></Button
        >{/each}
    </section>
  {/if}
  {#if model.archivedAgents.length > 0}
    <footer>
      <p>
        {model.storageMode === "memory"
          ? "History is kept for this session only. Persistent browser storage is unavailable."
          : "Encrypted activity stays on this device until you clear it."}
      </p>
      <Button
        bind:ref={clearTrigger}
        variant="destructive"
        onclick={() => {
          feedback = "";
          clearing = true;
        }}><TrashIcon aria-hidden="true" />Clear all saved activity</Button
      >
    </footer>
  {/if}
  {#if feedback && !clearing}<p role="status">{feedback}</p>{/if}
</section>

<CommunityAgentEditorDialog
  {members}
  {memberResults}
  {onSearchMembers}
  bind:open={agentEditorOpen}
  agent={agentToEdit}
  personas={model.personas}
  runtime={agentToEdit ? model.runtime?.[agentToEdit.pubkey] : undefined}
  connected={model.status !== "offline" && model.status !== "unsupported"}
  onSaveAgent={async (input) => {
    if (!onSaveAgent) throw new Error("Persona management is unavailable.");
    await onSaveAgent(input);
    feedback = "Agent changes saved.";
  }}
  onSaveRuntime={agentToEdit && onSaveRuntime
    ? async (defaults) => {
        const agent = agentToEdit;
        if (!agent) throw new Error("Choose an agent to edit.");
        const next = await onSaveRuntime(agent.pubkey, defaults);
        feedback = "Runtime defaults saved.";
        return next;
      }
    : undefined}
  onUnlinkPersona={agentToEdit && onUnlinkPersona
    ? async (fallbackName) => {
        const agent = agentToEdit;
        if (!agent) throw new Error("Choose an agent to edit.");
        await onUnlinkPersona(agent.pubkey, fallbackName);
        feedback = "Persona unlinked.";
      }
    : undefined}
  onDeletePersona={onDeletePersona
    ? async (slug) => {
        await onDeletePersona(slug);
        feedback = `Persona ${slug} deleted.`;
      }
    : undefined}
/>

<Dialog.Root
  bind:open={adding}
  onOpenChange={(open) => {
    if (!open) {
      clearManagedSetup();
      savedSetupsOpen = false;
    }
  }}
>
  <DialogFrame
    title={managedBundle
      ? "Controller setup"
      : savedSetupsOpen
        ? "Saved agent setups"
        : provisioningMode === "managed"
          ? "Create managed agent"
          : "Link existing agent"}
    description={managedBundle
      ? "Save this setup once. Community will clear it when the dialog closes."
      : savedSetupsOpen
        ? "Continue an unfinished agent setup or delete saved instructions you no longer need."
        : provisioningMode === "managed"
          ? "The relay creates and safeguards the agent identity while you control its instructions and room access."
          : "Save agent instructions and link an existing Nostr agent."}
    descriptionHidden
    size="large"
    surface="inset"
    busy={addingPending}
    closeLabel="Close add agent dialog"
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      (addTrigger ?? directory)?.focus({ preventScroll: true });
    }}
  >
    {#snippet sidebar()}
      <nav class="agents__add-options" aria-label="Agent add options">
        <Button
          variant={!savedSetupsOpen && provisioningMode === "managed"
            ? "default"
            : "ghost"}
          aria-current={!savedSetupsOpen && provisioningMode === "managed"
            ? "page"
            : undefined}
          disabled={!managedAvailable}
          onclick={() => {
            provisioningMode = "managed";
            savedSetupsOpen = false;
          }}><ShieldCheckIcon aria-hidden="true" />Create managed agent</Button
        >
        <Button
          variant={!savedSetupsOpen && provisioningMode === "existing"
            ? "default"
            : "ghost"}
          aria-current={!savedSetupsOpen && provisioningMode === "existing"
            ? "page"
            : undefined}
          onclick={() => {
            provisioningMode = "existing";
            savedSetupsOpen = false;
          }}><LinkIcon aria-hidden="true" />Link existing agent</Button
        >
        {#if setupDrafts.length > 0 || savedSetupsOpen}
          <Button
            variant={savedSetupsOpen ? "default" : "ghost"}
            aria-current={savedSetupsOpen ? "page" : undefined}
            disabled={addingPending || Boolean(managedBundle)}
            onclick={() => (savedSetupsOpen = true)}
            ><FileTextIcon aria-hidden="true" />Saved setups</Button
          >
        {/if}
      </nav>
    {/snippet}
    {#if managedBundle}
      <section class="agents__setup" aria-label="One-time controller setup">
        <div class="agents__setup-state">
          <ShieldCheckIcon aria-hidden="true" />
          <div>
            <strong>Agent active and held by this relay</strong>
            <p>{managedBundle.agent.pubkey}</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Owner</dt>
            <dd>{managedBundle.agent.ownerPubkey}</dd>
          </div>

          <div>
            <dt>Invitation expires</dt>
            <dd>
              {new Date(
                managedBundle.custody.invitationExpiresAt,
              ).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Room access</dt>
            <dd>
              {managedBundle.confirmedGroups.length === 0
                ? "No rooms confirmed"
                : managedBundle.confirmedGroups.join(", ")}
            </dd>
          </div>
        </dl>
        {#if managedRoomFailures.length > 0}
          <p role="alert">
            The identity was created, but room access failed for:
            {managedRoomFailures.join(", ")}. Add it from the room member list
            later.
          </p>
        {/if}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex: the overflowing JSON region must be keyboard-scrollable -->
        <pre tabindex="0" aria-label="Controller setup JSON">{JSON.stringify(
            managedBundle,
            null,
            2,
          )}</pre>
        <p>
          Choose <code>hostId</code>, <code>runtimeAgent</code>, and any
          remaining groups locally before adding this entry to the controller.
          Community does not choose a workspace, runtime, model, or thinking
          level.
        </p>
      </section>
    {:else if savedSetupsOpen}
      <section class="agents__saved-setups" aria-label="Saved agent setups">
        <p>
          Saved instructions from unfinished setup or an earlier configuration.
          These are not running agents.
        </p>
        {#if setupDrafts.length === 0}
          <p>No saved setups.</p>
        {:else}
          <ul>
            {#each setupDrafts as persona (persona.slug)}
              <li>
                <CommunityMemberAvatar
                  member={communityPersonaMember(persona)}
                  size="small"
                  shape="rounded"
                />
                <strong>{persona.displayName}</strong>
                <div class="agents__saved-setup-actions">
                  <Button
                    variant="outline"
                    disabled={!addable || model.status === "offline"}
                    onclick={() => continueSetup(persona)}
                    >Continue setup</Button
                  >
                  <ConfirmButton
                    title={`Delete ${persona.displayName} setup?`}
                    description="This deletes these saved instructions. Existing agents are kept, and linked configurations cannot be deleted here."
                    confirmLabel="Delete setup"
                    destructive
                    variant="ghost"
                    disabled={!onDeletePersona ||
                      model.status === "offline" ||
                      model.status === "loading" ||
                      model.status === "unsupported"}
                    onConfirm={async () => {
                      try {
                        await onDeletePersona!(persona.slug);
                        toast.success("Saved setup deleted.");
                      } catch (cause) {
                        toast.error(
                          cause instanceof Error
                            ? cause.message
                            : "Could not delete this saved setup. Retry to try again.",
                        );
                        return false;
                      }
                    }}>Delete setup</ConfirmButton
                  >
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else}<form
        id="community-agent-add-form"
        class="agents__add-form"
        onsubmit={(event) => {
          event.preventDefault();
          void addAgent();
        }}
      >
        <div class="agents__add-visual">
          {#if addMode === "create"}
            <CommunityAvatarPicker
              bind:value={avatarUrl}
              label="Choose agent image"
              disabled={addingPending}
            />
          {:else if selectedPersona}
            <div class="agents__selected-persona">
              <CommunityMemberAvatar
                member={communityPersonaMember(selectedPersona)}
                size="xlarge"
                shape="rounded"
              />
              <strong>{selectedPersona.displayName}</strong>
              <span>{selectedPersona.slug}</span>
            </div>
          {/if}
        </div>
        <div class="agents__add-fields">
          {#if provisioningMode === "managed"}
            <div class="agents__custody-note">
              <ShieldCheckIcon aria-hidden="true" />
              <p>
                The agent secret stays encrypted at the relay. The downloaded
                NIP-46 client secret lets one controller request only the
                allowed agent actions.
              </p>
            </div>
          {/if}
          <Field.Group>
            <Field.Field
              ><Field.Label for="community-agents-add-name"
                >Agent name</Field.Label
              ><Input
                id="community-agents-add-name"
                bind:value={agentName}
                placeholder="Fizz"
              /></Field.Field
            >
            <Field.Field
              ><Field.Label>Description <span>Optional</span></Field.Label
              ><CommunityChatComposer
                mode="form"
                bind:value={agentDescription}
                ariaLabel="Agent description"
                placeholder="What this agent does, in a sentence"
              /><Field.Description
                >Shown publicly on the agent's card and profile.</Field.Description
              ></Field.Field
            >
            <Field.Field
              ><Field.Label>Saved system prompt</Field.Label
              ><CommunityChatComposer
                mode="form"
                bind:value={agentInstructions}
                placeholder="Describe what this agent should do."
                ariaLabel="Agent instructions"
              /><Field.Description
                >A configured controller applies changes before the agent’s next
                idle turn.</Field.Description
              ></Field.Field
            >
            {#if provisioningMode === "existing"}<Field.Field
                data-invalid={addFeedback ? "" : undefined}
                ><Field.Label for={addInputId}>Agent public key</Field.Label
                ><Input
                  id={addInputId}
                  bind:value={agentPublicKey}
                  aria-invalid={addFeedback ? "true" : undefined}
                  autocomplete="off"
                  placeholder="npub1… or 64-character hex"
                /><Field.Description
                  >Discovery is saved with your signer, then verified against
                  the agent's own profile.</Field.Description
                >{#if addFeedback}<Field.Error>{addFeedback}</Field.Error
                  >{/if}</Field.Field
              >{/if}
            {#if provisioningMode === "managed" && manageableRooms.length > 0}
              <Field.Field>
                <Field.Label for={roomSearchId}
                  >Room access <span>Optional</span></Field.Label
                >
                <div
                  class="agents__room-picker"
                  onfocusin={(event) =>
                    event.currentTarget.scrollIntoView({ block: "end" })}
                >
                  <CommandView.Root label="Search channels" loop>
                    <CommandView.Input
                      id={roomSearchId}
                      bind:value={roomQuery}
                      aria-label="Search channels"
                      placeholder="Search channels…"
                      disabled={addingPending}
                    />
                    <CommandView.List>
                      <CommandView.Empty
                        >No matching channels.</CommandView.Empty
                      >
                      <CommandView.Group heading="Channels you manage">
                        {#each manageableRooms as room (room.id)}
                          <CommandView.Item
                            value={room.id}
                            keywords={[room.name]}
                            disabled={addingPending}
                            data-active={selectedGroupIds.includes(room.id)
                              ? ""
                              : undefined}
                            onSelect={() => {
                              selectedGroupIds = selectedGroupIds.includes(
                                room.id,
                              )
                                ? selectedGroupIds.filter(
                                    (id) => id !== room.id,
                                  )
                                : [...selectedGroupIds, room.id];
                              roomQuery = "";
                            }}
                          >
                            <CommandView.ItemIcon>
                              {#if room.isProjectChannel}
                                <CommunityProjectChannelIcon />
                              {:else}
                                <HashIcon aria-hidden="true" />
                              {/if}
                            </CommandView.ItemIcon>
                            <CommandView.ItemLabel
                              >{room.name}</CommandView.ItemLabel
                            >
                            {#if selectedGroupIds.includes(room.id)}
                              <CheckIcon
                                class="agents__room-selected-icon"
                                aria-label={`${room.name} selected`}
                              />
                            {/if}
                          </CommandView.Item>
                        {/each}
                      </CommandView.Group>
                    </CommandView.List>
                  </CommandView.Root>
                </div>
                <Field.Description>
                  {selectedRooms.length > 0
                    ? `${selectedRooms.length} ${selectedRooms.length === 1 ? "channel" : "channels"} selected: ${selectedRooms.map((room) => `#${room.name}`).join(", ")}`
                    : "Choose channels where you can manage members."}
                  Creating an agent does not grant roles or implicit membership.
                </Field.Description>
              </Field.Field>
            {/if}
            {#if addFeedback}<Field.Error>{addFeedback}</Field.Error>{/if}
          </Field.Group>
        </div>
      </form>{/if}
    {#snippet footer()}
      {#if managedBundle}
        <Button
          type="button"
          variant="outline"
          onclick={() => void copyBundle()}
          ><CopyIcon aria-hidden="true" />Copy</Button
        >
        <Button type="button" variant="outline" onclick={downloadBundle}
          ><DownloadIcon aria-hidden="true" />Download</Button
        >
        <Button type="button" onclick={() => (adding = false)}>Done</Button>
      {:else if savedSetupsOpen}<Button
          type="button"
          variant="outline"
          onclick={() => (adding = false)}>Close</Button
        >
      {:else}<Button
          type="button"
          variant="outline"
          disabled={addingPending}
          onclick={() => (adding = false)}>Cancel</Button
        >
        <Button
          type="submit"
          form="community-agent-add-form"
          disabled={addingPending}
          >{addingPending
            ? provisioningMode === "managed"
              ? "Creating…"
              : "Adding…"
            : provisioningMode === "managed"
              ? "Create managed agent"
              : "Link agent"}</Button
        >{/if}
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<ConfirmDialog
  open={Boolean(agentToRevoke)}
  title="Revoke controller access?"
  description="The current controller can no longer sign for this agent. The agent identity and room memberships remain available."
  confirmLabel="Revoke access"
  destructive
  onOpenChange={(open) => {
    if (!open) agentToRevoke = "";
  }}
  onConfirm={async () => {
    if (!agentToRevoke || !onRevokeManagedAgent) return;
    const pubkey = agentToRevoke;
    await onRevokeManagedAgent(pubkey);
    agentToRevoke = "";
    feedback = "Controller access revoked.";
  }}
/>
<ConfirmDialog
  open={Boolean(agentToDelete)}
  title="Delete this managed agent?"
  description="This destroys the relay-held agent key and revokes every controller connection. Existing events remain signed history, but the identity cannot be used again."
  confirmLabel="Delete managed agent"
  destructive
  onOpenChange={(open) => {
    if (!open) agentToDelete = "";
  }}
  onConfirm={async () => {
    if (!agentToDelete || !onDeleteManagedAgent) return;
    const pubkey = agentToDelete;
    await onDeleteManagedAgent(pubkey);
    agentToDelete = "";
    feedback = "Managed agent deleted.";
  }}
/>
<ConfirmDialog
  bind:open={clearing}
  title="Clear all saved agent activity?"
  description="This removes this account’s saved activity for this community from this device. It cannot be recovered from the relay."
  confirmLabel="Clear history"
  destructive
  onConfirm={async () => {
    await onClearHistory();
    feedback = "Saved activity cleared on this device.";
  }}
  onCloseAutoFocus={(event) => {
    event.preventDefault();
    (clearTrigger ?? directory)?.focus({ preventScroll: true });
  }}
/>

<style>
  .agents {
    max-width: 76rem;
    padding: 1rem;
    display: grid;
    gap: 1.75rem;
    margin-inline: auto;
  }
  .agents--body-header {
    max-width: none;
    padding-top: 1rem;
    margin-inline: 0;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    font-size: var(--community-text-page);
    font-weight: 650;
    letter-spacing: -0.035em;
  }
  h2 {
    font-size: var(--community-text-section);
    font-weight: 600;
  }
  p {
    color: var(--muted-foreground);
    line-height: 1.6;
  }
  header p {
    margin-top: 0.35rem;
  }
  .agents__description {
    max-width: 40rem;
  }
  .agents__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
    gap: 1rem;
  }
  .agents__add-card {
    aspect-ratio: 4 / 5;
    min-width: 0;
    border: 1px dashed var(--border);
    border-radius: 1rem;
    background: transparent;
    color: var(--muted-foreground);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 3px color-mix(in oklab, var(--foreground) 5%, transparent);
    transition:
      background-color 150ms,
      border-color 150ms,
      color 150ms;
  }
  .agents__add-card:hover {
    border-color: color-mix(in oklab, var(--border) 70%, var(--foreground));
    background: color-mix(in oklab, var(--muted) 70%, transparent);
    color: var(--foreground);
  }
  .agents__add-card:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .agents__add-card:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .agents__add-card :global(svg) {
    width: 2rem;
    height: 2rem;
  }
  .agents__card {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    position: relative;
    min-width: 0;
    aspect-ratio: 4 / 5;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: color-mix(in oklab, var(--muted) 50%, var(--background));
    box-shadow: 0 1px 3px color-mix(in oklab, var(--foreground) 7%, transparent);
    transition:
      background-color 150ms,
      border-color 150ms;
  }
  .agents__card-open {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    height: 100%;
    padding: 1rem;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .agents__card:hover {
    background: color-mix(in oklab, var(--muted) 75%, var(--background));
  }
  .agents__card-open:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .agents__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 9rem;
    flex: 1;
    padding-bottom: 0.75rem;
  }
  .agents__avatar-content {
    position: relative;
  }
  .agents__processing {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: 0;
    transform: translate(-50%, 50%);
  }
  :global(.agents__restore) {
    position: relative;
    z-index: 2;
  }
  .agents__details {
    display: grid;
    gap: 0.25rem;
    justify-items: start;
    width: 100%;
    min-width: 0;
  }
  .agents__details strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--community-text-section);
    font-weight: 600;
  }
  .agents__about {
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
    line-height: 1.4;
    min-height: 1.4em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  :global(.agents__card-menu) {
    z-index: 2;
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    border-radius: 0.5rem;
  }
  :global(.agents__card-actions) {
    width: 12rem;
    max-width: calc(100vw - 2rem);
  }
  .agents__empty {
    min-height: 17rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 1rem;
    padding: 2rem;
  }
  .agents__empty :global(svg) {
    width: 2rem;
    height: 2rem;
    color: var(--muted-foreground);
  }
  .agents__empty p {
    max-width: 34rem;
  }
  .agents__history {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .agents__saved-setups {
    display: grid;
    gap: 1rem;
  }
  .agents__saved-setups ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.75rem;
  }
  .agents__saved-setups li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .agents__saved-setups li strong {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .agents__saved-setup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agents__selected-persona span {
    color: var(--muted-foreground);
  }
  .agents__history h2,
  .agents__history p {
    flex-basis: 100%;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    border-top: 1px solid var(--border);
    padding-top: 1.25rem;
    font-size: var(--community-text-body);
  }

  .agents__add-form {
    display: grid;
    grid-template-columns: 12rem minmax(24rem, 1fr);
    gap: 2rem;
    align-items: start;
  }
  .agents__add-visual {
    min-width: 0;
  }
  .agents__add-fields {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .agents__add-options {
    display: grid;
    gap: 0.5rem;
  }
  .agents__custody-note,
  .agents__setup-state {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: color-mix(in oklab, var(--muted) 65%, transparent);
  }
  .agents__custody-note :global(svg),
  .agents__setup-state :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
    color: var(--primary);
  }
  .agents__room-picker {
    --ui-command-view-list-max-height: 12rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
    scroll-margin-block-end: 5rem;
  }
  :global(.agents__room-selected-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .agents__setup {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .agents__setup-state p,
  .agents__setup dd,
  .agents__setup pre {
    overflow-wrap: anywhere;
  }
  .agents__setup dl {
    display: grid;
    gap: 0.65rem;
    margin: 0;
  }
  .agents__setup dl div {
    display: grid;
    grid-template-columns: minmax(8rem, 0.35fr) minmax(0, 1fr);
    gap: 0.75rem;
  }
  .agents__setup dt {
    color: var(--muted-foreground);
  }
  .agents__setup dd {
    margin: 0;
  }
  .agents__setup pre {
    max-height: 18rem;
    overflow: auto;
    margin: 0;
    padding: 0.85rem;
    border-radius: 0.75rem;
    background: var(--muted);
    font-size: var(--community-text-secondary);
  }
  .agents__selected-persona {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.5rem;
    text-align: center;
  }

  @media (max-width: 40rem) {
    .agents__add-form {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
