<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import { nip19 } from "nostr-tools";
  import BotIcon from "@lucide/svelte/icons/bot";
  import LinkIcon from "@lucide/svelte/icons/link-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
  import XIcon from "@lucide/svelte/icons/x";
  import MoreIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import ActivityIcon from "@lucide/svelte/icons/wrench";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type { CommunityAgentsState } from "../../community/agent-contracts.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityAgentMember } from "./model.js";

  const avatarEmojis = [
    "😀",
    "😎",
    "🤓",
    "🤖",
    "🐝",
    "✨",
    "🚀",
    "💡",
  ] as const;
  const avatarColors = [
    "#f5d90a",
    "#ff8a4c",
    "#e5484d",
    "#ab4aba",
    "#6e56cf",
    "#0091ff",
    "#30a46c",
    "#687076",
  ] as const;

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
  let pending = $state(false);
  let addingPending = $state(false);
  let feedback = $state("");
  let addFeedback = $state("");
  let agentPublicKey = $state("");
  let agentName = $state("");
  let agentDescription = $state("");
  let agentInstructions = $state("");
  let avatarPickerOpen = $state(false);
  let avatarMode = $state("image");
  let avatarUrl = $state("");
  let avatarFileName = $state("");
  let avatarColor = $state<(typeof avatarColors)[number]>(avatarColors[4]);
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
  async function clear() {
    pending = true;
    feedback = "";
    try {
      await onClearHistory();
      clearing = false;
      feedback = "Saved activity cleared on this device.";
    } catch (error) {
      feedback =
        error instanceof Error
          ? error.message
          : "History could not be cleared.";
    } finally {
      pending = false;
    }
  }
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
      avatarPickerOpen = false;
      avatarUrl = "";
      avatarFileName = "";
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

  function readAvatarImage(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addFeedback = "Choose an image file.";
      return;
    }
    if (file.size > 1024 * 1024) {
      addFeedback = "Choose an image smaller than 1 MB.";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        avatarUrl = reader.result;
        avatarFileName = file.name;
        addFeedback = "";
      }
    });
    reader.addEventListener("error", () => {
      addFeedback = "The image could not be read.";
    });
    reader.readAsDataURL(file);
  }

  function setEmojiAvatar(emoji: string): void {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="128" fill="${avatarColor}"/><text x="128" y="166" font-size="128" text-anchor="middle">${emoji}</text></svg>`;
    avatarUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    avatarFileName = "";
    addFeedback = "";
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
  {#if model.status === "loading"}<p role="status">Loading your agents…</p>
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
  <Dialog.Content
    class="agents__add-content"
    showCloseButton={false}
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      (addTrigger ?? directory)?.focus({ preventScroll: true });
    }}
    onInteractOutside={(event) => {
      if (addingPending) event.preventDefault();
    }}
    onEscapeKeydown={(event) => {
      if (addingPending) event.preventDefault();
    }}
  >
    <header class="agents__add-header">
      <Dialog.Title>Add agent</Dialog.Title>
      <Button
        class="agents__close"
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Close add agent dialog"
        disabled={addingPending}
        onclick={() => (adding = false)}
        ><XIcon class="size-3.5" aria-hidden="true" /></Button
      >
    </header>
    <div class="agents__add-shell">
      <aside class="agents__add-rail" aria-label="Agent add options">
        <button class="agents__add-mode" type="button" aria-current="page">
          <PlusIcon aria-hidden="true" />
          Create agent
        </button>
        <button class="agents__add-mode" type="button" disabled>
          <UploadCloudIcon aria-hidden="true" />
          Import
        </button>
      </aside>
      <form
        class="agents__add-dialog"
        onsubmit={(event) => {
          event.preventDefault();
          void addAgent();
        }}
      >
        <ScrollArea
          class="agents__add-scroll"
          orientation="vertical"
          type="always"
        >
          <div class="agents__add-scroll-content">
            <div class="agents__add-picker">
              <button
                class="agents__add-preview"
                type="button"
                aria-label="Choose agent image"
                onclick={() => (avatarPickerOpen = !avatarPickerOpen)}
              >
                {#if avatarUrl}
                  <img src={avatarUrl} alt="" />
                {:else}
                  <PlusIcon aria-hidden="true" />
                {/if}
              </button>
              {#if avatarPickerOpen}
                <div
                  class="agents__avatar-popover"
                  role="dialog"
                  aria-label="Agent image picker"
                >
                  <Tabs.Root
                    bind:value={avatarMode}
                    class="agents__avatar-tabs"
                  >
                    <Tabs.List aria-label="Agent image type">
                      <Tabs.Trigger value="image">Image</Tabs.Trigger>
                      <Tabs.Trigger value="emoji">Emoji</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="image">
                      <label class="agents__image-drop">
                        <UploadCloudIcon aria-hidden="true" />
                        <span>{avatarFileName || "Drop or browse"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          aria-label="Upload agent image"
                          onchange={readAvatarImage}
                        />
                      </label>
                      <div class="agents__url-input">
                        <LinkIcon aria-hidden="true" />
                        <Input
                          type="url"
                          bind:value={avatarUrl}
                          aria-label="Agent image URL"
                          placeholder="Paste a URL"
                        />
                      </div>
                    </Tabs.Content>
                    <Tabs.Content value="emoji">
                      <div
                        class="agents__avatar-colors"
                        aria-label="Avatar background"
                      >
                        {#each avatarColors as color (color)}
                          <button
                            type="button"
                            aria-label={`Use ${color} background`}
                            aria-pressed={avatarColor === color}
                            style={`--avatar-color: ${color}`}
                            onclick={() => (avatarColor = color)}
                          ></button>
                        {/each}
                      </div>
                      <div
                        class="agents__avatar-emojis"
                        aria-label="Choose an emoji"
                      >
                        {#each avatarEmojis as emoji (emoji)}
                          <button
                            type="button"
                            aria-label={`Use ${emoji} as agent image`}
                            onclick={() => setEmojiAvatar(emoji)}
                            >{emoji}</button
                          >
                        {/each}
                        <CommunityEmojiPicker
                          label="Choose another agent emoji"
                          onSelect={(emoji) => setEmojiAvatar(emoji)}
                        />
                      </div>
                    </Tabs.Content>
                  </Tabs.Root>
                </div>
              {/if}
            </div>
            <div class="agents__add-fields">
              <Field.Group>
                <Dialog.Description class="sr-only">
                  Register an existing Nostr agent in this community. The agent
                  appears after its signed profile proves ownership.
                </Dialog.Description>
                <Field.Field>
                  <Field.Label for="community-agents-add-name"
                    >Agent name</Field.Label
                  >
                  <Input
                    id="community-agents-add-name"
                    bind:value={agentName}
                    placeholder="Fizz"
                  />
                </Field.Field>
                <Field.Field>
                  <Field.Label for="community-agents-add-description"
                    >Description <span>Optional</span></Field.Label
                  >
                  <Input
                    id="community-agents-add-description"
                    bind:value={agentDescription}
                    placeholder="What this agent does, in a sentence"
                  />
                  <Field.Description>
                    Shown publicly on the agent's card and profile.
                  </Field.Description>
                </Field.Field>
                <Field.Field>
                  <Field.Label>Agent instructions</Field.Label>
                  <CommunityChatComposer
                    class="agents__instructions-composer"
                    bind:value={agentInstructions}
                    placeholder="Describe what this agent should do."
                    ariaLabel="Agent instructions"
                    showSubmitButton={false}
                  />
                </Field.Field>
                <Field.Field data-invalid={addFeedback ? "" : undefined}>
                  <Field.Label for={addInputId}>Agent public key</Field.Label>
                  <Input
                    id={addInputId}
                    bind:value={agentPublicKey}
                    aria-invalid={addFeedback ? "true" : undefined}
                    autocomplete="off"
                    placeholder="npub1… or 64-character hex"
                  />
                  <Field.Description>
                    Discovery is saved with your signer, then verified against
                    the agent's own profile.
                  </Field.Description>
                  {#if addFeedback}<Field.Error>{addFeedback}</Field.Error>{/if}
                </Field.Field>
              </Field.Group>
            </div>
          </div>
        </ScrollArea>
        <Dialog.Footer class="agents__add-footer"
          ><Button
            type="button"
            variant="outline"
            disabled={addingPending}
            onclick={() => (adding = false)}>Cancel</Button
          ><Button type="submit" disabled={addingPending}
            >{addingPending ? "Adding…" : "Add agent"}</Button
          ></Dialog.Footer
        >
      </form>
    </div>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={clearing}>
  <Dialog.Content
    showCloseButton={false}
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      (clearTrigger ?? directory)?.focus({ preventScroll: true });
    }}
    onInteractOutside={(event) => {
      if (pending) event.preventDefault();
    }}
    onEscapeKeydown={(event) => {
      if (pending) event.preventDefault();
    }}
  >
    <Dialog.Header
      ><Dialog.Title>Clear all saved agent activity?</Dialog.Title
      ><Dialog.Description
        >This removes this account’s saved activity for this community from this
        device. It cannot be recovered from the relay.</Dialog.Description
      ></Dialog.Header
    >
    <Button
      class="agents__close"
      variant="ghost"
      size="icon-sm"
      aria-label="Close clear history dialog"
      disabled={pending}
      onclick={() => (clearing = false)}
      ><XIcon class="size-3.5" aria-hidden="true" /></Button
    >
    {#if feedback}<p role="alert">{feedback}</p>{/if}
    <Dialog.Footer
      ><Button
        variant="outline"
        disabled={pending}
        onclick={() => (clearing = false)}>Cancel</Button
      ><Button variant="destructive" disabled={pending} onclick={clear}
        >{pending ? "Clearing…" : "Clear history"}</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>

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
    font-size: 1.9rem;
    font-weight: 650;
    letter-spacing: -0.035em;
  }
  h2 {
    font-size: 1.1rem;
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
    font-size: 1rem;
    font-weight: 600;
  }
  .agents__about {
    color: var(--muted-foreground);
    font-size: 0.85rem;
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
    font-size: 0.85rem;
  }
  :global(.agents__close) {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    border-radius: 0.5rem;
  }
  :global(.agents__add-content) {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0;
    width: min(68rem, calc(100vw - 3rem));
    max-width: min(68rem, calc(100vw - 3rem));
    height: min(48rem, calc(100dvh - 3rem));
    min-height: min(38rem, calc(100dvh - 3rem));
    padding: 0;
    overflow: hidden;
    border-radius: 1.25rem;
  }
  .agents__add-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 4.75rem;
    padding: 1.35rem 1.5rem 1.1rem;
    background: color-mix(in oklab, var(--muted) 36%, var(--background));
  }
  .agents__add-header :global([data-slot="dialog-title"]) {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .agents__add-header :global(.agents__close) {
    position: static;
    flex: none;
  }
  .agents__add-shell {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr);
    min-height: 0;
    background: color-mix(in oklab, var(--muted) 36%, var(--background));
  }
  .agents__add-rail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.75rem 1rem;
  }
  .agents__add-mode {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 0;
    border-radius: 0.75rem;
    padding: 0.8rem 1rem;
    background: transparent;
    color: var(--muted-foreground);
    font: inherit;
    font-weight: 600;
    text-align: left;
  }
  .agents__add-mode[aria-current="page"] {
    background: var(--foreground);
    color: var(--background);
  }
  .agents__add-mode:disabled {
    opacity: 0.6;
  }
  .agents__add-dialog {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0;
    margin: 1.25rem;
    padding: 0;
    border-radius: 1rem;
    background: var(--background);
    overflow: hidden;
  }
  :global(.agents__add-scroll[data-ui-component="scroll-area"]) {
    min-width: 0;
    min-height: 0;
    height: 100%;
  }
  .agents__add-scroll-content {
    display: grid;
    grid-template-columns: 12rem minmax(18rem, 32rem);
    gap: clamp(1.5rem, 3vw, 2.5rem);
    justify-content: center;
    align-content: start;
    min-height: 100%;
    padding: 3rem clamp(1.5rem, 3vw, 2.5rem) 1.5rem;
  }
  .agents__add-picker {
    position: relative;
    grid-column: 1;
    grid-row: 1;
    align-self: start;
    justify-self: center;
    width: 12rem;
    height: 12rem;
  }
  .agents__add-preview {
    display: grid;
    place-items: center;
    width: 12rem;
    aspect-ratio: 1;
    border: 2px dashed color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: 1.75rem;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    overflow: hidden;
  }
  .agents__add-preview :global(svg) {
    width: 3.75rem;
    height: 3.75rem;
  }
  .agents__add-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .agents__add-preview:hover {
    background: color-mix(in oklab, var(--muted) 70%, transparent);
  }
  .agents__add-preview:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .agents__avatar-popover {
    position: absolute;
    z-index: 1;
    top: calc(100% + 0.75rem);
    left: 0;
    width: min(24rem, calc(100vw - 3rem));
    transform: none;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--background);
    box-shadow: 0 1rem 2rem
      color-mix(in oklab, var(--foreground) 12%, transparent);
  }
  :global(.agents__avatar-tabs[data-ui-part="tabs-root"]) {
    display: grid;
    gap: 0.9rem;
  }
  :global(.agents__avatar-tabs [data-ui-part="tabs-list"]) {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-radius: 0.85rem;
    background: var(--muted);
    padding: 0.2rem;
  }
  :global(.agents__avatar-tabs [data-ui-part="tabs-trigger"]) {
    min-height: 3rem;
    border-radius: 0.75rem;
    font-weight: 600;
  }
  :global(
      .agents__avatar-tabs [data-ui-part="tabs-trigger"][data-state="active"]
    ) {
    background: var(--background);
    box-shadow: 0 1px 2px
      color-mix(in oklab, var(--foreground) 10%, transparent);
  }
  .agents__image-drop,
  .agents__url-input {
    min-height: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    border-radius: 0.85rem;
    background: var(--muted);
    color: var(--foreground);
    font-weight: 600;
  }
  .agents__image-drop {
    cursor: pointer;
    margin-bottom: 0.85rem;
  }
  .agents__image-drop input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .agents__url-input {
    justify-content: flex-start;
    padding-inline: 1rem;
    color: var(--muted-foreground);
  }
  .agents__url-input :global(input) {
    border: 0;
    box-shadow: none;
    background: transparent;
    padding-inline: 0;
    font-weight: 500;
  }
  .agents__avatar-colors,
  .agents__avatar-emojis {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agents__avatar-colors {
    margin-bottom: 0.85rem;
  }
  .agents__avatar-colors button {
    width: 2rem;
    height: 2rem;
    border: 2px solid transparent;
    border-radius: 999px;
    background: var(--avatar-color);
  }
  .agents__avatar-colors button[aria-pressed="true"] {
    border-color: var(--foreground);
  }
  .agents__avatar-emojis button {
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--background);
    font-size: 1.25rem;
  }
  .agents__add-fields {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }
  .agents__add-fields :global(p) {
    max-width: 32rem;
  }
  .agents__add-fields :global([data-slot="field-group"]) {
    gap: 1.15rem;
  }
  .agents__add-fields :global(label span) {
    color: var(--muted-foreground);
    font-weight: 400;
  }
  :global(.agents__instructions-composer) {
    min-height: 9rem;
  }
  :global(
      .agents__instructions-composer [data-ui-component="ai-chat-composer"]
    ) {
    min-height: 9rem;
  }
  :global(.agents__add-footer[data-slot="dialog-footer"]) {
    position: static;
    grid-row: 2;
    width: 100%;
    box-sizing: border-box;
    flex-direction: row;
    justify-content: flex-end;
    background: var(--background);
    border-top: 1px solid var(--border);
    padding: 1rem clamp(1.5rem, 3vw, 2.5rem);
  }
  @media (max-width: 760px) {
    :global(.agents__add-content) {
      width: calc(100vw - 1rem);
      max-width: calc(100vw - 1rem);
      height: calc(100dvh - 1rem);
      min-height: calc(100vh - 1rem);
      overflow: auto;
    }
    .agents__add-shell {
      grid-template-columns: 1fr;
      min-height: 0;
    }
    .agents__add-rail {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }
    .agents__add-dialog {
      margin: 0.75rem;
    }
    .agents__add-scroll-content {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
      padding: 2rem 1rem 1rem;
    }
    .agents__add-preview {
      width: 11rem;
    }
    .agents__add-picker {
      grid-column: 1;
      grid-row: 1;
      width: 11rem;
    }
    .agents__add-fields {
      grid-column: 1;
      grid-row: 2;
    }
    .agents__avatar-popover {
      position: static;
      width: 100%;
      transform: none;
      margin-top: 1rem;
    }
    :global(.agents__add-footer[data-slot="dialog-footer"]) {
      grid-row: 2;
      padding-inline: 1rem;
    }
  }
</style>
