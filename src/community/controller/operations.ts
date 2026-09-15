import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import type {
  CommunityCommand,
  CommunityControllerState,
  CommunityOperationFailure,
  CommunityOperationState,
  CommunitySession,
} from "../contracts.js";

export class CommunityActionFailure extends Error {
  readonly failure: CommunityOperationFailure;

  constructor(
    category: CommunityOperationFailure["category"],
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "CommunityActionFailure";
    this.failure = { category, message, retryable };
  }
}

export function normalizeCommunityOperationFailure(
  cause: unknown,
): CommunityOperationFailure {
  if (cause instanceof CommunityActionFailure) return cause.failure;
  const message =
    cause instanceof Error ? cause.message : "Community action failed";
  if (/recipients?.+not advertised.+(?:inbox )?relay/iu.test(message)) {
    return {
      category: "validation",
      message,
      relayReason: message,
      retryable: false,
    };
  }
  const relayMatch = message.match(
    /(?:^|\s)(invalid|restricted|blocked|rate-limited|pow|mute|error):\s*(.*)$/iu,
  );
  if (relayMatch !== null) {
    const prefix = relayMatch[1]!.toLocaleLowerCase();
    const category = prefix === "error" ? "relay" : prefix;
    return {
      category: category as CommunityOperationFailure["category"],
      message,
      relayReason: message,
      retryable: prefix === "rate-limited" || prefix === "error",
    };
  }
  if (/timed?\s*out|timeout/iu.test(message)) {
    return {
      category: "timeout",
      message,
      relayReason: message,
      retryable: true,
    };
  }
  if (
    /disconnect|network|socket|connection|reconnect|failed to fetch/iu.test(
      message,
    )
  ) {
    return {
      category: "network",
      message,
      relayReason: message,
      retryable: true,
    };
  }
  if (/identity|sign[ -]?in|authentication|nip-07|nip-42/iu.test(message)) {
    return { category: "authentication", message, retryable: false };
  }
  if (/member|join|permission|writer|administrator/iu.test(message)) {
    return {
      category: "membership",
      message,
      relayReason: message,
      retryable: false,
    };
  }
  return { category: "relay", message, relayReason: message, retryable: true };
}

export function commandNeedsReconciliation(command: CommunityCommand): boolean {
  return [
    "create-room",
    "update-room",
    "delete-room",
    "join",
    "leave",
    "add-member",
    "remove-member",
    "direct-message",
  ].includes(command.type);
}

export interface ControllerOperationsDeps {
  getGeneration: () => number;
  getStatus: () => CommunityControllerState["status"];
  getActiveCommunityId: () => string;
  getSession: (scopeId: string) => CommunitySession | undefined;
  getControllerSignal: () => AbortSignal | undefined;
  getScopeEvents: (scopeId: string) => readonly NostrEvent[];
  getOperations: () => Record<string, CommunityOperationState>;
  setOperations: (next: Record<string, CommunityOperationState>) => void;
  operationVersions: Map<string, symbol>;
  retries: Map<string, () => Promise<void>>;
  acceptedEventIdsByOperation: Map<string, readonly string[]>;
  ensureIdentity: (operation: string) => Promise<void>;
  cacheLiveEvents: (
    scopeId: string,
    events: readonly NostrEvent[],
    generation: number,
  ) => Promise<void>;
  refreshScope: (scopeId: string, signal?: AbortSignal) => Promise<void>;
}

export interface ControllerOperations {
  runOperation(operation: string, action: () => Promise<void>): Promise<void>;
  execute(
    operation: string,
    command: CommunityCommand,
    scopeId?: string,
  ): Promise<void>;
  publishTemplate(
    operation: string,
    template: NostrEventTemplate,
  ): Promise<void>;
  throwOperationFailure: (
    operation: string,
    category: CommunityOperationFailure["category"],
    message: string,
  ) => never;
  retry(operation: string): Promise<void>;
  dismissOperation(operation: string): void;
}

