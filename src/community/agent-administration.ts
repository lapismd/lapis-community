import type {
  CommunityAgentRuntimeState,
  CommunityAgentMemoryState,
  CommunityAgentProcessingState,
  CommunityAgentsState,
  CommunityAgentControl,
  CommunityAgentObserver,
} from "./agent-contracts.js";
import type {
  AgentAdministrationControl,
  AgentAdministrationRequest,
} from "./agent-administration-contracts.js";
import {
  lateRuntimeState,
  parseProcessingState,
} from "./agent-administration-state.js";
import { observerRecord, observerText } from "./agent-observer.js";
import { parseRuntimeState, parseMemoryState } from "./agent-state-parsers.js";
export class AgentAdministration {
  readonly requests = new Map<string, AgentAdministrationRequest>();
  constructor(
    readonly options: {
      state(): CommunityAgentsState;
      update(patch: Partial<CommunityAgentsState>): void;
      hasSnapshot(agent: string): boolean;
      send(agent: string, control: CommunityAgentControl): Promise<void>;
    },
  ) {}
  dispose(): void {
    for (const request of this.requests.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Agent administration was cancelled"));
    }
    this.requests.clear();
  }
  async request<
    T extends
      | CommunityAgentRuntimeState
      | CommunityAgentMemoryState
      | CommunityAgentProcessingState,
  >(
    agentPubkey: string,
    control: AgentAdministrationControl,
    responseKind: AgentAdministrationRequest["responseKind"],
  ): Promise<T> {
    const requestId = crypto.randomUUID();
    const result = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => {
          this.requests.delete(requestId);
          reject(
            new Error(
              responseKind !== "memory_state"
                ? "The agent controller did not acknowledge this request within thirty seconds"
                : "The agent controller did not respond within ten seconds",
            ),
          );
        },
        responseKind === "memory_state" ? 10_000 : 30_000,
      );
      this.requests.set(requestId, {
        agentPubkey,
        responseKind,
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
    });
    try {
      await this.options.send(agentPubkey, {
        ...control,
        requestId,
      } as CommunityAgentControl);
    } catch (cause) {
      const request = this.requests.get(requestId);
      if (request) {
        clearTimeout(request.timer);
        this.requests.delete(requestId);
        request.reject(
          cause instanceof Error ? cause : new Error(String(cause)),
        );
      }
    }
    return result;
  }

  apply(agentPubkey: string, frame: CommunityAgentObserver): boolean {
    if (
      frame.kind !== "processing_state" &&
      frame.kind !== "runtime_state" &&
      frame.kind !== "memory_state" &&
      frame.kind !== "administration_error"
    )
      return false;
    const payload = observerRecord(frame.payload);
    const requestId = observerText(payload?.requestId, 128);
    const responseKind =
      frame.kind === "administration_error"
        ? observerText(payload?.responseKind, 32)
        : frame.kind;
    const request = requestId ? this.requests.get(requestId) : undefined;
    if (
      !request ||
      request.agentPubkey !== agentPubkey ||
      request.responseKind !== responseKind
    ) {
      const runtime = lateRuntimeState(
        this.options.state().runtime,
        agentPubkey,
        frame.kind,
        payload,
      );
      if (runtime && !this.options.hasSnapshot(agentPubkey))
        this.options.update({ runtime });
      return true;
    }
    clearTimeout(request.timer);
    this.requests.delete(requestId);
    if (frame.kind === "administration_error") {
      request.reject(
        new Error(
          observerText(payload?.message, 512) ??
            "The agent controller could not complete this request",
        ),
      );
      return true;
    }
    const value =
      frame.kind === "runtime_state"
        ? parseRuntimeState(payload)
        : frame.kind === "processing_state"
          ? parseProcessingState(payload)
          : parseMemoryState(payload);
    if (!value) {
      request.reject(
        new Error("The agent controller returned invalid administration data"),
      );
      return true;
    }
    if (frame.kind === "processing_state") {
      const processing = value as CommunityAgentProcessingState;
      const previous = this.options.state().processing?.[agentPubkey];
      if (previous && processing.revision < previous.revision) {
        request.reject(new Error("The processing acknowledgement is stale"));
        return true;
      }
      this.options.update({
        processing: {
          ...this.options.state().processing,
          [agentPubkey]: processing,
        },
      });
      if (processing.applied === false || processing.status === "error") {
        request.reject(
          new Error(
            processing.error ??
              "The controller did not apply the processing change",
          ),
        );
        return true;
      }
    } else if (
      frame.kind === "runtime_state" &&
      !this.options.hasSnapshot(agentPubkey)
    ) {
      this.options.update({
        runtime: {
          ...(this.options.state().runtime ?? {}),
          [agentPubkey]: value as CommunityAgentRuntimeState,
        },
      });
    } else if (frame.kind === "memory_state") {
      this.options.update({
        memories: {
          ...(this.options.state().memories ?? {}),
          [agentPubkey]: value as CommunityAgentMemoryState,
        },
      });
    }
    request.resolve(value);
    return true;
  }
}
