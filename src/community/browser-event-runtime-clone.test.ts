import { describe, expect, it } from "vitest";

import type {
  CommunityEventBatch,
  CommunityRuntimeRevision,
} from "./contracts.js";
import { createBrowserCommunityEventRuntime } from "./browser-event-runtime.js";

class CloneCheckingWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(request: Record<string, unknown>): void {
    structuredClone(request);
    if (request.method === "dispose") return;
    const revision: CommunityRuntimeRevision = {
      generation: Number(
        (request.batch as CommunityEventBatch | undefined)?.generation ??
          request.generation ??
          0,
      ),
      revision: 1,
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

  terminate(): void {}
}

describe("BrowserCommunityEventRuntime worker delivery", () => {
  it("copies reactive event proxies into cloneable worker data", async () => {
    const event = new Proxy(
      {
        id: "event-id",
        pubkey: "author",
        created_at: 1,
        kind: 9,
        tags: [["h", "general"]],
        content: "Safari worker payload",
        sig: "signature",
      },
      {},
    );
    const batch: CommunityEventBatch = {
      generation: 2,
      scope: {
        id: "lapis",
        name: "Lapis Community",
        relayUrl: "memory://worker.test",
        rooms: [],
      },
      relayUrl: "memory://worker.test",
      events: [event],
    };
    const runtime = createBrowserCommunityEventRuntime({
      workerFactory: () => new CloneCheckingWorker(),
    });

    await expect(runtime.ingest(batch)).resolves.toMatchObject({
      generation: 2,
      revision: 1,
    });
    runtime.dispose();
  });
});