export function createControllerOperations(
  deps: ControllerOperationsDeps,
): ControllerOperations {
  async function runOperation(
    operation: string,
    action: () => Promise<void>,
  ): Promise<void> {
    const version = Symbol(operation);
    const requestedGeneration = deps.getGeneration();
    deps.operationVersions.set(operation, version);
    const isCurrent = () =>
      deps.getGeneration() === requestedGeneration &&
      deps.operationVersions.get(operation) === version;
    deps.retries.delete(operation);
    deps.acceptedEventIdsByOperation.delete(operation);
    deps.setOperations({
      ...deps.getOperations(),
      [operation]: { status: "pending" },
    });
    try {
      await action();
      if (!isCurrent()) return;
      deps.setOperations({
        ...deps.getOperations(),
        [operation]: { status: "idle" },
      });
      deps.retries.delete(operation);
    } catch (cause) {
      if (!isCurrent()) return;
      const failure = normalizeCommunityOperationFailure(cause);
      deps.setOperations({
        ...deps.getOperations(),
        [operation]: {
          status: "failed",
          message: failure.message,
          failure,
        },
      });
      if (failure.retryable) {
        deps.retries.set(operation, async () =>
          runOperation(operation, action),
        );
      }
      throw cause;
    }
  }

  async function execute(
    operation: string,
    command: CommunityCommand,
    scopeId = deps.getActiveCommunityId(),
  ): Promise<void> {
    let acceptedEvents: readonly NostrEvent[] = [];
    await runOperation(operation, async () => {
      if (deps.getStatus() !== "connected") {
        throw new CommunityActionFailure(
          "network",
          "Reconnect to perform this action",
          true,
        );
      }
      await deps.ensureIdentity(operation);
      const session = deps.getSession(scopeId);
      if (session === undefined) {
        throw new CommunityActionFailure(
          "network",
          "Community is not connected",
          true,
        );
      }
      acceptedEvents = await session.execute(
        command,
        deps.getControllerSignal(),
      );
      await deps.cacheLiveEvents(scopeId, acceptedEvents, deps.getGeneration());
      if (commandNeedsReconciliation(command)) {
        await deps.refreshScope(scopeId, deps.getControllerSignal());
      }
    });
    if (
      command.type !== "direct-message" &&
      acceptedEvents.length > 0 &&
      acceptedEvents.some(
        (event) =>
          !deps
            .getScopeEvents(scopeId)
            .some((candidate) => candidate.id === event.id),
      )
    ) {
      deps.acceptedEventIdsByOperation.set(
        operation,
        acceptedEvents.map((event) => event.id),
      );
      deps.setOperations({
        ...deps.getOperations(),
        [operation]: {
          status: "accepted",
          message: "Accepted by relay, still syncing.",
        },
      });
    }
  }

  async function publishTemplate(
    operation: string,
    template: NostrEventTemplate,
  ): Promise<void> {
    await execute(operation, { type: "publish", template });
  }

  function throwOperationFailure(
    operation: string,
    category: CommunityOperationFailure["category"],
    message: string,
  ): never {
    const failure: CommunityOperationFailure = {
      category,
      message,
      retryable: false,
    };
    deps.retries.delete(operation);
    deps.setOperations({
      ...deps.getOperations(),
      [operation]: { status: "failed", message, failure },
    });
    throw new CommunityActionFailure(category, message);
  }

  async function retry(operation: string): Promise<void> {
    if (deps.getOperations()[operation]?.failure?.retryable !== true) return;
    const action = deps.retries.get(operation);
    if (action !== undefined) await action();
  }

  function dismissOperation(operation: string): void {
    deps.retries.delete(operation);
    deps.acceptedEventIdsByOperation.delete(operation);
    if (deps.getOperations()[operation] === undefined) return;
    deps.setOperations({
      ...deps.getOperations(),
      [operation]: { status: "idle" },
    });
  }

  return {
    runOperation,
    execute,
    publishTemplate,
    throwOperationFailure,
    retry,
    dismissOperation,
  };
}
