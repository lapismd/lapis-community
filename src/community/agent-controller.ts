import {
  activityMatches,
  observerScope,
  controllerScopeId,
} from "./agent-activity-context.js";
import type { CommunityAgentActivityContext } from "./agent-contracts.js";
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
  CommunityAgentPermissionDecision,
  CommunityAgentPermissionRequest,
  CommunityAgentsActions,
  CommunityAgentsState,
  CommunityAgentSession,
} from "./agent-contracts.js";
import {
  AGENT_TYPING_TTL,
  agentPresence,
  agentChannelMemberships,
  agentTag,
  parseAgentObserver,
  signedAgentEvent,
  validateAgentTelemetry,
} from "./agent-protocol.js";

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
  #directory: CommunityAgentDirectory | undefined;
  #ownerChannels = new Set<string>();
  #metadataIds = new Set<string>();
  #seen = new Set<string>();
  #unknownFrames: NostrEvent[] = [];
  #workingUntil = new Map<
    string,
    Map<string, { until: number; timestamp: number; seq: number }>
  >();
  #controllerSequence = new Map<string, number>();
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
  #state: CommunityAgentsState;

  readonly actions: CommunityAgentsActions = {
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
      await archive.clear(this.#options.scope, pubkey);
      if (this.#closed) return;
      this.#archivePaused = false;
      this.#update({
        archiveError: undefined,
        archivedAgents: await archive.agents(this.#options.scope),
        ...(!pubkey || this.#state.activityAgent === pubkey
          ? { activity: [], hasOlder: false, activityLoading: false }
          : {}),
      });
      void this.#flushArchive();
    },
    cancelTurn: async (pubkey, scopeKey, channelId, expected) => {
      const scope =
        this.#state.conversationScopes?.[controllerScopeId(pubkey, scopeKey)] ??
        this.#state.controllerScopes[pubkey];
      if (!scope || !scope.active || scope.scopeKey !== scopeKey)
        throw new Error("No active controller turn is available to cancel");
      if (
        expected &&
        (scope.sessionId !== expected.sessionId ||
          (scope.active ? (scope.turnId ?? "") : "") !== expected.turnId)
      )
        throw new Error("The displayed turn is no longer current");
      await this.#sendControl(pubkey, {
        version: 1,
        command: "cancel_turn",
        scopeKey,
        ...(scope.sessionId ? { expectedSessionId: scope.sessionId } : {}),
        expectedTurnId:
          expected?.turnId ?? (scope.active ? (scope.turnId ?? "") : ""),
        ...(channelId ? { channelId } : {}),
      });
    },
    resetConversation: async (pubkey, scopeKey, channelId, expected) => {
      const scope =
        this.#state.conversationScopes?.[controllerScopeId(pubkey, scopeKey)] ??
        this.#state.controllerScopes[pubkey];
      if (!scope || scope.scopeKey !== scopeKey)
        throw new Error("No controller conversation is available to reset");
      if (
        expected &&
        (scope.sessionId !== expected.sessionId ||
          (scope.active ? (scope.turnId ?? "") : "") !== expected.turnId)
      )
        throw new Error("The displayed conversation has changed");
      await this.#sendControl(pubkey, {
        version: 1,
        command: "reset_conversation",
        scopeKey,
        ...(scope.sessionId ? { expectedSessionId: scope.sessionId } : {}),
        expectedTurnId:
          expected?.turnId ?? (scope.active ? (scope.turnId ?? "") : ""),
        ...(channelId ? { channelId } : {}),
      });
    },
    respondPermission: async (pubkey, requestId, decision, channelId) => {
      const request = (this.#state.pendingPermissions[pubkey] ?? []).find(
        (candidate) => candidate.requestId === requestId,
      );
      if (!request || !request.options.includes(decision))
        throw new Error(
          "The controller permission choice is no longer available",
        );
      if (request.expiresAt && request.expiresAt <= this.#now() * 1_000)
        throw new Error("The controller permission request has expired");
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
  };

  constructor(options: AgentControllerOptions) {
    this.#options = options;
    this.#state = {
      status: "loading",
      agents: [],
      personas: [],
      archivedAgents: [],
      capabilities: { directory: true, presence: false, activity: false },
      presence: {},
      working: {},
      controllerScopes: {},
      conversationScopes: {},
      publicWorking: [],
      publicAgents: [],
      pendingPermissions: {},
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

  #update(patch: {
    [K in keyof CommunityAgentsState]?: CommunityAgentsState[K] | undefined;
  }): void {
    if (this.#closed) return;
    const next = { ...this.#state, ...patch };
    for (const key of Object.keys(next))
      if (next[key as keyof typeof next] === undefined)
        delete next[key as keyof typeof next];
    this.#state = next as CommunityAgentsState;
    this.#options.onState(this.#state);
  }

  async start(): Promise<void> {
    this.#options.onState(this.#state);
    void this.#loadArchivedAgents();
    await this.refresh();
    if (!this.#closed) this.#timer = setInterval(() => this.#tick(), 1_000);
  }

  async #loadArchivedAgents(): Promise<void> {
    try {
      const archivedAgents =
        (await this.#options.archive?.agents(this.#options.scope)) ?? [];
      this.#update({
        archivedAgents,
        storageMode: this.#options.storageMode(),
      });
    } catch {
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
      for (const key of this.#workingUntil.keys())
        if (!allowed.has(key)) this.#workingUntil.delete(key);
      for (const key of this.#typingUntil.keys())
        if (!allowed.has(key)) this.#typingUntil.delete(key);
      this.#update({
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
      const pubkeys = [...allowed].sort();
      const key = JSON.stringify([
        directory.relayPubkey,
        directory.capabilities,
        pubkeys,
      ]);
      if (key !== this.#subscriptionKey) {
        // Open the replacement first; event IDs deduplicate the overlap.
        const subscription = await this.#options.session.subscribe(
          pubkeys,
          {
            onevent: (event) => this.#receive(event),
            onclose: () => {
              this.#subscriptionKey = "";
              this.#workingUntil.clear();
              this.#typingUntil.clear();
              this.#update({
                status: "offline",
                working: {},
                presence: {},
                error: "Agent connection interrupted. Reconnecting…",
              });
              this.#scheduleRefresh();
            },
          },
          this.#abort.signal,
        );
        if (this.#closed) {
          subscription.close();
          return;
        }
        this.#subscription?.close();
        this.#subscription = subscription;
        this.#subscriptionKey = key;
      }
      if (directory.capabilities.directory) this.#update({ status: "ready" });
      const pending = this.#unknownFrames;
      this.#unknownFrames = [];
      for (const event of pending)
        if (allowed.has(event.pubkey)) this.#receive(event);
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

  #receive(input: NostrEvent): void {
    if (this.#closed) return;
    const event = signedAgentEvent(input);
    if (!event) return;
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
        this.#unknownFrames.push(event);
        this.#scheduleRefresh();
      }
      return;
    }
    const now = this.#now();
    if (event.kind === 20001) {
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
      if (this.#pendingRecords.length < 256) {
        this.#pendingRecords.push({
          event,
          profile: agent.profile,
          receivedAt: now,
        });
        queueMicrotask(() => void this.#flushArchive());
      } else
        this.#update({
          archiveError:
            "Activity arrived faster than it could be saved. Some new events were not archived.",
        });
      this.#decodeLive(event);
    }
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
          await archive.append(this.#options.scope, records);
          this.#update({
            storageMode: this.#options.storageMode(),
            archivedAgents: await archive.agents(this.#options.scope),
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

  #decodeLive(event: NostrEvent): void {
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
          if (!frame) return;
          const channel = agentTag(event, "h");
          if (channel && frame.channelId && channel !== frame.channelId) return;
          this.#cacheFrame(event.id, frame);
          this.#applyControllerFrame(event.pubkey, frame);
          const turns =
            this.#workingUntil.get(event.pubkey) ??
            new Map<
              string,
              { until: number; timestamp: number; seq: number }
            >();
          const turnKey = JSON.stringify([
            observerRecord(frame.payload).lifecycleRequestId ?? frame.turnId,
            observerRecord(frame.payload).scopeKey ?? frame.channelId,
          ]);
          const timestamp = Date.parse(frame.timestamp);
          const previous = turns.get(turnKey);
          if (
            !previous ||
            timestamp > previous.timestamp ||
            (timestamp === previous.timestamp && frame.seq > previous.seq)
          ) {
            const terminal = [
              "turn_completed",
              "turn_finished",
              "turn_failed",
              "turn_cancelled",
              "agent_stopped",
            ].includes(frame.kind);
            if (frame.kind === "agent_stopped") turns.clear();
            const until = terminal
              ? 0
              : frame.kind === "turn_started" ||
                  frame.kind === "request_status" ||
                  (previous?.until ?? 0) > this.#now()
                ? Math.min(this.#now() + 180, event.created_at + 180)
                : 0;
            turns.set(turnKey, { until, timestamp, seq: frame.seq });
            // Retain terminal ordering briefly without growing with archived history.
            if (turns.size > 512) turns.delete(turns.keys().next().value!);
            this.#workingUntil.set(event.pubkey, turns);
            if (terminal) this.#typingUntil.delete(event.pubkey);
          }
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

  #tick(refresh = true): void {
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
  }

  async openActivity(
    pubkey: string,
    context?: string | CommunityAgentActivityContext,
  ): Promise<void> {
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
    });
    // Live decoded frames are already available; a stalled write must not block reading.
    void this.#flushArchive();
    await this.#loadActivity(true);
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
            scope: this.#options.scope,
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
  ): void {
    const payload = observerRecord(frame.payload);
    const scopeKey = observerText(payload.scopeKey, 4_096);
    const key = controllerScopeId(agentPubkey, scopeKey);
    const previousSequence = this.#controllerSequence.get(key);
    if (previousSequence !== undefined && frame.seq <= previousSequence) return;
    this.#controllerSequence.set(key, frame.seq);
    const terminal = [
      "turn_completed",
      "turn_finished",
      "turn_failed",
      "turn_cancelled",
    ].includes(frame.kind);
    const previous = this.#state.conversationScopes?.[key];
    const requestId =
      observerText(payload.lifecycleRequestId, 512) ||
      (frame.kind.startsWith("permission_")
        ? previous?.requestId || frame.turnId
        : observerText(payload.requestId, 512) || frame.turnId);
    if (
      terminal &&
      previous?.active &&
      previous.requestId &&
      requestId &&
      previous.requestId !== requestId
    )
      return;
    if (scopeKey) {
      const state = terminal
        ? frame.kind === "turn_failed"
          ? "failed"
          : frame.kind === "turn_cancelled"
            ? "cancelled"
            : "completed"
        : frame.kind === "permission_requested"
          ? "waiting_permission"
          : frame.kind === "permission_resolved"
            ? "running"
            : observerText(payload.state, 40) || "running";
      const sameRequest = previous?.requestId === requestId;
      const waiting =
        state === "waiting_permission" ||
        (sameRequest &&
          previous?.state === "waiting_permission" &&
          frame.kind !== "permission_resolved" &&
          !terminal);
      const scope = {
        agentPubkey,
        scopeKey,
        ...observerScope(frame),
        active:
          !terminal && !["completed", "failed", "cancelled"].includes(state),
        state: waiting ? "waiting_permission" : state,
        preview: waiting
          ? "Waiting for your permission"
          : observerText(payload.preview, 240) ||
            observerText(payload.message, 240) ||
            (sameRequest && frame.kind !== "permission_resolved"
              ? previous?.preview
              : undefined) ||
            (state === "queued"
              ? "Queued"
              : state === "starting"
                ? "Starting"
                : "Working"),
        severity:
          observerText(payload.severity, 20) ||
          (frame.kind === "turn_failed" ? "error" : "info"),
        updatedAt: Date.parse(frame.timestamp),
        ...(requestId ? { requestId } : {}),
        ...(frame.channelId ? { channelId: frame.channelId } : {}),
        ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
        ...(frame.turnId ? { turnId: frame.turnId } : {}),
      };
      this.#update({
        controllerScopes: {
          ...this.#state.controllerScopes,
          [agentPubkey]: scope,
        },
        conversationScopes: { ...this.#state.conversationScopes, [key]: scope },
      });
    }
    if (terminal)
      this.#update({
        publicWorking: (this.#state.publicWorking ?? []).filter(
          (signal) =>
            !(
              signal.agentPubkey === agentPubkey &&
              signal.channelId === frame.channelId &&
              signal.threadRootId === observerScope(frame).threadRootId
            ),
        ),
      });
    if (frame.kind === "permission_requested") {
      const request = controllerPermission(agentPubkey, frame, payload);
      if (!request) return;
      const current = this.#state.pendingPermissions[agentPubkey] ?? [];
      this.#update({
        pendingPermissions: {
          ...this.#state.pendingPermissions,
          [agentPubkey]: [
            ...current.filter(
              (candidate) => candidate.requestId !== request.requestId,
            ),
            request,
          ].slice(-32),
        },
      });
      return;
    }
    if (frame.kind === "permission_resolved") {
      const requestId = observerText(payload.requestId, 512);
      if (requestId)
        this.#update({
          pendingPermissions: {
            ...this.#state.pendingPermissions,
            [agentPubkey]: (
              this.#state.pendingPermissions[agentPubkey] ?? []
            ).filter((request) => request.requestId !== requestId),
          },
        });
    } else if (terminal && frame.turnId) {
      this.#update({
        pendingPermissions: {
          ...this.#state.pendingPermissions,
          [agentPubkey]: (
            this.#state.pendingPermissions[agentPubkey] ?? []
          ).filter((request) => request.turnId !== frame.turnId),
        },
      });
    }
  }

  dispose(): void {
    this.#closed = true;
    this.#activityGeneration++;
    this.#abort.abort();
    this.#subscription?.close();
    if (this.#timer) clearInterval(this.#timer);
    if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
    this.#unknownFrames = [];
    this.#workingUntil.clear();
    this.#controllerSequence.clear();
    this.#typingUntil.clear();
    this.#decodedFrames.clear();
    this.#state = {
      ...this.#state,
      agents: [],
      personas: [],
      archivedAgents: [],
      activity: [],
      working: {},
      presence: {},
      controllerScopes: {},
      conversationScopes: {},
      publicWorking: [],
      publicAgents: [],
      pendingPermissions: {},
    };
    void this.#flushArchive();
  }
}

