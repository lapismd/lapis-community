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
  } from "./story-fixtures.js";
  import type { CommunityAgentsState } from "../../community/agent-contracts.js";
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
  let agent = $state(storyAgent);
  let model = $state<CommunityAgentsState>(
    untrack(() =>
      storyAgentState({
        ...(variant === "loading" ? { status: "loading" } : {}),
        ...(variant === "empty" ? { agents: [], archivedAgents: [] } : {}),
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
</script>

<div
  class="agent-story"
  style:max-width={narrow ? "360px" : view === "gallery" ? "none" : "420px"}
>
  {#if notice}<p role="status">{notice}</p>{/if}
  {#if view === "gallery"}
    <CommunityAgents
      {model}
      onProfile={() => (view = "profile")}
      onActivity={() => (view = "activity")}
      onRefresh={() => {
        model = storyAgentState();
        notice = "Agent directory refreshed";
      }}
      onClearHistory={clear}
    />
  {:else if view === "profile"}
    <CommunityAgentProfile
      {agent}
      rooms={variant === "denied"
        ? storyAgentRooms.map(({ permissions, ...room }) => room)
        : storyAgentRooms}
      presence={{ status: "online" }}
      working
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
        model = { ...model, activity: storyActivityItems };
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
    />
  {:else}
    <CommunityAgentActivity
      {model}
      rooms={storyAgentRooms}
      onBack={() => (view = "profile")}
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
