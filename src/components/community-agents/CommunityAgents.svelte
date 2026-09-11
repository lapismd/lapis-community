<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import BotIcon from "@lucide/svelte/icons/bot";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import XIcon from "@lucide/svelte/icons/x";
  import MoreIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import ActivityIcon from "@lucide/svelte/icons/wrench";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type { CommunityAgentsState } from "../../community/agent-contracts.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityAgentMember } from "./model.js";

  let {
    model,
    onProfile,
    onActivity,
    onRefresh,
    onClearHistory,
  }: {
    model: CommunityAgentsState;
    onProfile: (pubkey: string) => void;
    onActivity: (pubkey: string) => void;
    onRefresh: () => void | Promise<void>;
    onClearHistory: () => Promise<void>;
  } = $props();
  let clearing = $state(false);
  let pending = $state(false);
  let feedback = $state("");
  let clearTrigger = $state<HTMLButtonElement | null>(null);
  let directory = $state<HTMLElement>();
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
  {:else if model.agents.length === 0}
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
</style>
