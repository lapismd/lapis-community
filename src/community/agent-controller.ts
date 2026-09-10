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
  #typingUntil = new Map<string, number>();
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
          this.#state.activityChannel,
        );
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
  };

  constructor(options: AgentControllerOptions) {
    this.#options = options;
    this.#state = {
      status: "loading",
      agents: [],
      archivedAgents: [],
      capabilities: { directory: true, presence: false, activity: false },
      presence: {},
      working: {},
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
    if (this.#closed) return;
    await this.refresh();
    if (!this.#closed) this.#timer = setInterval(() => this.#tick(), 1_000);
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
      const allowed = new Set(directory.agents.map((agent) => agent.pubkey));
      for (const key of this.#workingUntil.keys())
        if (!allowed.has(key)) this.#workingUntil.delete(key);
      for (const key of this.#typingUntil.keys())
        if (!allowed.has(key)) this.#typingUntil.delete(key);
      this.#update({
        agents: directory.agents,
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
    const agent = this.#state.agents.find(
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
          const turns =
            this.#workingUntil.get(event.pubkey) ??
            new Map<
              string,
              { until: number; timestamp: number; seq: number }
            >();
          const turnKey = JSON.stringify([
            frame.startedAt,
            frame.agentIndex,
            frame.sessionId,
            frame.turnId,
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
            (!this.#state.activityChannel ||
              (frame.channelId ?? channel) === this.#state.activityChannel)
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

  async openActivity(pubkey: string, channelId?: string): Promise<void> {
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
      activity: [],
      hasOlder: false,
      activityError: undefined,
      activityLoading: false,
    });
    await this.#flushArchive();
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
      const page = await this.#options.archive.page({
        scope: this.#options.scope,
        agentPubkey: agent,
        limit: 50,
        ...(this.#cursor ? { before: this.#cursor } : {}),
      });
      const items: CommunityAgentActivityItem[] = [];
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
        const plaintext = await nip44.decrypt(
          record.event.pubkey,
          record.event.content,
        );
        if (this.#closed || generation !== this.#activityGeneration) return;
        const frame = parseAgentObserver(plaintext);
        const outerChannel = agentTag(record.event, "h");
        if (
          !frame ||
          (outerChannel &&
            frame.channelId &&
            outerChannel !== frame.channelId) ||
          (channel && (frame.channelId ?? outerChannel) !== channel)
        )
          continue;
        items.push({
          id: record.event.id,
          agentPubkey: agent,
          createdAt: record.event.created_at,
          frame,
        });
      }
      if (this.#closed || generation !== this.#activityGeneration) return;
      this.#cursor = page.cursor;
      this.#mergeActivity(items, !reset);
      this.#update({ hasOlder: page.hasOlder });
    } catch {
      if (!this.#closed && generation === this.#activityGeneration)
        this.#update({
          activityError:
            "Saved activity could not be read or decrypted. Your history is retained; retry with the owner’s signer.",
        });
    } finally {
      if (generation === this.#activityGeneration)
        this.#update({ activityLoading: false });
    }
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

  dispose(): void {
    this.#closed = true;
    this.#activityGeneration++;
    this.#abort.abort();
    this.#subscription?.close();
    if (this.#timer) clearInterval(this.#timer);
    if (this.#refreshTimer) clearTimeout(this.#refreshTimer);
    this.#unknownFrames = [];
    this.#workingUntil.clear();
    this.#typingUntil.clear();
    this.#state = {
      ...this.#state,
      agents: [],
      archivedAgents: [],
      activity: [],
      working: {},
      presence: {},
    };
    void this.#flushArchive();
  }
}
