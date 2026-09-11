<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import CommunityAvatarPicker from "../community-avatar-picker/CommunityAvatarPicker.svelte";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { nip19 } from "nostr-tools";
  import BotIcon from "@lucide/svelte/icons/bot";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
  import MoreIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import ActivityIcon from "@lucide/svelte/icons/wrench";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type { CommunityAgentsState } from "../../community/agent-contracts.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityAgentMember } from "./model.js";

  let {
    model,
    onProfile,
    onActivity,
    onAddAgent,
    onRefresh,
    onClearHistory,
  }: {
    model: CommunityAgentsState;
    onProfile: (pubkey: string) => void;
    onActivity: (pubkey: string) => void;
    onAddAgent?: (pubkey: string) => Promise<void>;
    onRefresh: () => void | Promise<void>;
    onClearHistory: () => Promise<void>;
  } = $props();
  const addInputId = "community-agents-add-public-key";
  let clearing = $state(false);
  let adding = $state(false);
  let addingPending = $state(false);
  let feedback = $state("");
  let addFeedback = $state("");
  let agentPublicKey = $state("");
  let agentName = $state("");
  let agentDescription = $state("");
  let agentInstructions = $state("");
  let avatarUrl = $state("");
  let clearTrigger = $state<HTMLButtonElement | null>(null);
  let addTrigger = $state<HTMLButtonElement | null>(null);
  let directory = $state<HTMLElement>();
  const addable = $derived(
    Boolean(onAddAgent) &&
      model.status !== "loading" &&
      model.status !== "unsupported",
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
  async function addAgent() {
    addFeedback = "";
    const pubkey = normalizedAgentPublicKey;
    if (!pubkey) {
      addFeedback = "Enter a valid hex or npub public key.";
      return;
    }
    if (model.agents.some((agent) => agent.pubkey === pubkey)) {
      addFeedback = "That agent is already in this directory.";
      return;
    }
    if (!onAddAgent) {
      addFeedback = "Agent registration is unavailable in this runtime.";
      return;
    }
    addingPending = true;
    try {
      await onAddAgent(pubkey);
      adding = false;
      agentPublicKey = "";
      agentName = "";
      agentDescription = "";
      agentInstructions = "";
      avatarUrl = "";
      feedback =
        "Agent registration saved. The agent appears after its profile proves ownership.";
    } catch (error) {
      addFeedback =
        error instanceof Error
          ? error.message
          : "Agent registration could not be saved.";
    } finally {
      addingPending = false;
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
  aria-label="Your agents"
>
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
  {#if model.error}<p role="status">{model.error}</p>{/if}
  {#if model.partial && !model.error}<p role="status">
      Some agents could not be loaded. Refresh agents to retry.
    </p>{/if}
  {#if model.activityError}<p role="alert">{model.activityError}</p>{/if}
  {#if model.archiveError}<p role="alert">{model.archiveError}</p>{/if}
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
          >
            <div class="agents__avatar">
              <CommunityMemberAvatar
                member={communityAgentMember(agent)}
                size="xlarge"
                shape="rounded"
                showPresence
                presence={model.presence[agent.pubkey]?.status ?? "unknown"}
              />
            </div>
            {#if model.working[agent.pubkey]}
              <div class="agents__working">
                <CommunityChip size="compact" tone="accent"
                  >Working</CommunityChip
                >
              </div>
            {/if}
            <div class="agents__details">
              <strong>{agent.name}</strong>
              <span class="agents__about"
                >{agent.about || "Registered agent"}</span
              >
            </div>
          </button>
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
                <DropdownMenu.Item onSelect={() => onActivity(agent.pubkey)}>
                  <ActivityIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />Activity log
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
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

<Dialog.Root bind:open={adding}>
  <DialogFrame
    title="Add agent"
    description="Register an existing Nostr agent in this community. The agent appears after its signed profile proves ownership."
    descriptionHidden
    size="wide"
    busy={addingPending}
    closeLabel="Close add agent dialog"
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      (addTrigger ?? directory)?.focus({ preventScroll: true });
    }}
  >
    {#snippet sidebar()}
      <nav class="agents__add-options" aria-label="Agent add options">
        <Button variant="default" aria-current="page"
          ><PlusIcon aria-hidden="true" />Create agent</Button
        >
        <Button variant="ghost" disabled
          ><UploadCloudIcon aria-hidden="true" />Import</Button
        >
      </nav>
    {/snippet}
    <form
      id="community-agent-add-form"
      class="agents__add-form"
      onsubmit={(event) => {
        event.preventDefault();
        void addAgent();
      }}
    >
      <CommunityAvatarPicker
        bind:value={avatarUrl}
        label="Choose agent image"
        disabled={addingPending}
      />
      <Field.Group>
        <Field.Field
          ><Field.Label for="community-agents-add-name">Agent name</Field.Label
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
          ><Field.Label>Agent instructions</Field.Label><CommunityChatComposer
            mode="form"
            bind:value={agentInstructions}
            placeholder="Describe what this agent should do."
            ariaLabel="Agent instructions"
          /></Field.Field
        >
        <Field.Field data-invalid={addFeedback ? "" : undefined}
          ><Field.Label for={addInputId}>Agent public key</Field.Label><Input
            id={addInputId}
            bind:value={agentPublicKey}
            aria-invalid={addFeedback ? "true" : undefined}
            autocomplete="off"
            placeholder="npub1… or 64-character hex"
          /><Field.Description
            >Discovery is saved with your signer, then verified against the
            agent's own profile.</Field.Description
          >{#if addFeedback}<Field.Error>{addFeedback}</Field.Error
            >{/if}</Field.Field
        >
      </Field.Group>
    </form>
    {#snippet footer()}
      <Button
        type="button"
        variant="outline"
        disabled={addingPending}
        onclick={() => (adding = false)}>Cancel</Button
      >
      <Button
        type="submit"
        form="community-agent-add-form"
        disabled={addingPending}
        >{addingPending ? "Adding…" : "Add agent"}</Button
      >
    {/snippet}
  </DialogFrame>
</Dialog.Root>
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
    padding: clamp(1.25rem, 3vw, 3rem);
    display: grid;
    gap: 1.75rem;
    margin-inline: auto;
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
    min-height: 2.8em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  :global(.agents__card-menu) {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    border-radius: 0.5rem;
  }
  .agents__working {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
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
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: 2rem;
    align-items: start;
  }
  .agents__add-options {
    display: grid;
    gap: 0.5rem;
  }
  @media (max-width: 40rem) {
    .agents__add-form {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
