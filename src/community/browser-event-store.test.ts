import { afterEach, describe, expect, it, vi } from "vitest";

const connect = vi.hoisted(() => vi.fn());

vi.mock("@tursodatabase/database-wasm/vite", () => ({ connect }));

import { createBrowserCommunityEventStore } from "./browser-event-store.js";

function enableTursoBrowserCapabilities(): void {
  vi.stubGlobal("navigator", {
    storage: { getDirectory: vi.fn() },
    locks: {
      request: vi.fn(
        (
          _name: string,
          _options: LockOptions,
          callback: (lock: Lock) => Promise<void>,
        ) => callback({ name: "community-test-lock", mode: "exclusive" }),
      ),
    },
  });
  vi.stubGlobal("SharedArrayBuffer", class SharedArrayBuffer {});
  vi.stubGlobal("Atomics", {});
  vi.stubGlobal("crossOriginIsolated", true);
}

describe("BrowserCommunityEventStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    connect.mockReset();
  });

  it("shares one Turso owner across concurrent Community runtimes", async () => {
    enableTursoBrowserCapabilities();
    const database = {
      exec: vi.fn().mockResolvedValue(undefined),
      all: vi.fn().mockResolvedValue([]),
      batch: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    connect.mockResolvedValue(database);
    const first = createBrowserCommunityEventStore();
    const second = createBrowserCommunityEventStore();

    await Promise.all([first.open(), second.open()]);

    expect(first.mode).toBe("turso-opfs");
    expect(second.mode).toBe("turso-opfs");
    expect(connect).toHaveBeenCalledTimes(1);

    await first.close();
    expect(database.close).not.toHaveBeenCalled();
    await second.close();
    expect(database.close).toHaveBeenCalledTimes(1);
  });
});
