<script lang="ts">
  import { Toaster, toast } from "svelte-sonner";
  import { untrack, onDestroy } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
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
    CommunityAgentProcessingState,
  } from "../../community/agent-contracts.js";
  let {
    screen = "gallery",
    variant = "ready",
    failAction = false,
    narrow = false,
    appShell = false,
    projectChannels = false,
  }: {
    screen?: "gallery" | "profile" | "activity";
    variant?: string;
    failAction?: boolean;
    narrow?: boolean;
    appShell?: boolean;
    projectChannels?: boolean;
  } = $props();
  const presentationRooms = $derived(
    projectChannels
      ? storyAgentRooms.map((room) =>
          room.id === "support"
            ? { ...room, kind: "channel" as const, isProjectChannel: true }
            : room,
        )
      : storyAgentRooms,
  );
  onDestroy(() => toast.dismiss());
  const shell = new AppShellController({ rightClosed: true, rightWidth: 420 });
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
        ...(variant === "linked-definitions" ? { setupDrafts: [] } : {}),
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
  const messagingMembers = [
    { id: "a".repeat(64), name: "Ada Chen", handle: "ada", initials: "AC" },
    { id: "b".repeat(64), name: "Noor Rahman", handle: "noor", initials: "NR" },
  ];
  async function loadProcessing(
    pubkey: string,
  ): Promise<CommunityAgentProcessingState> {
    return (
      model.processing?.[pubkey] ?? {
        enabled: pubkey === storyAgent.pubkey,
        revision: 0,
        status: "applied",
        updatedAt: 0,
      }
    );
  }
  async function setProcessing(
    pubkey: string,
    enabled: boolean,
    revision: number,
  ): Promise<CommunityAgentProcessingState> {
    attempt();
    const current = await loadProcessing(pubkey);
    if (current.revision !== revision)
      throw new Error("Processing state changed; refresh status.");
    const next = {
      ...current,
      enabled,
      revision: revision + 1,
      updatedAt: Date.now(),
    };
    model = { ...model, processing: { ...model.processing, [pubkey]: next } };
    return next;
  }
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
    notice = `Agent ${input.displayName} saved`;
    const { error, ...rest } = model;
    model = { ...rest, partial: false };
  }
  async function savePersona(input: CommunityAgentPersonaSaveInput) {
    attempt();
    notice = `Agent ${input.displayName} saved`;
  }
  async function deletePersona(slug: string) {
    attempt();
    model = {
      ...model,
      personas: model.personas.filter((persona) => persona.slug !== slug),
      ...(model.setupDrafts
        ? {
            setupDrafts: model.setupDrafts.filter(
              (persona) => persona.slug !== slug,
            ),
          }
        : {}),
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

{#snippet noticeContent()}
  {#if notice}<p class="agent-story__notice" role="status">{notice}</p>{/if}
{/snippet}

{#snippet directory()}
  <CommunityAgents
    {model}
    members={messagingMembers}
    onLoadProcessing={loadProcessing}
    onSetProcessing={setProcessing}
    onProfile={(pubkey) => {
      agent =
        model.agents.find((entry) => entry.pubkey === pubkey) ?? storyAgent;
      view = "profile";
      if (appShell) shell.right.open();
    }}
    onActivity={(pubkey) => {
      agent =
        model.agents.find((entry) => entry.pubkey === pubkey) ??
        model.archivedAgents.find((entry) => entry.pubkey === pubkey) ??
        agent;
      model = { ...model, activityAgent: pubkey };
      view = "activity";
      if (appShell) shell.right.open();
    }}
    onSaveAgent={saveAgent}
    onSaveRuntime={async (pubkey, defaults) => {
      attempt();
      const current = model.runtime?.[pubkey] ?? storyAgentRuntime;
      const next = {
        ...current,
        saved: { ...defaults, updatedAt: Date.now() },
        effective: {
          runtimeAgent: defaults.runtimeAgent ?? current.effective.runtimeAgent,
          ...(defaults.model ? { model: defaults.model } : {}),
          ...(defaults.thinking ? { thinking: defaults.thinking } : {}),
        },
      };
      model = {
        ...model,
        runtime: { ...(model.runtime ?? {}), [pubkey]: next },
      };
      notice = "Runtime defaults saved";
      return next;
    }}
    onUnlinkPersona={async () => {
      attempt();
      notice = "Persona unlinked";
    }}
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
    rooms={presentationRooms.map((room) => ({
      id: room.id,
      groupId: `group-${room.id}`,
      name: room.name,
      isProjectChannel: room.isProjectChannel === true,
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
    showPageHeader={!appShell}
    showBodyDescription={appShell}
  />
{/snippet}

{#snippet profile()}
  <CommunityAgentProfile
    {agent}
    members={messagingMembers}
    processing={model.processing?.[agent.pubkey]}
    onLoadProcessing={() => loadProcessing(agent.pubkey)}
    onSetProcessing={(enabled, revision) =>
      setProcessing(agent.pubkey, enabled, revision)}
    personas={model.personas}
    ownerName="steve"
    onOpenOwner={(pubkey) => {
      notice =
        pubkey === storyOwnerPubkey
          ? "Opened steve's profile"
          : "Unknown owner";
    }}
    rooms={variant === "denied"
      ? presentationRooms.map(({ permissions, ...room }) => room)
      : presentationRooms}
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
        activity: agent.pubkey === storyAgent.pubkey ? storyActivityItems : [],
      };
      view = "activity";
      if (appShell) shell.right.open();
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
      notice = `Agent ${input.displayName} saved`;
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
{/snippet}

{#snippet activity()}
  {#if !appShell}
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
  {/if}
  <CommunityAgentActivity
    {model}
    rooms={presentationRooms}
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
{/snippet}

<div
  class:agent-story={!appShell}
  class:agent-story--app-shell={appShell}
  style:max-width={!appShell
    ? narrow
      ? "360px"
      : view === "gallery"
        ? "none"
        : "420px"
    : undefined}
  style:width={appShell && narrow ? "390px" : undefined}
>
  {#if appShell}
    <CommunityAppShell
      controller={shell}
      displayMode={narrow ? "mobile" : "desktop"}
      desktopMinMainWidth={0}
    >
      <AppShell.Main>
        <AppShell.Toolbar
          label="Agents page header"
          class="agent-story__toolbar"
        >
          <div class="agent-story__toolbar-start">
            <h1>Agents</h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh agents"
            title="Refresh agents"
            disabled={model.status === "loading"}
            onclick={() => {
              model = storyAgentState();
              notice = "Agent directory refreshed";
            }}
          >
            <RefreshIcon aria-hidden="true" />
          </Button>
        </AppShell.Toolbar>
        <AppShell.Body layout="regions" label="Agents">
          <AppShell.Body.Content label="Agents directory">
            {@render noticeContent()}
            {@render directory()}
          </AppShell.Body.Content>
        </AppShell.Body>
      </AppShell.Main>
      <AppShell.Sidebar
        side="right"
        label={view === "activity"
          ? "Agent activity sidebar"
          : "Profile sidebar"}
        mobileLabel={view === "activity" ? "Agent activity" : "Profile"}
        resizeLabel={view === "activity"
          ? "Resize agent activity sidebar"
          : "Resize profile sidebar"}
        closeable
        hidden={view === "gallery"}
      >
        {#if view === "profile"}
          <AppShell.Sidebar.Header>
            <strong>Profile</strong>
            <AppShell.Sidebar.Close
              onclick={() => {
                shell.right.close();
                view = "gallery";
              }}
            />
          </AppShell.Sidebar.Header>
          <AppShell.Sidebar.Body>
            {@render profile()}
          </AppShell.Sidebar.Body>
        {:else if view === "activity"}
          <AppShell.Sidebar.Header>
            <Button
              variant="ghost"
              size="sm"
              onclick={() => {
                const selected = model.agents.find(
                  (entry) => entry.pubkey === model.activityAgent,
                );
                if (selected && selected.pubkey !== agent.pubkey)
                  agent = selected;
                view = selected ? "profile" : "gallery";
              }}><ArrowLeftIcon aria-hidden="true" />Back to profile</Button
            >
            <AppShell.Sidebar.Close
              onclick={() => {
                shell.right.close();
                view = "gallery";
              }}
            />
          </AppShell.Sidebar.Header>
          <AppShell.Sidebar.Body>
            {@render activity()}
          </AppShell.Sidebar.Body>
        {/if}
      </AppShell.Sidebar>
    </CommunityAppShell>
  {:else}
    {@render noticeContent()}
    {#if view === "gallery"}
      {@render directory()}
    {:else if view === "profile"}
      {@render profile()}
    {:else}
      {@render activity()}
    {/if}
  {/if}
</div>

<Toaster position="bottom-right" />

<style>
  .agent-story {
    margin: 0 auto;
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
  }
  .agent-story--app-shell {
    width: 100%;
    height: 100vh;
    max-width: 100%;
  }
  :global(.agent-story__toolbar) {
    justify-content: space-between;
  }
  .agent-story__toolbar-start {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }
  .agent-story__toolbar-start h1 {
    margin: 0;
    font-size: var(--community-text-page);
    font-weight: 650;
    letter-spacing: 0;
  }
  .agent-story > p,
  .agent-story__notice {
    padding: 1rem;
  }
</style>
