import type {
  CommunityEventBatch,
  CommunityRuntimeSearch,
  CommunityRuntimeSelection,
  CommunityScope,
} from "./contracts.js";
import { createBrowserCommunityEventStore } from "./browser-event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import type { CommunityAgentArchiveRequest } from "./agent-contracts.js";
import { dispatchAgentArchive } from "./agent-archive.js";

type WorkerRequest =
  | { id: number; method: "archive"; request: CommunityAgentArchiveRequest }
  | {
      id: number;
      method: "restore";
      scopes: readonly CommunityScope[];
      generation?: number;
    }
  | { id: number; method: "ingest"; batch: CommunityEventBatch }
  | { id: number; method: "project"; selection: CommunityRuntimeSelection }
  | { id: number; method: "search"; query: CommunityRuntimeSearch }
  | { id: number; method: "clear"; scope?: CommunityScope }
  | { id: number; method: "dispose" };

interface WorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ): void;
  postMessage(value: unknown): void;
  close(): void;
}

const workerScope = globalThis as unknown as WorkerScope;
const runtime = createInlineCommunityEventRuntime({
  store: createBrowserCommunityEventStore(),
});

workerScope.addEventListener("message", (message) => {
  void respond(message.data);
});

async function respond(request: WorkerRequest): Promise<void> {
  try {
    let value: unknown;
    switch (request.method) {
      case "archive":
        value = await dispatchAgentArchive(
          runtime.agentActivity,
          request.request,
        );
        break;
      case "restore":
        value = await runtime.restore(request.scopes, request.generation);
        break;
      case "ingest":
        value = await runtime.ingest(request.batch);
        break;
      case "project":
        value = await runtime.project(request.selection);
        break;
      case "search":
        value = await runtime.search(request.query);
        break;
      case "clear":
        value = await runtime.clear(request.scope);
        break;
      case "dispose":
        runtime.dispose();
        workerScope.postMessage({ id: request.id, ok: true });
        workerScope.close();
        return;
    }
    workerScope.postMessage({ id: request.id, ok: true, value });
  } catch (cause) {
    workerScope.postMessage({
      id: request.id,
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
