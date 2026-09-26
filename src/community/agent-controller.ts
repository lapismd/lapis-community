import { AgentAdministration } from "./agent-administration.js";
import { AgentRuntimeSnapshots } from "./agent-runtime-snapshot-client.js";
import {
  applyAgentStatePatch,
  createActivitySyncSelection,
  type AgentActivitySyncSelection,
} from "./activity-freshness.js";
import { AgentFrameProjection } from "./agent-frame-projection.js";
import { AgentTurnControls } from "./agent-turn-controls.js";
import { sessionControl } from "./agent-session-controls.js";
import type {
  AgentAdministrationRequest,
  AgentAdministrationControl,
} from "./agent-administration-contracts.js";
import { confirmedRuntimeSettings } from "./agent-runtime-confirmation.js";
import { activityPayloadState } from "./activity-frame-state.js";
import { turnFrameIsTerminal, turnIsTerminal } from "./agent-turn-state.js";
import {
  activityMatches,
  observerScope,
  controllerScopeId,
} from "./agent-activity-context.js";
import type {
  CommunityAgentActivityContext,
  CommunityAgentActivitySyncContext,
  CommunityAgentControl,
  CommunityAgentObserver,
} from "./agent-contracts.js";
import type { CommunitySigner } from "../auth/index.js";
import type { NostrEvent } from "../protocol/index.js";
import type { CommunityStorageMode } from "./contracts.js";
import type {
  CommunityAgentActivityItem,
  CommunityAgentActivityStore,
  CommunityAgentArchiveCursor,
  CommunityAgentArchiveRecord,
  CommunityAgentArchiveScope,
  CommunityAgentDirectory,
  CommunityAgentMemoryState,
  CommunityAgentRuntimeState,
  CommunityAgentProcessingState,
  CommunityAgentsActions,
  CommunityAgentsState,
  CommunityAgentSession,
} from "./agent-contracts.js";
import {
  AGENT_TYPING_TTL,
  agentPresence,
  agentChannelMemberships,
  agentTag,
  materializeAgentInstances,
  parseAgentObserver,
  signedAgentEvent,
  validateAgentTelemetry,
} from "./agent-protocol.js";
import {
  lateRuntimeState,
  parseProcessingState,
} from "./agent-administration-state.js";
import {
  observerRecord,
  observerText,
  parseMemoryState,
  parseRuntimeState,
} from "./agent-state-parsers.js";
import { replaceScopePendingPermissions } from "./activity-sync-permissions.js";
import { sweepExpiredPermissionState } from "./permission-expiry.js";

interface AgentControllerOptions {
  scope: CommunityAgentArchiveScope;
  identity: CommunitySigner;
  session: CommunityAgentSession;
  archive?: CommunityAgentActivityStore | undefined;
  storageMode(): CommunityStorageMode;
  onState(state: CommunityAgentsState): void;
  onDirectory?(events: readonly NostrEvent[]): void;
  now?: () => number;
}

interface ActivitySyncRequest {
  id: string;
  generation: number;
  agentPubkey: string;
  context: CommunityAgentActivitySyncContext;
  offset: number;
  streamId?: string;
  highWaterMark?: number;
  notBefore?: number;
  timer?: ReturnType<typeof setTimeout>;
}

export function createCommunityAgentsController(
  options: AgentControllerOptions,
): CommunityAgentsController {
  return new CommunityAgentsController(options);
}

