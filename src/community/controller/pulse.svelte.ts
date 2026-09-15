import type { NostrEvent } from "../../protocol/index.js";
import type { CommunityAgentsState } from "../agent-contracts.js";
import type { CommunityComposerSubmission } from "../composer-model.js";
import type {
  CommunityCommand,
  CommunityIdentity,
  CommunityOperationFailure,
  CommunityPulseModel,
  CommunityPulseOptions,
  CommunityPulseTab,
  CommunitySession,
} from "../contracts.js";
import { materializeCommunityPulse } from "../materialize-pulse.js";
import { isAbort } from "./abort.js";
import {
  publishPulse as publishPulseNote,
  rematerializePulse,
  togglePulseLike as togglePulseLikeAction,
  type PulsePublishContext,
} from "./pulse-actions.js";

export interface ControllerPulseDeps {
  getPulse: () => CommunityPulseModel | undefined;
  setPulse: (next: CommunityPulseModel | undefined) => void;
  getGeneration: () => number;
  getActiveCommunityId: () => string;
  getSession: (scopeId: string) => CommunitySession | undefined;
  getControllerSignal: () => AbortSignal | undefined;
  getPulseCapability: () => boolean;
  canDirectMessage: () => boolean;
  getIdentityPubkey: () => string;
  getIdentity: () => CommunityIdentity | undefined;
  getRelayUrl: () => string;
  getAgents: () => CommunityAgentsState | undefined;
  pulseOptions?: CommunityPulseOptions;
  now: () => number;
  ensureIdentity: (operation: string) => Promise<void>;
  throwOperationFailure: (
    operation: string,
    category: CommunityOperationFailure["category"],
    message: string,
  ) => never;
  execute: (operation: string, command: CommunityCommand) => Promise<void>;
}