const CONTROLLER_PERMISSION_DECISIONS =
  new Set<CommunityAgentPermissionDecision>([
    "allow_once",
    "allow_always",
    "reject_once",
    "reject_always",
    "cancel",
  ]);

function controllerPermission(
  agentPubkey: string,
  frame: CommunityAgentActivityItem["frame"],
  payload: Record<string, unknown>,
): CommunityAgentPermissionRequest | undefined {
  const requestId = observerText(payload.requestId, 512);
  const scopeKey = observerText(payload.scopeKey, 4_096);
  const tool = observerText(payload.tool, 512);
  const options = Array.isArray(payload.options)
    ? [
        ...new Set(
          payload.options.filter(
            (value): value is CommunityAgentPermissionDecision =>
              typeof value === "string" &&
              CONTROLLER_PERMISSION_DECISIONS.has(
                value as CommunityAgentPermissionDecision,
              ),
          ),
        ),
      ]
    : [];
  if (!requestId || !scopeKey || !tool || options.length === 0) return;
  const expiresAt = Number(payload.expiresAt);
  return {
    agentPubkey,
    requestId,
    scopeKey,
    tool,
    ...(payload.input === undefined ? {} : { input: payload.input }),
    options,
    ...(Number.isSafeInteger(expiresAt) && expiresAt > 0 ? { expiresAt } : {}),
    ...(frame.channelId ? { channelId: frame.channelId } : {}),
    ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
    ...(frame.turnId ? { turnId: frame.turnId } : {}),
  };
}

function observerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function observerText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
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
