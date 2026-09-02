import { describe, expect, it, vi } from "vitest";

import type {
  CommunityRuntimeRevision,
  CommunityRuntimeSelection,
  CommunityScope,
} from "./contracts.js";
import { createBrowserCommunityEventRuntime } from "./browser-event-runtime.js";

const scope: CommunityScope = {
  id: "lapis",
  name: "Lapis Community",
  relayUrl: "memory://worker.test",
  rooms: [],
};

const selection: CommunityRuntimeSelection = {
  generation: 3,
  scopes: [scope],
  activeCommunityId: scope.id,
  activeRoomId: "",
};

class FakeWorker {
  readonly requests: Record<string, unknown>[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  postMessage(request: Record<string, unknown>): void {
    this.requests.push(request);
    const method = request.method;
    if (method === "dispose") return;
    const revision: CommunityRuntimeRevision = {
      generation:
        method === "project"
          ? (request.selection as CommunityRuntimeSelection).generation
          : Number(request.generation ?? 3),
      revision: this.requests.length,
      cache: { mode: "memory", freshness: "cached" },
    };
    queueMicrotask(() =>
      this.onmessage?.(
        new MessageEvent("message", {
          data: { id: request.id, ok: true, value: revision },
        }),
      ),
    );
  }

  terminate(): void {
    this.terminated = true;
  }

  crash(message = "worker crashed"): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

describe("BrowserCommunityEventRuntime", () => {
  it("recreates and restores its worker once after a crash", async () => {
    const workers: FakeWorker[] = [];
    const runtime = createBrowserCommunityEventRuntime({
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });

    await runtime.restore([scope], 3);
    workers[0]!.crash();
    const revision = await runtime.project(selection);

    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.requests.map((request) => request.method)).toEqual([
      "restore",
      "project",
    ]);
    expect(revision.generation).toBe(3);
    runtime.dispose();
  });

  it("falls back to the inline runtime after a repeated worker failure", async () => {
    const workers: FakeWorker[] = [];
    const degraded = vi.fn();
    const runtime = createBrowserCommunityEventRuntime({
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      onDegraded: degraded,
    });

    await runtime.restore([scope], 3);
    workers[0]!.crash();
    await runtime.project(selection);
    workers[1]!.crash("worker crashed again");
    const revision = await runtime.project(selection);

    expect(degraded).toHaveBeenCalledWith(
      "Community worker failed repeatedly; using the inline runtime",
    );
    expect(revision.cache.mode).toBe("memory");
    runtime.dispose();
  });
});