export function createControllerPulse(deps: ControllerPulseDeps) {
  let pulseAbort: AbortController | undefined;
  let pulseRun = 0;
  let pulseActive = false;
  let pulseNoteTimer: ReturnType<typeof setInterval> | undefined;
  let pulseReactionTimer: ReturnType<typeof setInterval> | undefined;
  let pulseEvents: NostrEvent[] = [];
  let pulsePrimaryEventIds: string[] = [];

  function pulseAgents() {
    return (
      deps.pulseOptions?.agents ??
      (deps.getAgents()?.capabilities.directory
        ? deps.getAgents()!.agents
        : undefined)
    );
  }

  function publishContext(): PulsePublishContext {
    return {
      getPulse: deps.getPulse,
      setPulse: deps.setPulse,
      getPulseEvents: () => pulseEvents,
      setPulseEvents: (events) => {
        pulseEvents = events;
      },
      getPulsePrimaryEventIds: () => pulsePrimaryEventIds,
      setPulsePrimaryEventIds: (ids) => {
        pulsePrimaryEventIds = ids;
      },
      getIdentityPubkey: deps.getIdentityPubkey,
      getIdentity: deps.getIdentity,
      getRelayUrl: deps.getRelayUrl,
      canDirectMessage: deps.canDirectMessage,
      pulseAgents,
      now: deps.now,
      ensureIdentity: deps.ensureIdentity,
      throwOperationFailure: deps.throwOperationFailure,
      execute: deps.execute,
      refreshPulse,
    };
  }

  function updatePulseAvailability(): void {
    const session = deps.getSession(deps.getActiveCommunityId());
    const pulse = deps.getPulse();
    if (
      deps.getPulseCapability() !== true ||
      session?.loadPulseWindow === undefined
    ) {
      deps.setPulse(undefined);
      return;
    }
    if (pulse !== undefined) {
      deps.setPulse({
        ...pulse,
        canDirectMessage: deps.canDirectMessage(),
        ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
      });
      return;
    }
    deps.setPulse({
      tab: "everyone",
      status: "idle",
      notes: [],
      agentActivities: [],
      members: [],
      ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
      canDirectMessage: deps.canDirectMessage(),
    });
  }

  async function refreshPulse(
    kind: "notes" | "reactions" = "notes",
  ): Promise<void> {
    const currentPulse = deps.getPulse();
    if (currentPulse === undefined) return;
    const selected = currentPulse.tab;
    if (selected === "search") return;
    const session = deps.getSession(deps.getActiveCommunityId());
    if (session?.loadPulseWindow === undefined) return;
    const requestedGeneration = deps.getGeneration();
    const run = ++pulseRun;
    pulseAbort?.abort(new DOMException("Pulse request replaced", "AbortError"));
    const requestAbort = new AbortController();
    pulseAbort = requestAbort;
    const parentSignal = deps.getControllerSignal();
    const signal =
      parentSignal === undefined
        ? requestAbort.signal
        : AbortSignal.any([parentSignal, requestAbort.signal]);
    const { error: _currentError, ...pulseWithoutError } = currentPulse;
    deps.setPulse({
      ...pulseWithoutError,
      status: currentPulse.notes.length === 0 ? "loading" : "refreshing",
    });
    try {
      const window = await session.loadPulseWindow(
        {
          tab: selected,
          ...(selected === "agents"
            ? {
                agentPubkeys: pulseAgents()?.map((agent) => agent.pubkey) ?? [],
              }
            : {}),
          ...(kind === "reactions" && currentPulse.notes.length > 0
            ? { noteIds: currentPulse.notes.map((note) => note.id) }
            : {}),
        },
        signal,
      );
      if (
        run !== pulseRun ||
        requestedGeneration !== deps.getGeneration() ||
        deps.getPulse()?.tab !== selected
      ) {
        return;
      }
      pulseEvents = [...window.events];
      pulsePrimaryEventIds = [...window.primaryEventIds];
      deps.setPulse(
        materializeCommunityPulse(pulseEvents, {
          tab: selected,
          primaryEventIds: pulsePrimaryEventIds,
          ...(deps.getIdentityPubkey() === ""
            ? {}
            : { identityPubkey: deps.getIdentityPubkey() }),
          ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
          asOf: deps.now(),
          canDirectMessage: deps.canDirectMessage(),
        }),
      );
    } catch (cause) {
      if (
        isAbort(cause) ||
        run !== pulseRun ||
        requestedGeneration !== deps.getGeneration()
      ) {
        return;
      }
      const message =
        cause instanceof Error ? cause.message : "Pulse could not be loaded";
      deps.setPulse({
        ...(deps.getPulse() ?? {
          tab: selected,
          notes: [],
          agentActivities: [],
          members: [],
          canDirectMessage: deps.canDirectMessage(),
        }),
        status: "error",
        error: message,
      });
      throw cause;
    } finally {
      if (pulseAbort === requestAbort) pulseAbort = undefined;
    }
  }

  function stopPulseRefreshTimers(reason: string): void {
    if (pulseNoteTimer !== undefined) clearInterval(pulseNoteTimer);
    if (pulseReactionTimer !== undefined) clearInterval(pulseReactionTimer);
    pulseNoteTimer = undefined;
    pulseReactionTimer = undefined;
    pulseAbort?.abort(new DOMException(reason, "AbortError"));
    pulseAbort = undefined;
    pulseRun += 1;
  }

  function startPulseRefreshTimers(): void {
    stopPulseRefreshTimers("Pulse timers restarted");
    if (!pulseActive || deps.getPulse() === undefined) return;
    pulseNoteTimer = setInterval(
      () => void refreshPulse("notes").catch(() => undefined),
      30_000,
    );
    pulseReactionTimer = setInterval(
      () => void refreshPulse("reactions").catch(() => undefined),
      60_000,
    );
  }

  async function selectPulseTab(tab: CommunityPulseTab): Promise<void> {
    if (tab === "agents" && pulseAgents() === undefined) return;
    if (tab === "following" || tab === "liked" || tab === "mine") {
      await deps.ensureIdentity(`pulse:tab:${tab}`);
    }
    updatePulseAvailability();
    const pulse = deps.getPulse();
    if (pulse === undefined) return;
    pulseAbort?.abort(new DOMException("Pulse tab changed", "AbortError"));
    pulseRun += 1;
    pulseEvents = [];
    pulsePrimaryEventIds = [];
    const { error: _previousError, ...pulseWithoutError } = pulse;
    deps.setPulse({
      ...pulseWithoutError,
      tab,
      status: tab === "search" ? "ready" : "idle",
      notes: [],
      agentActivities: [],
      members: [],
    });
    if (tab !== "search") await refreshPulse();
  }

  return {
    pulseAgents,
    updatePulseAvailability,
    refreshPulse,
    startPulseRefreshTimers,
    stopPulseRefreshTimers,
    rematerializePulse: (
      status?: CommunityPulseModel["status"],
      pulseError?: string,
    ) => rematerializePulse(publishContext(), status, pulseError),
    selectPulseTab,
    publishPulse: (
      submission: CommunityComposerSubmission,
      replyToEventId?: string,
    ) => publishPulseNote(publishContext(), submission, replyToEventId),
    togglePulseLike: (eventId: string) =>
      togglePulseLikeAction(publishContext(), eventId),
    setActive(active: boolean) {
      pulseActive = active;
      updatePulseAvailability();
      if (!active) {
        stopPulseRefreshTimers("Pulse closed");
        return;
      }
      startPulseRefreshTimers();
      if (deps.getPulse()?.status === "idle") {
        void refreshPulse().catch(() => undefined);
      }
    },
    deactivate(reason: string) {
      pulseActive = false;
      stopPulseRefreshTimers(reason);
    },
    get active() {
      return pulseActive;
    },
    resetTabOnSignOut() {
      const pulse = deps.getPulse();
      if (pulse !== undefined) deps.setPulse({ ...pulse, tab: "everyone" });
    },
  };
}