export class CommunityAgentsController {
  readonly #options: AgentControllerOptions;
  readonly #abort = new AbortController();
  #subscription: { close(): void } | undefined;
  #subscriptionKey = "";
  #subscribedPubkeys = new Set<string>();
  #directory: CommunityAgentDirectory | undefined;
  #ownerChannels = new Set<string>();
  #metadataIds = new Set<string>();
  #seen = new Set<string>();
  #unknownFrames: Array<{
    event: NostrEvent;
    origin: "live" | "replay" | undefined;
  }> = [];
  #workingUntil = new Map<
    string,
    Map<string, { until: number; timestamp: number; seq: number }>
  >();
  #frames = new AgentFrameProjection();
  #typingUntil = new Map<string, number>();
  #decodedFrames = new Map<string, CommunityAgentActivityItem["frame"]>();
  #refreshRun: Promise<void> | undefined;
  #refreshTimer: ReturnType<typeof setTimeout> | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  #lastRefresh = 0;
  #closed = false;
  #activityGeneration = 0;
  #browsingHistory = false;
  #cursor: CommunityAgentArchiveCursor | undefined;
  #pendingRecords: CommunityAgentArchiveRecord[] = [];
  #flushRun: Promise<void> | undefined;
  #archivePaused = false;
  #decodePaused = false;
  #decodeCount = 0;
  #decodeQueue = Promise.resolve();
  #syncRequest: ActivitySyncRequest | undefined;
  #syncQueue: Array<{
    agentPubkey: string;
    context: CommunityAgentActivitySyncContext;
  }> = [];
  #syncSelection: AgentActivitySyncSelection | undefined;
  #syncGeneration = 0;
  #syncSerial = 0;
  #turnControls = new AgentTurnControls({
    state: () => this.#state,
    send: (agent, control) => this.#sendControl(agent, control),
    update: (turnControls) => this.#update({ turnControls }),
  });
  readonly #administration = new AgentAdministration({
    state: () => this.#state,
    update: (patch) => this.#update(patch),
    hasSnapshot: (agent) => this.#runtimeSnapshots.hasSnapshot(agent),
    send: (agent, control) => this.#sendControl(agent, control),
  });
  readonly #runtimeSnapshots: AgentRuntimeSnapshots;
  #state: CommunityAgentsState;

  readonly actions: CommunityAgentsActions = {
    takePermissionNotifications: () =>
      this.#frames.notices.take(this.#state, this.#now() * 1000),
    refresh: async () => {
      this.#archivePaused = false;
      this.#decodePaused = false;
      this.#update({ archiveError: undefined, activityError: undefined });
      await this.#flushArchive();
      await this.refresh();
      if (this.#state.activityAgent)
        await this.openActivity(
          this.#state.activityAgent,
          this.#state.activityContext ?? this.#state.activityChannel,
        );
    },
    registerAgent: async (pubkey) => {
      if (!this.#options.session.registerAgent)
        throw new Error("Agent registration is unavailable in this runtime");
      const event = await this.#options.session.registerAgent(
        pubkey,
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#options.onDirectory?.([event]);
      await this.refresh();
    },
    savePersona: async (input) => {
      if (!this.#options.session.savePersona)
        throw new Error("Persona management is unavailable in this runtime");
      const event = await this.#options.session.savePersona(
        input,
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#options.onDirectory?.([event]);
      await this.refresh();
    },
    saveAgent: async (input) => {
      if (!this.#options.session.saveAgent)
        throw new Error("Persona management is unavailable in this runtime");
      const result = await this.#options.session.saveAgent(
        input,
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#options.onDirectory?.([
        result.persona,
        ...(result.instance ? [result.instance] : []),
      ]);
      await this.refresh();
    },
    unlinkAgent: async (pubkey, fallbackName) => {
      if (!this.#options.session.unlinkAgent)
        throw new Error("Persona unlinking is unavailable in this runtime");
      const event = await this.#options.session.unlinkAgent(
        pubkey,
        fallbackName,
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#options.onDirectory?.([event]);
      await this.refresh();
    },
    deletePersona: async (slug) => {
      if (!this.#options.session.deletePersona)
        throw new Error("Persona deletion is unavailable in this runtime");
      const event = await this.#options.session.deletePersona(
        slug,
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#options.onDirectory?.([event]);
      await this.refresh();
    },
    createManagedAgent: async (input) => {
      if (!this.#options.session.createManagedAgent)
        throw new Error(
          "Managed agent creation is unavailable in this runtime",
        );
      const bootstrap = await this.#options.session.createManagedAgent(
        input,
        this.#abort.signal,
      );
      if (!this.#closed) await this.refresh();
      return bootstrap;
    },
    clearManagedAgentDraft: () =>
      this.#options.session.clearManagedAgentDraft?.(),
    createManagedAgentReplacement: async (pubkey) => {
      if (!this.#options.session.createManagedAgentReplacement)
        throw new Error(
          "Managed controller setup is unavailable in this runtime",
        );
      const bootstrap =
        await this.#options.session.createManagedAgentReplacement(
          pubkey,
          this.#abort.signal,
        );
      if (!this.#closed) await this.refresh();
      return bootstrap;
    },
    revokeManagedAgent: async (pubkey) => {
      if (!this.#options.session.revokeManagedAgent)
        throw new Error(
          "Managed controller access is unavailable in this runtime",
        );
      await this.#options.session.revokeManagedAgent(
        pubkey,
        this.#abort.signal,
      );
      if (!this.#closed) await this.refresh();
    },
    deleteManagedAgent: async (pubkey) => {
      if (!this.#options.session.deleteManagedAgent)
        throw new Error(
          "Managed agent deletion is unavailable in this runtime",
        );
      await this.#options.session.deleteManagedAgent(
        pubkey,
        this.#abort.signal,
      );
      if (!this.#closed) await this.refresh();
    },
    setFollow: async (pubkey, following) => {
      const event = await this.#options.session.setFollow(
        pubkey,
        following,
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#options.onDirectory?.([event]);
      this.#update({
        agents: this.#state.agents.map((agent) =>
          agent.pubkey === pubkey ? { ...agent, followed: following } : agent,
        ),
      });
    },
    openActivity: (pubkey, channel) => this.openActivity(pubkey, channel),
    syncActivity: (context, agentPubkeys) =>
      this.syncActivity(context, agentPubkeys),
    cancelActivitySync: () => {
      this.#syncSelection = undefined;
      this.#cancelActivitySync(true);
      this.#update({
        activitySyncStatus: undefined,
        activitySyncGap: undefined,
      });
    },
    loadOlderActivity: () => this.#loadActivity(false),
    clearHistory: async (pubkey) => {
      const archive = this.#options.archive;
      if (!archive)
        throw new Error("Agent history is unavailable in this runtime");
      this.#activityGeneration++;
      await this.#flushRun;
      this.#pendingRecords = this.#pendingRecords.filter(
        (record) => pubkey !== undefined && record.event.pubkey !== pubkey,
      );
      const suppressedAgents = pubkey
        ? [pubkey]
        : [
            ...new Set(
              [...this.#state.agents, ...this.#state.archivedAgents].map(
                (agent) => agent.pubkey,
              ),
            ),
          ];
      await Promise.all(
        suppressedAgents.map((agent) =>
          archive.suppressBefore(this.#archiveScope(), agent, this.#now()),
        ),
      );
      await archive.clear(this.#archiveScope(), pubkey);
      if (this.#closed) return;
      this.#decodedFrames.clear();
      this.#frames.sequences.clear();
      this.#archivePaused = false;
      this.#update({
        archiveError: undefined,
        archivedAgents: await archive.agents(this.#archiveScope()),
        ...(!pubkey || this.#state.activityAgent === pubkey
          ? {
              activity: [],
              hasOlder: false,
              activityLoading: false,
              activitySyncStatus: undefined,
              activitySyncGap: undefined,
            }
          : {}),
      });
      void this.#flushArchive();
    },
    continueTurn: (pubkey, scopeKey, target) =>
      this.#turnControls.continue(pubkey, scopeKey, target),
    cancelTurn: async (pubkey, scopeKey, channelId, expected) =>
      this.#sendControl(
        pubkey,
        sessionControl(
          this.#state,
          pubkey,
          "cancel_turn",
          scopeKey,
          channelId,
          expected,
        ),
      ),
    resetConversation: async (pubkey, scopeKey, channelId, expected) =>
      this.#sendControl(
        pubkey,
        sessionControl(
          this.#state,
          pubkey,
          "reset_conversation",
          scopeKey,
          channelId,
          expected,
        ),
      ),
    respondPermission: async (pubkey, requestId, decision, channelId) => {
      const request = (this.#state.pendingPermissions[pubkey] ?? []).find(
        (candidate) => candidate.requestId === requestId,
      );
      if (!request || !request.options.includes(decision))
        throw new Error(
          "The controller permission choice is no longer available",
        );
      if (request.expiresAt && request.expiresAt <= this.#now() * 1_000) {
        this.#sweepExpiredPermissions();
        return;
      }
      await this.#sendControl(pubkey, {
        version: 1,
        command: "permission_response",
        requestId,
        decision,
        ...(channelId ? { channelId } : {}),
      });
      this.#update({
        pendingPermissions: {
          ...this.#state.pendingPermissions,
          [pubkey]: (this.#state.pendingPermissions[pubkey] ?? []).filter(
            (candidate) => candidate.requestId !== requestId,
          ),
        },
      });
    },
    loadProcessing: (pubkey) =>
      this.#administration.request<CommunityAgentProcessingState>(
        pubkey,
        { version: 2, command: "processing_get" },
        "processing_state",
      ),
    setProcessing: (pubkey, enabled, expectedRevision) =>
      this.#administration.request<CommunityAgentProcessingState>(
        pubkey,
        { version: 2, command: "processing_set", enabled, expectedRevision },
        "processing_state",
      ),
    refreshRuntime: (pubkey) =>
      this.#state.capabilities.runtimeSnapshots &&
      this.#options.session.sendRuntimeRequest
        ? this.#runtimeSnapshots.refresh(pubkey)
        : this.#administration
            .request<CommunityAgentRuntimeState>(
              pubkey,
              { version: 2, command: "runtime_get" },
              "runtime_state",
            )
            .then(() => {}),
    loadRuntime: (pubkey) =>
      this.#state.capabilities.runtimeSnapshots &&
      this.#options.session.sendRuntimeRequest
        ? this.#runtimeSnapshots.load(pubkey)
        : this.#administration.request<CommunityAgentRuntimeState>(
            pubkey,
            { version: 2, command: "runtime_get" },
            "runtime_state",
          ),
    saveRuntime: (pubkey, defaults) =>
      this.#administration
        .request<CommunityAgentRuntimeState>(
          pubkey,
          { version: 2, command: "runtime_set", ...defaults },
          "runtime_state",
        )
        .then((state) => confirmedRuntimeSettings(defaults, state)),
    loadMemories: (pubkey, channelId, filter = {}) =>
      this.#administration.request<CommunityAgentMemoryState>(
        pubkey,
        {
          version: 2,
          command: "memory_list",
          channelId,
          ...filter,
        },
        "memory_state",
      ),
    actOnMemory: (pubkey, input) =>
      this.#administration.request<CommunityAgentMemoryState>(
        pubkey,
        { version: 2, command: "memory_action", ...input },
        "memory_state",
      ),
  };

  constructor(options: AgentControllerOptions) {
    this.#options = options;
    this.#runtimeSnapshots = new AgentRuntimeSnapshots({
      owner: options.scope.ownerPubkey,
      now: () => this.#now() * 1000,
      agent: (pubkey) =>
        this.#state.agents.find((agent) => agent.pubkey === pubkey),
      relay: () => this.#directory?.relayPubkey,
      decrypt: (peer, content) => {
        if (!options.identity.nip44) throw new Error("NIP-44 signer required");
        return options.identity.nip44.decrypt(peer, content);
      },
      send: (agent, request) =>
        options.session.sendRuntimeRequest!(agent, request, this.#abort.signal),
      loadHeads: options.session.loadRuntimeHeads
        ? (agent) =>
            options.session.loadRuntimeHeads!(agent, this.#abort.signal)
        : undefined,
      legacy: (agent) =>
        this.#administration.request<CommunityAgentRuntimeState>(
          agent,
          { version: 2, command: "runtime_get" },
          "runtime_state",
        ),
      update: (agent, runtime, status) =>
        this.#update({
          ...(runtime
            ? { runtime: { ...this.#state.runtime, [agent]: runtime } }
            : {}),
          runtimeRefresh: { ...this.#state.runtimeRefresh, [agent]: status },
        }),
    });
    this.#state = {
      status: "loading",
      agents: [],
      personas: [],
      setupDrafts: [],
      archivedAgents: [],
      capabilities: { directory: true, presence: false, activity: false },
      presence: {},
      working: {},
      controllerScopes: {},
      conversationScopes: {},
      publicWorking: [],
      publicAgents: [],
      pendingPermissions: {},
      processing: {},
      runtime: {},
      runtimeRefresh: {},
      memories: {},
      partial: false,
      storageMode: options.storageMode(),
      activity: [],
      activityLoading: false,
      hasOlder: false,
    };
  }

  get state(): CommunityAgentsState {
    return this.#state;
  }
  #now(): number {
    return Math.floor(this.#options.now?.() ?? Date.now() / 1_000);
  }

  #archiveScope() {
    const relayPubkey = this.#directory?.relayPubkey;
    return relayPubkey
      ? { ...this.#options.scope, relayPubkey }
      : this.#options.scope;
  }

  #update(patch: {
    [K in keyof CommunityAgentsState]?: CommunityAgentsState[K] | undefined;
  }): void {
    if (this.#closed) return;
    this.#state = applyAgentStatePatch(this.#state, patch, this.#syncSelection);
    this.#options.onState(this.#state);
  }

  async start(): Promise<void> {
    this.#options.onState(this.#state);
    void this.#loadArchivedAgents();
    await this.refresh();
    if (!this.#closed) this.#timer = setInterval(() => this.#tick(), 1_000);
  }

  async #loadArchivedAgents(): Promise<void> {
    const relayPubkey = this.#directory?.relayPubkey;
    try {
      const archivedAgents =
        (await this.#options.archive?.agents(
          relayPubkey
            ? { ...this.#options.scope, relayPubkey }
            : this.#options.scope,
        )) ?? [];
      if (relayPubkey !== this.#directory?.relayPubkey) return;
      this.#update({
        archivedAgents,
        storageMode: this.#options.storageMode(),
      });
    } catch {
      if (relayPubkey !== this.#directory?.relayPubkey) return;
      this.#update({
        archiveError:
          "Saved activity is unavailable. Retry to reopen the archive.",
      });
    }
  }

  refresh(): Promise<void> {
    if (this.#closed) return Promise.resolve();
    this.#refreshRun ??= this.#refresh().finally(() => {
      this.#refreshRun = undefined;
    });
    return this.#refreshRun;
  }

  async #refresh(): Promise<void> {
    this.#lastRefresh = this.#now();
    try {
      const directory = await this.#options.session.loadDirectory(
        this.#abort.signal,
      );
      if (this.#closed) return;
      this.#directory = directory;
      void this.#loadArchivedAgents();
      this.#ownerChannels = new Set(
        [...agentChannelMemberships(directory.events, directory.relayPubkey)]
          .filter(([, members]) => members.has(this.#options.scope.ownerPubkey))
          .map(([id]) => id),
      );
      this.#metadataIds = new Set(directory.events.map((event) => event.id));
      this.#options.onDirectory?.(directory.events);
      const allowed = new Set(
        [...directory.agents, ...(directory.publicAgents ?? [])].map(
          (agent) => agent.pubkey,
        ),
      );
      const linkedPersonas = new Set(
        materializeAgentInstances(
          directory.events,
          this.#options.scope.ownerPubkey,
        ).map((instance) => instance.personaId),
      );
      for (const key of this.#workingUntil.keys())
        if (!allowed.has(key)) this.#workingUntil.delete(key);
      for (const key of this.#typingUntil.keys())
        if (!allowed.has(key)) this.#typingUntil.delete(key);
      this.#update({
        runtime: Object.fromEntries(
          Object.entries(this.#state.runtime ?? {}).filter(([key]) =>
            directory.agents.some((agent) => agent.pubkey === key),
          ),
        ),
        runtimeRefresh: Object.fromEntries(
          Object.entries(this.#state.runtimeRefresh ?? {}).filter(([key]) =>
            directory.agents.some((agent) => agent.pubkey === key),
          ),
        ),
        agents: directory.agents,
        publicAgents: directory.publicAgents ?? [],
        conversationScopes: Object.fromEntries(
          Object.entries(this.#state.conversationScopes ?? {}).filter(
            ([, scope]) =>
              directory.agents.some(
                (agent) => agent.pubkey === scope.agentPubkey,
              ) &&
              (!scope.channelId || this.#ownerChannels.has(scope.channelId)),
          ),
        ),
        activity: this.#state.activity.filter(
          (item) =>
            !item.frame.channelId ||
            this.#ownerChannels.has(item.frame.channelId),
        ),
        personas: directory.personas,
        setupDrafts: directory.personas.filter(
          (persona) => !linkedPersonas.has(persona.slug),
        ),
        capabilities: directory.capabilities,
        partial: directory.partial,
        error: directory.reason,
        status: directory.capabilities.directory
          ? this.#subscription
            ? this.#state.status
            : "loading"
          : "unsupported",
        presence: Object.fromEntries(
          Object.entries(this.#state.presence).filter(([key]) =>
            allowed.has(key),
          ),
        ),
      });
      this.#runtimeSnapshots.retain(
        new Set(directory.agents.map((agent) => agent.pubkey)),
      );
      const pubkeys = [...allowed].sort();
      const key = JSON.stringify([
        directory.relayPubkey,
        directory.capabilities,
        pubkeys,
      ]);
      if (key !== this.#subscriptionKey) {
        // Open the replacement first; event IDs deduplicate the overlap.
        let replacement: { close(): void } | undefined;
        replacement = await this.#options.session.subscribe(
          pubkeys,
          {
            onevent: (event, origin) => this.#receive(event, origin),
            onclose: () => {
              if (this.#subscription !== replacement) return;
              this.#cancelActivitySync(true);
              this.#subscriptionKey = "";
              this.#subscribedPubkeys.clear();
              this.#workingUntil.clear();
              this.#typingUntil.clear();
              this.#update({
                status: "offline",
                working: {},
                presence: {},
                error: "Agent connection interrupted. Reconnecting…",
                ...(this.#state.activityAgent || this.#syncSelection
                  ? { activitySyncStatus: "unavailable" as const }
                  : {}),
              });
              this.#scheduleRefresh();
            },
          },
          this.#abort.signal,
        );
        if (this.#closed) {
          replacement.close();
          return;
        }
        const previous = this.#subscription;
        this.#subscription = replacement;
        this.#subscriptionKey = key;
        this.#subscribedPubkeys = new Set(pubkeys);
        previous?.close();
      }
      if (directory.capabilities.directory) this.#update({ status: "ready" });
      const pending = this.#unknownFrames;
      this.#unknownFrames = [];
      for (const { event, origin } of pending)
        if (allowed.has(event.pubkey)) this.#receive(event, origin);
      try {
        for (const event of await this.#options.session.loadPresence(
          pubkeys,
          this.#abort.signal,
        ))
          this.#receive(event);
      } catch {
        this.#update({
          partial: true,
          error: "Agent profiles loaded; presence is temporarily unavailable.",
        });
      }
      this.#tick(false);
      if (this.#syncSelection || this.#state.activityAgent)
        void this.#retryActivitySync();
    } catch (error) {
      if (this.#closed) return;
      this.#update({
        status:
          this.#state.agents.length || this.#state.archivedAgents.length
            ? "offline"
            : "error",
        error:
          error instanceof Error ? error.message : "Agent discovery failed",
      });
    }
  }

  #scheduleRefresh(): void {
    if (this.#refreshTimer || this.#closed) return;
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = undefined;
      void this.refresh();
    }, 1_000);
  }

  #receive(input: NostrEvent, origin?: "live" | "replay"): void {
    if (this.#closed) return;
    const event = signedAgentEvent(input);
    if (!event) return;
    if (event.kind === 30180 || event.kind === 30181) {
      void this.#runtimeSnapshots.receive(event);
      return;
    }
    if (event.kind < 20_000 || event.kind >= 30_000) {
      if (!this.#metadataIds.has(event.id)) {
        this.#metadataIds.add(event.id);
        this.#scheduleRefresh();
      }
      return;
    }
    const agent = [
      ...this.#state.agents,
      ...(this.#state.publicAgents ?? []),
    ].find(
      (candidate) =>
        candidate.pubkey === event.pubkey ||
        (event.kind === 20001 &&
          event.pubkey === this.#directory?.relayPubkey &&
          candidate.pubkey === agentTag(event, "p")),
    );
    if (!agent) {
      if (event.kind === 24200 && this.#unknownFrames.length < 100) {
        this.#unknownFrames.push({ event, origin });
        this.#scheduleRefresh();
      }
      return;
    }
    const now = this.#now();
    if (event.kind === 20001) {
      const wasOnline = this.#state.presence[agent.pubkey]?.status === "online";
      const presence = agentPresence(
        event,
        agent.pubkey,
        this.#directory?.relayPubkey ?? "",
        now,
      );
      if (
        presence &&
        (this.#state.presence[agent.pubkey]?.updatedAt ?? 0) <=
          (presence.updatedAt ?? 0)
      )
        this.#update({
          presence: { ...this.#state.presence, [agent.pubkey]: presence },
        });
      if (
        presence?.status === "online" &&
        !wasOnline &&
        (this.#state.activityAgent === agent.pubkey ||
          this.#syncSelection?.agentPubkeys.includes(agent.pubkey))
      )
        void this.#retryActivitySync();
    } else if (event.kind === 20002) {
      const channel = agentTag(event, "h");
      if (
        channel &&
        agent.channelIds.includes(channel) &&
        event.created_at <= now + 30 &&
        event.created_at + AGENT_TYPING_TTL > now
      ) {
        const threadRootId = agentTag(event, "e");
        if (
          Object.values(this.#state.conversationScopes ?? {}).some(
            (scope) =>
              scope.agentPubkey === agent.pubkey &&
              scope.channelId === channel &&
              scope.threadRootId === threadRootId &&
              !scope.active &&
              (scope.updatedAt ?? 0) >= event.created_at * 1000,
          )
        )
          return;
        this.#update({
          publicWorking: [
            ...(this.#state.publicWorking ?? []).filter(
              (item) =>
                !(
                  item.agentPubkey === agent.pubkey &&
                  item.channelId === channel &&
                  item.threadRootId === threadRootId
                ),
            ),
            {
              agentPubkey: agent.pubkey,
              channelId: channel,
              ...(threadRootId ? { threadRootId } : {}),
              expiresAt: event.created_at + AGENT_TYPING_TTL,
            },
          ],
        });
        this.#typingUntil.set(
          agent.pubkey,
          Math.min(now + AGENT_TYPING_TTL, event.created_at + AGENT_TYPING_TTL),
        );
        this.#tick(false);
      }
    } else if (event.kind === 24200) {
      if (
        this.#seen.has(event.id) ||
        !validateAgentTelemetry(
          event,
          agent.profile,
          this.#options.scope.ownerPubkey,
          now,
          this.#directory?.relayPubkey,
          agent.instance?.event,
        )
      )
        return;
      const channel = agentTag(event, "h");
      if (
        channel &&
        (!agent.channelIds.includes(channel) ||
          !this.#ownerChannels.has(channel))
      )
        return;
      this.#seen.add(event.id);
      if (this.#seen.size > 4_096)
        this.#seen.delete(this.#seen.values().next().value!);
      const record = {
        event,
        profile: agent.profile,
        ...(agent.instance ? { instance: agent.instance.event } : {}),
        receivedAt: now,
      };
      if (!this.#options.identity.nip44 || this.#decodePaused)
        this.#queueArchiveRecord(record);
      this.#decodeLive(event, record, origin === "live");
    }
  }

  #queueArchiveRecord(record: CommunityAgentArchiveRecord): void {
    if (this.#pendingRecords.length < 256) {
      this.#pendingRecords.push(record);
      queueMicrotask(() => void this.#flushArchive());
    } else
      this.#update({
        archiveError:
          "Activity arrived faster than it could be saved. Some new events were not archived.",
      });
  }

  async #flushArchive(): Promise<void> {
    if (this.#flushRun) {
      await this.#flushRun;
      return;
    }
    if (this.#archivePaused || this.#pendingRecords.length === 0) return;
    const archive = this.#options.archive;
    if (!archive) {
      this.#pendingRecords = [];
      this.#update({ archiveError: "This runtime cannot save agent history." });
      return;
    }
    this.#flushRun = (async () => {
      while (this.#pendingRecords.length && !this.#archivePaused) {
        const records = this.#pendingRecords.splice(0, 100);
        try {
          await archive.append(this.#archiveScope(), records);
          this.#update({
            storageMode: this.#options.storageMode(),
            archivedAgents: await archive.agents(this.#archiveScope()),
          });
        } catch {
          this.#pendingRecords.unshift(...records);
          this.#pendingRecords.length = Math.min(
            256,
            this.#pendingRecords.length,
          );
          this.#archivePaused = true;
          this.#update({
            archiveError:
              "Activity could not be saved. Existing history is safe; free storage and retry. New activity may not be archived.",
          });
        }
      }
    })();
    try {
      await this.#flushRun;
    } finally {
      this.#flushRun = undefined;
    }
  }

  #decodeLive(
    event: NostrEvent,
    record: CommunityAgentArchiveRecord,
    live = false,
  ): void {
    if (
      !this.#options.identity.nip44 ||
      this.#decodePaused ||
      this.#decodeCount >= 128
    )
      return;
    this.#decodeCount++;
    this.#decodeQueue = this.#decodeQueue
      .then(async () => {
        if (this.#closed || this.#decodePaused) return;
        try {
          const plaintext = await this.#options.identity.nip44!.decrypt(
            event.pubkey,
            event.content,
          );
          if (this.#closed) return;
          const frame = parseAgentObserver(plaintext);
          if (!frame) {
            this.#queueArchiveRecord(record);
            return;
          }
          const channel = agentTag(event, "h");
          if (channel && frame.channelId && channel !== frame.channelId) {
            this.#queueArchiveRecord(record);
            return;
          }
          if (frame.kind === "activity_sync_page") {
            if (new TextEncoder().encode(plaintext).byteLength > 48 * 1_024)
              return;
            await this.#applyActivitySyncPage(event, record, frame);
            return;
          }
          if (this.#turnControls.accept(event.pubkey, frame)) return;
          if (this.#administration.apply(event.pubkey, frame)) return;
          this.#queueArchiveRecord(record);
          this.#cacheFrame(event.id, frame);
          this.#applyControllerFrame(event.pubkey, frame, undefined, live);
          this.#applyWorkingFrame(event.pubkey, frame, event.created_at);
          this.#tick(false);
          if (
            !this.#browsingHistory &&
            this.#state.activityAgent === event.pubkey &&
            activityMatches(this.#state.activityContext, {
              agentPubkey: event.pubkey,
              ...observerScope({
                ...frame,
                ...((frame.channelId ?? channel)
                  ? { channelId: (frame.channelId ?? channel)! }
                  : {}),
              }),
            })
          )
            this.#mergeActivity([
              {
                id: event.id,
                agentPubkey: event.pubkey,
                createdAt: event.created_at,
                frame,
              },
            ]);
        } catch {
          if (!this.#closed) {
            this.#queueArchiveRecord(record);
            this.#decodePaused = true;
            this.#update({
              activityError:
                "Activity decryption failed or was declined. Encrypted capture continues; open Activity or retry to decrypt.",
            });
          }
        }
      })
      .finally(() => {
        this.#decodeCount--;
      });
  }

  #applyWorkingFrame(
    agentPubkey: string,
    frame: CommunityAgentObserver,
    freshnessTimestamp: number,
  ): void {
    const turns =
      this.#workingUntil.get(agentPubkey) ??
      new Map<string, { until: number; timestamp: number; seq: number }>();
    const turnKey = JSON.stringify([
      observerRecord(frame.payload).lifecycleRequestId ?? frame.turnId,
      observerRecord(frame.payload).scopeKey ?? frame.channelId,
    ]);
    const timestamp = Date.parse(frame.timestamp);
    const previous = turns.get(turnKey);
    if (
      previous &&
      (timestamp < previous.timestamp ||
        (timestamp === previous.timestamp && frame.seq <= previous.seq))
    )
      return;
    const payload = observerRecord(frame.payload);
    const state = activityPayloadState(
      frame.kind,
      turnFrameIsTerminal(frame.kind),
      observerText(payload.state, 40),
      observerText(payload.preview, 240),
    );
    const terminal = turnIsTerminal(state) || frame.kind === "agent_stopped";
    if (frame.kind === "agent_stopped") turns.clear();
    const statusFrame =
      ["request_status", "turn_started"].includes(frame.kind) ||
      frame.kind.startsWith("permission_");
    const until =
      !terminal &&
      (statusFrame ? state === "running" : (previous?.until ?? 0) > this.#now())
        ? Math.min(this.#now() + 180, freshnessTimestamp + 180)
        : 0;
    turns.set(turnKey, { until, timestamp, seq: frame.seq });
    if (turns.size > 512) turns.delete(turns.keys().next().value!);
    this.#workingUntil.set(agentPubkey, turns);
    if (terminal) this.#typingUntil.delete(agentPubkey);
  }

  #tick(refresh = true): void {
    this.#runtimeSnapshots.tick();
    if (this.#closed) return;
    const now = this.#now();
    let changed = false;
    const presence = { ...this.#state.presence };
    for (const [key, value] of Object.entries(presence))
      if (value.status === "online" && (value.expiresAt ?? 0) <= now) {
        presence[key] = { ...value, status: "unknown" };
        changed = true;
      }
    const working = Object.fromEntries(
      this.#state.agents.map((agent) => [
        agent.pubkey,
        Math.max(
          ...[...(this.#workingUntil.get(agent.pubkey)?.values() ?? [])].map(
            (turn) => turn.until,
          ),
          this.#typingUntil.get(agent.pubkey) ?? 0,
        ) > now,
      ]),
    );
    if (
      changed ||
      JSON.stringify(working) !== JSON.stringify(this.#state.working)
    )
      this.#update({ presence, working });
    if (refresh && now - this.#lastRefresh >= 60) void this.refresh();
    this.#sweepExpiredPermissions();
  }

  #sweepExpiredPermissions(): void {
    const patch = sweepExpiredPermissionState(this.#state, this.#now() * 1_000);
    if (patch) this.#update(patch);
  }

  async openActivity(
    pubkey: string,
    context?: string | CommunityAgentActivityContext,
  ): Promise<void> {
    this.#cancelActivitySync(true);
    const activityContext: CommunityAgentActivityContext =
      typeof context === "string"
        ? { kind: "channel", channelId: context }
        : (context ?? { kind: "overview" });
    const channelId =
      "channelId" in activityContext ? activityContext.channelId : undefined;
    if (
      !this.#state.agents.some((agent) => agent.pubkey === pubkey) &&
      !this.#state.archivedAgents.some((agent) => agent.pubkey === pubkey)
    )
      throw new Error(
        "No verified agent or local history is available for this identity",
      );
    this.#activityGeneration++;
    this.#browsingHistory = false;
    this.#cursor = undefined;
    this.#decodePaused = false;
    this.#update({
      activityAgent: pubkey,
      activityChannel: channelId,
      activityContext,
      activity: [],
      hasOlder: false,
      activityError: undefined,
      activityLoading: false,
      activitySyncStatus: undefined,
      activitySyncGap: undefined,
    });
    // Live decoded frames are already available; a stalled write must not block reading.
    void this.#flushArchive();
    void this.#requestActivitySync();
    await this.#loadActivity(true);
  }

  async syncActivity(
    context: CommunityAgentActivitySyncContext,
    agentPubkeys?: readonly string[],
  ): Promise<void> {
    const eligible = this.#state.agents
      .filter(
        (agent) =>
          (!agentPubkeys || agentPubkeys.includes(agent.pubkey)) &&
          (context.kind === "dm" ||
            (this.#ownerChannels.has(context.channelId) &&
              agent.channelIds.includes(context.channelId))),
      )
      .map((agent) => agent.pubkey)
      .sort();
    this.#cancelActivitySync(true);
    this.#syncSelection = createActivitySyncSelection(context, eligible);
    this.#syncQueue = eligible.map((agentPubkey) => ({
      agentPubkey,
      context,
    }));
    if (this.#syncQueue.length === 0) {
      this.#update({
        activitySyncStatus: undefined,
        activitySyncGap: undefined,
      });
      return;
    }
    this.#update({
      activitySyncStatus: "checking",
      activitySyncGap: undefined,
    });
    if (!eligible.every((agent) => this.#subscribedPubkeys.has(agent))) return;
    await this.#startNextActivitySync();
  }

  async #requestActivitySync(): Promise<void> {
    const agentPubkey = this.#state.activityAgent;
    const context = activitySyncContext(
      this.#state.activityContext,
      agentPubkey,
    );
    if (!agentPubkey || !context) return;
    await this.syncActivity(context, [agentPubkey]);
  }

  async #retryActivitySync(): Promise<void> {
    const selection = this.#syncSelection;
    if (selection)
      await this.syncActivity(selection.context, selection.agentPubkeys);
    else await this.#requestActivitySync();
  }

  async #startNextActivitySync(): Promise<void> {
    if (this.#syncRequest || this.#syncQueue.length === 0) return;
    const target = this.#syncQueue.shift()!;
    const archive = this.#options.archive;
    if (
      !archive ||
      !this.#options.identity.nip44 ||
      !this.#options.session.sendControl ||
      !this.#state.agents.some((agent) => agent.pubkey === target.agentPubkey)
    ) {
      this.#syncQueue = [];
      this.#update({ activitySyncStatus: "unavailable" });
      return;
    }
    const generation = this.#syncGeneration;
    try {
      const checkpoint = await archive.checkpoint(
        this.#archiveScope(),
        target.agentPubkey,
        target.context,
      );
      if (this.#closed || generation !== this.#syncGeneration) return;
      const request = {
        id: activitySyncRequestId(++this.#syncSerial),
        generation,
        agentPubkey: target.agentPubkey,
        context: target.context,
        offset: checkpoint?.offset ?? 0,
        ...(checkpoint?.streamId ? { streamId: checkpoint.streamId } : {}),
        ...(checkpoint?.notBefore !== undefined
          ? { notBefore: checkpoint.notBefore }
          : {}),
      };
      this.#syncRequest = request;
      await this.#sendActivitySyncRequest(request);
    } catch {
      if (!this.#closed && generation === this.#syncGeneration) {
        clearTimeout(this.#syncRequest?.timer);
        this.#syncRequest = undefined;
        this.#syncQueue = [];
        this.#update({ activitySyncStatus: "unavailable" });
      }
    }
  }

  async #sendActivitySyncRequest(request: ActivitySyncRequest): Promise<void> {
    clearTimeout(request.timer);
    await this.#sendControl(request.agentPubkey, {
      version: 2,
      command: "sync_activity",
      requestId: request.id,
      context: request.context,
      ...(request.streamId
        ? { cursor: { streamId: request.streamId, offset: request.offset } }
        : {}),
      ...(request.highWaterMark !== undefined
        ? { highWaterMark: request.highWaterMark }
        : {}),
      ...(request.notBefore !== undefined
        ? { notBefore: request.notBefore }
        : {}),
      ...(request.context.kind === "dm"
        ? {}
        : { channelId: request.context.channelId }),
    });
    if (this.#syncRequest !== request) return;
    request.timer = setTimeout(() => {
      if (this.#syncRequest !== request) return;
      this.#syncRequest = undefined;
      this.#syncQueue = [];
      this.#update({ activitySyncStatus: "unavailable" });
    }, 10_000);
  }

  #cancelActivitySync(incrementGeneration = false): void {
    clearTimeout(this.#syncRequest?.timer);
    this.#syncRequest = undefined;
    this.#syncQueue = [];
    if (incrementGeneration) this.#syncGeneration++;
  }

  async #applyActivitySyncPage(
    outer: NostrEvent,
    authorization: CommunityAgentArchiveRecord,
    frame: CommunityAgentObserver,
  ): Promise<void> {
    const request = this.#syncRequest;
    const payload = observerRecord(frame.payload);
    if (!request || observerText(payload.requestId, 128) !== request.id) return;
    try {
      if (
        this.#closed ||
        request.generation !== this.#syncGeneration ||
        request.agentPubkey !== outer.pubkey ||
        frame.streamId !== payload.streamId
      )
        throw new Error("stale activity sync response");
      const context = parseActivitySyncContext(payload.context);
      if (!context || !sameActivitySyncContext(context, request.context))
        throw new Error("activity sync context mismatch");
      const afterOffset = syncInteger(payload.afterOffset);
      const nextOffset = syncInteger(payload.nextOffset);
      const highWaterMark = syncInteger(payload.highWaterMark);
      const streamId = observerText(payload.streamId, 128);
      const complete = payload.complete;
      const streamChanged = payload.streamChanged === true;
      if (
        !streamId ||
        highWaterMark === undefined ||
        afterOffset === undefined ||
        nextOffset === undefined ||
        typeof complete !== "boolean" ||
        nextOffset < afterOffset ||
        nextOffset > highWaterMark ||
        (complete && nextOffset !== highWaterMark) ||
        (!complete && nextOffset === afterOffset) ||
        (request.highWaterMark !== undefined &&
          request.highWaterMark !== highWaterMark) ||
        (request.streamId === streamId && afterOffset !== request.offset) ||
        (request.streamId &&
          request.streamId !== streamId &&
          (!streamChanged || afterOffset !== 0)) ||
        (!request.streamId && afterOffset !== 0) ||
        !Array.isArray(payload.events) ||
        payload.events.length > 50 ||
        !Array.isArray(payload.snapshotEvents) ||
        payload.snapshotEvents.length > 64
      )
        throw new Error("invalid activity sync page");
      const events = await this.#decodeActivitySyncEvents(
        payload.events,
        authorization,
        request,
        streamId,
        afterOffset,
        highWaterMark,
        true,
      );
      const snapshots = await this.#decodeActivitySyncEvents(
        payload.snapshotEvents,
        authorization,
        request,
        streamId,
        0,
        undefined,
        false,
      );
      if (
        this.#syncRequest !== request ||
        request.generation !== this.#syncGeneration
      )
        return;
      const snapshotScopeKeys = snapshots.map(({ frame: snapshot }) =>
        observerText(observerRecord(snapshot.payload).scopeKey, 4_096),
      );
      if (snapshotScopeKeys.some((scopeKey) => !scopeKey))
        throw new Error("activity snapshots do not identify one scope");
      if (events.some(({ frame }) => frame.seq > nextOffset))
        throw new Error("activity page cursor precedes an event");
      const archive = this.#options.archive;
      if (!archive) throw new Error("activity archive unavailable");
      await archive.commitSyncPage(
        this.#archiveScope(),
        request.agentPubkey,
        request.context,
        events.map(({ event }) => ({
          event,
          profile: authorization.profile,
          ...(authorization.instance
            ? { instance: authorization.instance }
            : {}),
          receivedAt: this.#now(),
        })),
        {
          streamId,
          offset: nextOffset,
          ...(request.notBefore !== undefined
            ? { notBefore: request.notBefore }
            : {}),
          updatedAt: this.#now(),
        },
      );
      if (this.#syncRequest !== request) return;
      const snapshotScopeKey = snapshotScopeKeys[0];
      const snapshotSequence = Math.max(
        0,
        ...snapshots.map(({ frame: snapshot }) => snapshot.seq),
      );
      const currentSequence = snapshotScopeKey
        ? this.#frames.sequences.get(
            JSON.stringify([
              controllerScopeId(request.agentPubkey, snapshotScopeKey),
              streamId,
            ]),
          )
        : undefined;
      if (
        snapshotScopeKey &&
        (currentSequence === undefined || currentSequence <= snapshotSequence)
      )
        this.#update({
          pendingPermissions: replaceScopePendingPermissions(
            this.#state.pendingPermissions,
            request.agentPubkey,
            snapshotScopeKey,
            this.#frames.permissions.snapshot(
              request.agentPubkey,
              snapshots.map(({ frame }) => frame),
              this.#now() * 1_000,
            ),
          ),
        });
      this.#sweepExpiredPermissions();
      for (const item of events) {
        this.#seen.add(item.event.id);
        this.#cacheFrame(item.event.id, item.frame);
      }
      if (
        this.#state.activityAgent === request.agentPubkey &&
        activitySyncContext(this.#state.activityContext, request.agentPubkey) &&
        sameActivitySyncContext(
          activitySyncContext(
            this.#state.activityContext,
            request.agentPubkey,
          )!,
          request.context,
        )
      )
        this.#mergeActivity(
          events.map(({ event, frame }) => ({
            id: event.id,
            agentPubkey: request.agentPubkey,
            createdAt: event.created_at,
            frame,
          })),
        );
      for (const snapshot of snapshots.toSorted(
        (left, right) => left.frame.seq - right.frame.seq,
      )) {
        this.#applyControllerFrame(
          request.agentPubkey,
          snapshot.frame,
          outer.created_at * 1_000,
          false,
          true,
        );
        this.#applyWorkingFrame(
          request.agentPubkey,
          snapshot.frame,
          outer.created_at,
        );
      }
      this.#tick(false);
      const gap = Boolean(payload.migrationGap || payload.replayGap);
      if (complete) {
        clearTimeout(request.timer);
        this.#syncSelection?.pending.delete(request.agentPubkey);
        this.#syncRequest = undefined;
        if (this.#syncQueue.length > 0) {
          this.#update({
            activitySyncStatus: "checking",
            activitySyncGap: gap || this.#state.activitySyncGap,
          });
          await this.#startNextActivitySync();
        } else
          this.#update({
            activitySyncStatus: "caught-up",
            activitySyncGap: gap || this.#state.activitySyncGap,
          });
        return;
      }
      request.offset = nextOffset;
      request.streamId = streamId;
      request.highWaterMark = highWaterMark;
      this.#update({
        activitySyncStatus: "checking",
        activitySyncGap: gap || this.#state.activitySyncGap,
      });
      await this.#sendActivitySyncRequest(request);
    } catch {
      if (this.#syncRequest === request) {
        clearTimeout(request.timer);
        this.#syncRequest = undefined;
        this.#syncQueue = [];
        this.#update({ activitySyncStatus: "unavailable" });
      }
    }
  }

  async #decodeActivitySyncEvents(
    values: readonly unknown[],
    authorization: CommunityAgentArchiveRecord,
    request: ActivitySyncRequest,
    streamId: string,
    afterOffset: number,
    maximumOffset: number | undefined,
    requireIncreasing: boolean,
  ): Promise<Array<{ event: NostrEvent; frame: CommunityAgentObserver }>> {
    const nip44 = this.#options.identity.nip44;
    if (!nip44) throw new Error("activity decryption unavailable");
    const decoded: Array<{ event: NostrEvent; frame: CommunityAgentObserver }> =
      [];
    let previousOffset = afterOffset;
    for (const value of values) {
      const event = signedAgentEvent(value as NostrEvent);
      if (
        !event ||
        event.pubkey !== request.agentPubkey ||
        !validateAgentTelemetry(
          event,
          authorization.profile,
          this.#options.scope.ownerPubkey,
          undefined,
          this.#directory?.relayPubkey,
          authorization.instance,
        )
      )
        throw new Error("invalid nested activity event");
      const nested = parseAgentObserver(
        await nip44.decrypt(event.pubkey, event.content),
      );
      if (
        !nested ||
        nested.kind === "activity_sync_page" ||
        nested.streamId !== streamId ||
        (maximumOffset !== undefined && nested.seq > maximumOffset) ||
        (requireIncreasing && nested.seq <= previousOffset) ||
        !frameMatchesActivitySyncContext(nested, request.context) ||
        !eventMatchesActivitySyncContext(event, request.context)
      )
        throw new Error("nested activity does not match its page");
      previousOffset = nested.seq;
      decoded.push({ event, frame: nested });
    }
    return decoded;
  }

  async #loadActivity(reset: boolean): Promise<void> {
    if (
      this.#closed ||
      this.#state.activityLoading ||
      !this.#state.activityAgent ||
      (!reset && !this.#state.hasOlder)
    )
      return;
    const generation = this.#activityGeneration;
    if (!reset) this.#browsingHistory = true;
    const agent = this.#state.activityAgent;
    const channel = this.#state.activityChannel;
    const context = this.#state.activityContext;
    const deadline = Date.now() + 15_000;
    const nip44 = this.#options.identity.nip44;
    if (!nip44) {
      this.#update({
        activityError:
          "Connect a signer that supports NIP-44 to decrypt saved activity.",
      });
      return;
    }
    if (!this.#options.archive) {
      this.#update({
        activityError: "Saved activity is unavailable in this runtime.",
      });
      return;
    }
    this.#update({ activityLoading: true, activityError: undefined });
    try {
      const items: CommunityAgentActivityItem[] = [];
      let pages = 0;
      let hasOlder = false;
      do {
        const page = await historyDeadline(
          this.#options.archive.page({
            scope: this.#archiveScope(),
            agentPubkey: agent,
            limit: 50,
            ...(this.#cursor ? { before: this.#cursor } : {}),
          }),
          deadline,
        );
        for (const record of page.records) {
          if (this.#closed || generation !== this.#activityGeneration) return;
          if (
            !validateAgentTelemetry(
              record.event,
              record.profile,
              this.#options.scope.ownerPubkey,
              undefined,
              this.#directory?.relayPubkey,
              record.instance,
            )
          )
            continue;
          const cached = this.#decodedFrames.get(record.event.id);
          const frame =
            cached ??
            parseAgentObserver(
              await historyDeadline(
                nip44.decrypt(record.event.pubkey, record.event.content),
                deadline,
              ),
            );
          if (this.#closed || generation !== this.#activityGeneration) return;
          const outerChannel = agentTag(record.event, "h");
          if (
            !frame ||
            (outerChannel &&
              frame.channelId &&
              outerChannel !== frame.channelId) ||
            ((frame.channelId ?? outerChannel) &&
              !this.#ownerChannels.has((frame.channelId ?? outerChannel)!)) ||
            (channel && (frame.channelId ?? outerChannel) !== channel) ||
            !activityMatches(context, {
              agentPubkey: agent,
              ...observerScope({
                ...frame,
                ...((frame.channelId ?? outerChannel)
                  ? { channelId: (frame.channelId ?? outerChannel)! }
                  : {}),
              }),
            })
          )
            continue;
          this.#cacheFrame(record.event.id, frame);
          items.push({
            id: record.event.id,
            agentPubkey: agent,
            createdAt: record.event.created_at,
            frame: {
              ...frame,
              ...((frame.channelId ?? outerChannel)
                ? { channelId: (frame.channelId ?? outerChannel)! }
                : {}),
            },
          });
          if (items.length === 1) this.#mergeActivity(items, !reset);
        }
        if (this.#closed || generation !== this.#activityGeneration) return;
        this.#mergeActivity(items, !reset);
        this.#cursor = page.cursor;
        hasOlder = page.hasOlder;
      } while (hasOlder && this.#cursor && items.length < 50 && ++pages < 10);
      this.#mergeActivity(items, !reset);
      this.#update({ hasOlder });
    } catch (cause) {
      if (!this.#closed && generation === this.#activityGeneration)
        this.#update({
          activityError:
            cause instanceof Error && cause.message === "history_timeout"
              ? "Saved activity is taking too long to load. Select Latest to retry."
              : "Saved activity could not be read or decrypted. Your history is retained; retry with the owner’s signer.",
        });
    } finally {
      if (generation === this.#activityGeneration)
        this.#update({ activityLoading: false });
    }
  }

  #cacheFrame(id: string, frame: CommunityAgentActivityItem["frame"]): void {
    this.#decodedFrames.set(id, frame);
    if (this.#decodedFrames.size > 500)
      this.#decodedFrames.delete(this.#decodedFrames.keys().next().value!);
  }

  #mergeActivity(
    items: readonly CommunityAgentActivityItem[],
    older = false,
  ): void {
    const merged = [
      ...new Map(
        [...this.#state.activity, ...items].map((item) => [item.id, item]),
      ).values(),
    ].sort(
      (a, b) =>
        b.createdAt - a.createdAt ||
        Date.parse(b.frame.timestamp) - Date.parse(a.frame.timestamp) ||
        b.id.localeCompare(a.id),
    );
    // History is paged from storage; only a bounded decoded window is retained.
    this.#update({
      activity: older ? merged.slice(-500) : merged.slice(0, 500),
    });
  }

  async #sendControl(
    pubkey: string,
    control: Parameters<NonNullable<CommunityAgentSession["sendControl"]>>[1],
  ): Promise<void> {
    if (!this.#state.agents.some((agent) => agent.pubkey === pubkey))
      throw new Error("Agent control requires a current verified agent");
    if (!this.#options.session.sendControl)
      throw new Error("Agent runtime control is unavailable in this session");
    await this.#options.session.sendControl(
      pubkey,
      control,
      this.#abort.signal,
    );
  }

  #applyControllerFrame(
    agentPubkey: string,
    frame: CommunityAgentActivityItem["frame"],
    observedAt?: number,
    live = false,
    snapshot = false,
  ): void {
    const patch = this.#frames.apply(
      this.#state,
      agentPubkey,
      frame,
      this.#now() * 1000,
      observedAt,
      live,
      snapshot,
    );
    if (patch) this.#update(patch);
    this.#sweepExpiredPermissions();
  }

  dispose(): void {
    this.#closed = true;
    this.#turnControls.dispose();
    this.#cancelActivitySync(true);
    this.#activityGeneration++;
    this.#abort.abort();
    this.#subscription?.close();
    this.#subscribedPubkeys.clear();
    if (this.#timer) clearInterval(this.#timer);
    if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
    this.#administration.dispose();
    this.#runtimeSnapshots.dispose();
    this.#unknownFrames = [];
    this.#workingUntil.clear();
    this.#frames.sequences.clear();
    this.#typingUntil.clear();
    this.#decodedFrames.clear();
    this.#state = {
      ...this.#state,
      agents: [],
      personas: [],
      setupDrafts: [],
      archivedAgents: [],
      activity: [],
      working: {},
      presence: {},
      controllerScopes: {},
      conversationScopes: {},
      publicWorking: [],
      publicAgents: [],
      pendingPermissions: {},
      processing: {},
      runtime: {},
      runtimeRefresh: {},
      memories: {},
    };
    void this.#flushArchive();
  }
}

