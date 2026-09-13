<script lang="ts">
  import { untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
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
    storyAgentRuntime,
    storyAgentMemories,
  } from "./story-fixtures.js";
  import type {
    CommunityAgentIdentity,
    CommunityAgentControllerBootstrap,
    CommunityManagedAgentCreateInput,
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
        ...(variant === "no-archive" ? { archivedAgents: [] } : {}),
        ...(variant === "memory" ? { storageMode: "memory" } : {}),
        ...(variant === "storage-error"
          ? {
              archiveError:
                "Activity could not be saved. Free storage and retry.",
            }
          : {}),
        ...(variant === "unsupported-managed"
          ? {
              capabilities: {
                directory: true,
                presence: true,
                activity: true,
              },
            }
          : {}),
        ...(variant === "signer-error"
          ? {
              activityError:
                "Activity decryption was declined. Retry with your signer.",
            }
          : {}),
        ...(variant === "permission"
          ? {
              activitySyncStatus: "caught-up" as const,
              controllerScopes: {
                [storyAgent.pubkey]: {
                  agentPubkey: storyAgent.pubkey,
                  scopeKey: "relay/general/agent/thread/root",
                  active: true,
                  channelId: "general",
                  sessionId: "story",
                  turnId: "turn",
                },
              },
              pendingPermissions: {
                [storyAgent.pubkey]: [
                  {
                    agentPubkey: storyAgent.pubkey,
                    requestId: "permission-1",
                    scopeKey: "relay/general/agent/thread/root",
                    tool: "Run test suite",
                    input: { command: "pnpm test" },
                    options: ["allow_once", "reject_once"],
                    expiresAt: Date.now() + 15 * 60_000,
                    channelId: "general",
                    sessionId: "story",
                    turnId: "turn",
                  },
                ],
              },
            }
          : {}),
        ...(variant === "sync-checking"
          ? { activitySyncStatus: "checking" as const }
          : {}),
        ...(variant === "sync-active"
          ? {
              activitySyncStatus: "caught-up" as const,
              controllerScopes: {
                [storyAgent.pubkey]: {
                  agentPubkey: storyAgent.pubkey,
                  scopeKey: "relay/general/agent/channel",
                  active: true,
                  state: "running",
                  preview: "Running the requested checks",
                  channelId: "general",
                  sessionId: "story",
                  turnId: "turn",
                },
              },
            }
          : {}),
        ...(variant === "sync-completed"
          ? {
              activitySyncStatus: "caught-up" as const,
              controllerScopes: {
                [storyAgent.pubkey]: {
                  agentPubkey: storyAgent.pubkey,
                  scopeKey: "relay/general/agent/channel",
                  active: false,
                  state: "completed",
                  preview: "Completed while you were away",
                  channelId: "general",
                  sessionId: "story",
                  turnId: "turn",
                },
              },
            }
          : {}),
        ...(variant === "sync-unavailable" || variant === "sync-retry"
          ? { activitySyncStatus: "unavailable" as const }
          : {}),
        activityAgent: storyAgent.pubkey,
        activity:
          screen === "activity" && variant !== "empty"
            ? storyActivityItems
            : [],
        hasOlder: screen === "activity" && variant !== "empty",
        runtime: { [storyAgent.pubkey]: storyAgentRuntime },
        memories: { [storyAgent.pubkey]: storyAgentMemories },
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
  function managedBundle(
    input: CommunityManagedAgentCreateInput,
    pubkey = storyGalleryAgents[1]!.pubkey,
  ): CommunityAgentControllerBootstrap {
    const prefix = pubkey.slice(0, 12).toUpperCase();
    const bunkerUrlEnv = `LAPIS_AGENT_${prefix}_BUNKER_URL`;
    const clientSecretEnv = `LAPIS_AGENT_${prefix}_NIP46_CLIENT_SECRET`;
    return {
      schema: "lapis.agent-controller-bootstrap/1",
      relay: {
        id: "main",
        url: "wss://local-relay.lapis.md",
        pubkey: model.capabilities.managedAgents!.relayPubkey,
      },
      agent: {
        id: `agent-${pubkey.slice(0, 12)}`,
        pubkey,
        ownerPubkey: storyOwnerPubkey,
        persona: input.personaSlug,
        prompt: input.systemPrompt ?? "",
      },
      ownerAuthorization: {
        kind: "lapis-managed-v1",
        relayPubkey: model.capabilities.managedAgents!.relayPubkey,
      },
      signer: {
        id: `agent-${pubkey.slice(0, 12)}`,
        kind: "nip46",
        bunkerUrlEnv,
        clientSecretEnv,
      },
      environment: {
        [bunkerUrlEnv]: `bunker://${pubkey}?relay=wss%3A%2F%2Flocal-relay.lapis.md%2Fnip46&secret=one-time`,
        [clientSecretEnv]: "1".repeat(64),
      },
      confirmedGroups: [],
      controllerDefaults: { respondTo: "members", enabled: true },
      requiredLocalChoices: {
        hostId: null,
        runtimeAgent: null,
        remainingGroups: [...(input.groupIds ?? [])],
      },
      custody: {
        state: "active",
        invitationExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    };
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
      onCreateManagedAgent={async (input) => {
        attempt();
        return managedBundle(input);
      }}
      onClearManagedAgentDraft={() => {}}
      onCreateReplacement={async (pubkey) =>
        managedBundle(
          {
            personaSlug: agent.persona?.slug ?? "agent",
            displayName: agent.name,
            ...(agent.persona?.systemPrompt
              ? { systemPrompt: agent.persona.systemPrompt }
              : {}),
            nameMode: "instance",
          },
          pubkey,
        )}
      onRevokeManagedAgent={async () => {
        attempt();
        notice = "Controller access revoked";
      }}
      onDeleteManagedAgent={async () => {
        attempt();
        notice = "Managed agent deleted";
      }}
      rooms={storyAgentRooms.map((room) => ({
        id: room.id,
        groupId: `group-${room.id}`,
        name: room.name,
        canManage: true,
      }))}
      onAddAgentToRoom={async (groupId) => {
        if (variant === "room-failure" && groupId === "support")
          throw new Error("Room membership denied");
        attempt();
      }}
      ownerPubkey={storyOwnerPubkey}
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
      runtime={model.runtime?.[agent.pubkey]}
      memories={model.memories?.[agent.pubkey]}
      onLoadRuntime={async () =>
        model.runtime?.[agent.pubkey] ?? storyAgentRuntime}
      onSaveRuntime={async (defaults) => {
        attempt();
        const next = {
          ...(model.runtime?.[agent.pubkey] ?? storyAgentRuntime),
          saved: { ...defaults, updatedAt: Date.now() },
          effective: {
            runtimeAgent:
              defaults.runtimeAgent ?? storyAgentRuntime.effective.runtimeAgent,
            ...(defaults.model ? { model: defaults.model } : {}),
            ...(defaults.thinking ? { thinking: defaults.thinking } : {}),
          },
        };
        model = {
          ...model,
          runtime: { ...(model.runtime ?? {}), [agent.pubkey]: next },
        };
        notice = "Runtime defaults saved";
        return next;
      }}
      onLoadMemories={async () =>
        model.memories?.[agent.pubkey] ?? storyAgentMemories}
      onActOnMemory={async (input) => {
        attempt();
        const current = model.memories?.[agent.pubkey] ?? storyAgentMemories;
        const next = {
          ...current,
          records: current.records.map((record) =>
            record.type === "candidate" &&
            record.candidateId === input.candidateId
              ? {
                  ...record,
                  status:
                    input.action === "approve"
                      ? ("approved" as const)
                      : ("rejected" as const),
                }
              : record,
          ),
        };
        model = {
          ...model,
          memories: { ...(model.memories ?? {}), [agent.pubkey]: next },
        };
        notice = `Memory ${input.action}d`;
        return next;
      }}
    />
  {:else}
    <header aria-label="Agent activity navigation">
      <Button
        variant="ghost"
        onclick={() => {
          const selected = model.agents.find(
            (entry) => entry.pubkey === model.activityAgent,
          );
          if (selected && selected.pubkey !== agent.pubkey) agent = selected;
          view = selected ? "profile" : "gallery";
        }}><ArrowLeftIcon aria-hidden="true" />Back to profile</Button
      >
    </header>
    <CommunityAgentActivity
      {model}
      rooms={storyAgentRooms}
      members={[
        {
          id: storyOwnerPubkey,
          name: "Alex Morgan",
          handle: "alex",
          initials: "AM",
        },
      ]}
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
        model = {
          ...rest,
          activity: storyActivityItems,
          ...(variant === "sync-retry"
            ? { activitySyncStatus: "checking" as const }
            : {}),
        };
        notice = "Showing latest activity";
      }}
      onLoadOlder={() => {
        model = {
          ...model,
          activity: [
            ...model.activity,
            storyActivity(
              "user_message",
              {
                entry: {
                  id: "earlier-request",
                  type: "message",
                  role: "user",
                  text: "Earlier transcript message",
                  authorPubkey: storyOwnerPubkey,
                  createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
                },
              },
              0,
            ),
          ],
          hasOlder: false,
        };
      }}
      onClearHistory={clear}
      onCancelTurn={async () => {
        attempt();
        model = {
          ...model,
          controllerScopes: {
            ...model.controllerScopes,
            [storyAgent.pubkey]: {
              ...model.controllerScopes[storyAgent.pubkey]!,
              active: false,
            },
          },
        };
        notice = "Turn cancellation requested";
      }}
      onResetConversation={async () => {
        attempt();
        notice = "Conversation reset requested";
      }}
      onRespondPermission={async (_pubkey, requestId, decision) => {
        attempt();
        model = {
          ...model,
          pendingPermissions: {
            ...model.pendingPermissions,
            [storyAgent.pubkey]: (
              model.pendingPermissions[storyAgent.pubkey] ?? []
            ).filter((request) => request.requestId !== requestId),
          },
        };
        notice = `${decision} sent`;
      }}
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
