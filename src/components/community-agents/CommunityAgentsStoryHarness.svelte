<script lang="ts">
  import { untrack } from "svelte";
  import CommunityAgents from "./CommunityAgents.svelte";
  import CommunityAgentProfile from "../community-agent-profile/CommunityAgentProfile.svelte";
  import CommunityAgentActivity from "../community-agent-activity/CommunityAgentActivity.svelte";
  import {
    storyAgent,
    storyAgentState,
    storyAgentRooms,
    storyActivity,
    storyActivityItems,
    storyOwnerPubkey,
    storyGalleryAgents,
  } from "./story-fixtures.js";
  import type {
    CommunityAgentIdentity,
    CommunityAgentPersonaSaveInput,
    CommunityAgentSaveInput,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  let {
    screen = "gallery",
    variant = "ready",
    failAction = false,
    narrow = false,
  }: {
    screen?: "gallery" | "profile" | "activity";
    variant?: string;
    failAction?: boolean;
    narrow?: boolean;
  } = $props();
  let view = $state(untrack(() => screen));
  let notice = $state("");
  let failure = $state(untrack(() => failAction));
  let agent = $state<CommunityAgentIdentity>(storyAgent);
  let model = $state<CommunityAgentsState>(
    untrack(() =>
      storyAgentState({
        ...(variant === "gallery"
          ? {
              agents: storyGalleryAgents,
              presence: {
                [storyAgent.pubkey]: { status: "online" as const },
                [storyGalleryAgents[2]!.pubkey]: { status: "online" as const },
              },
            }
          : {}),
        ...(variant === "loading" ? { status: "loading", agents: [] } : {}),
        ...(variant === "empty"
          ? { agents: [], personas: [], archivedAgents: [] }
          : {}),
        ...(variant === "offline"
          ? {
              status: "offline",
              error: "The agent connection is offline.",
              presence: {},
              working: {},
            }
          : {}),
        ...(variant === "partial"
          ? {
              partial: true,
              error:
                "Some agent profiles could not be loaded. Refresh to retry.",
            }
          : {}),
        ...(variant === "error"
          ? {
              status: "error",
              error: "Agent discovery failed. Refresh to retry.",
            }
          : {}),
        ...(variant === "historical" ? { agents: [] } : {}),
        ...(variant === "memory" ? { storageMode: "memory" } : {}),
        ...(variant === "storage-error"
          ? {
              archiveError:
                "Activity could not be saved. Free storage and retry.",
            }
          : {}),
        ...(variant === "signer-error"
          ? {
              activityError:
                "Activity decryption was declined. Retry with your signer.",
            }
          : {}),
        activityAgent: storyAgent.pubkey,
        activity:
          screen === "activity" && variant !== "empty"
            ? storyActivityItems
            : [],
        hasOlder: screen === "activity" && variant !== "empty",
      }),
    ),
  );
  function attempt() {
    if (failure) {
      failure = false;
      throw new Error("Relay denied the request. Please retry.");
    }
  }
  async function clear() {
    attempt();
    model = { ...model, archivedAgents: [], activity: [], hasOlder: false };
    notice = "Saved history cleared";
  }
  async function saveAgent(input: CommunityAgentSaveInput) {
    attempt();
    notice = `Persona ${input.personaSlug} saved`;
    const { error, ...rest } = model;
    model = { ...rest, partial: false };
  }
  async function savePersona(input: CommunityAgentPersonaSaveInput) {
    attempt();
    notice = `Persona ${input.personaSlug} saved`;
  }
  async function deletePersona(slug: string) {
    attempt();
    model = {
      ...model,
      personas: model.personas.filter((persona) => persona.slug !== slug),
    };
    notice = `Persona ${slug} deleted`;
  }
</script>

<div
  class="agent-story"
  style:max-width={narrow ? "360px" : view === "gallery" ? "none" : "420px"}
>
  {#if notice}<p role="status">{notice}</p>{/if}
  {#if view === "gallery"}
    <CommunityAgents
      {model}
      onProfile={(pubkey) => {
        agent =
          model.agents.find((entry) => entry.pubkey === pubkey) ?? storyAgent;
        view = "profile";
      }}
      onActivity={(pubkey) => {
        agent =
          model.agents.find((entry) => entry.pubkey === pubkey) ??
          model.archivedAgents.find((entry) => entry.pubkey === pubkey) ??
          agent;
        model = { ...model, activityAgent: pubkey };
        view = "activity";
      }}
      onSaveAgent={saveAgent}
      onSavePersona={savePersona}
      onDeletePersona={deletePersona}
      onRefresh={() => {
        model = storyAgentState();
        notice = "Agent directory refreshed";
      }}
      onClearHistory={clear}
    />
  {:else if view === "profile"}
    <CommunityAgentProfile
      {agent}
      personas={model.personas}
      ownerName="steve"
      onOpenOwner={(pubkey) => {
        notice =
          pubkey === storyOwnerPubkey
            ? "Opened steve's profile"
            : "Unknown owner";
      }}
      rooms={variant === "denied"
        ? storyAgentRooms.map(({ permissions, ...room }) => room)
        : storyAgentRooms}
      presence={model.presence[agent.pubkey] ?? { status: "unknown" }}
      working={Boolean(model.working[agent.pubkey])}
      canMessage={variant !== "no-encryption"}
      connected={variant !== "offline"}
      onMessage={() => {
        notice = "Conversation with Research opened";
      }}
      onFollow={async (following) => {
        attempt();
        agent = { ...agent, followed: following };
      }}
      onActivity={() => {
        model = {
          ...model,
          activityAgent: agent.pubkey,
          activity:
            agent.pubkey === storyAgent.pubkey ? storyActivityItems : [],
        };
        view = "activity";
      }}
      onCopy={() => {
        notice = "Public key copied";
      }}
      onOpenChannel={(id) => (notice = `Opened ${id}`)}
      onAddChannel={async (id) => {
        attempt();
        agent = { ...agent, channelIds: [...agent.channelIds, id] };
      }}
      onRemoveChannel={async (id) => {
        attempt();
        agent = {
          ...agent,
          channelIds: agent.channelIds.filter((channel) => channel !== id),
        };
      }}
      onSaveAgent={async (input) => {
        attempt();
        agent = {
          ...agent,
          name:
            input.nameMode === "inherited"
              ? input.displayName
              : input.instanceName || input.displayName,
          about: input.description ?? "",
          ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
        };
        notice = `Persona ${input.personaSlug} saved`;
      }}
      onUnlinkPersona={async () => {
        attempt();
        notice = "Persona unlinked";
      }}
      onDeletePersona={async () => {
        attempt();
        notice = "Persona deleted";
      }}
    />
  {:else}
    <CommunityAgentActivity
      {model}
      rooms={storyAgentRooms}
      onBack={() => {
        const selected = model.agents.find(
          (entry) => entry.pubkey === model.activityAgent,
        );
        if (selected && selected.pubkey !== agent.pubkey) agent = selected;
        view = selected ? "profile" : "gallery";
      }}
      onSelectAgent={(pubkey) => (model = { ...model, activityAgent: pubkey })}
      onSelectChannel={(channel) => {
        const { activityChannel, ...rest } = model;
        model = {
          ...rest,
          ...(channel ? { activityChannel: channel } : {}),
          activity: channel === "support" ? [] : storyActivityItems,
        };
      }}
      onLatest={() => {
        const { archiveError, activityError, ...rest } = model;
        model = { ...rest, activity: storyActivityItems };
        notice = "Showing latest activity";
      }}
      onLoadOlder={() => {
        model = {
          ...model,
          activity: [
            ...model.activity,
            storyActivity("session_resolved", { text: "Earlier session" }, 0),
          ],
          hasOlder: false,
        };
      }}
      onClearHistory={clear}
    />
  {/if}
</div>

<style>
  .agent-story {
    margin: 0 auto;
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
  }
  .agent-story > p {
    padding: 1rem;
  }
</style>