function activitySyncContext(
  context: CommunityAgentActivityContext | undefined,
  agentPubkey: string | undefined,
): CommunityAgentActivitySyncContext | undefined {
  if (!context || context.kind === "overview") return;
  if (context.kind === "dm")
    return !context.agentPubkey || context.agentPubkey === agentPubkey
      ? {
          kind: "dm",
          ...(context.conversationId
            ? { conversationId: context.conversationId }
            : {}),
        }
      : undefined;
  return context.kind === "channel"
    ? { kind: "channel", channelId: context.channelId }
    : {
        kind: context.kind,
        channelId: context.channelId,
        threadRootId: context.threadRootId,
      };
}

function parseActivitySyncContext(
  value: unknown,
): CommunityAgentActivitySyncContext | undefined {
  const context = observerRecord(value);
  if (
    context.kind === "dm" &&
    observerHasOnlyKeys(context, ["kind", "conversationId"]) &&
    (context.conversationId === undefined ||
      (typeof context.conversationId === "string" &&
        /^[0-9a-f]{64}$/u.test(context.conversationId)))
  )
    return {
      kind: "dm",
      ...(typeof context.conversationId === "string"
        ? { conversationId: context.conversationId }
        : {}),
    };
  const channelId = observerText(context.channelId, 256);
  if (!channelId) return;
  if (
    context.kind === "channel" &&
    observerHasOnlyKeys(context, ["kind", "channelId"])
  )
    return { kind: "channel", channelId };
  const threadRootId = observerText(context.threadRootId, 256);
  if (
    (context.kind === "thread" || context.kind === "forum-topic") &&
    threadRootId &&
    observerHasOnlyKeys(context, ["kind", "channelId", "threadRootId"])
  )
    return { kind: context.kind, channelId, threadRootId };
}

function observerHasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function sameActivitySyncContext(
  left: CommunityAgentActivitySyncContext,
  right: CommunityAgentActivitySyncContext,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function frameMatchesActivitySyncContext(
  frame: CommunityAgentObserver,
  context: CommunityAgentActivitySyncContext,
): boolean {
  const scope = observerScope(frame);
  if (context.kind === "dm")
    return (
      scope.conversationKind === "dm" &&
      (!context.conversationId ||
        scope.conversationId === context.conversationId)
    );
  if (
    scope.channelId !== context.channelId ||
    scope.conversationKind !== context.kind
  )
    return false;
  return (
    context.kind === "channel" || scope.threadRootId === context.threadRootId
  );
}

function eventMatchesActivitySyncContext(
  event: NostrEvent,
  context: CommunityAgentActivitySyncContext,
): boolean {
  const groups = event.tags.filter(([name]) => name === "h");
  return context.kind === "dm"
    ? groups.length === 0
    : groups.length === 1 && groups[0]?.[1] === context.channelId;
}

function syncInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function activitySyncRequestId(serial: number): string {
  return globalThis.crypto?.randomUUID?.() ?? `sync-${Date.now()}-${serial}`;
}

async function historyDeadline<T>(
  operation: Promise<T>,
  deadline: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("history_timeout")),
          Math.max(0, deadline - Date.now()),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
