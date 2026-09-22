import { afterEach, describe, expect, it, vi } from "vitest";

const connect = vi.hoisted(() => vi.fn());

vi.mock("@tursodatabase/database-wasm/bundle", () => ({ connect }));

import {
  openTursoCommunityDatabase,
  TURSO_OPEN_TIMEOUT_MESSAGE,
} from "./turso-database-open.js";
import { createTursoCommunityEventStore } from "./turso-event-store.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function lifecycleDatabase() {
  return {
    exec: vi.fn().mockResolvedValue(undefined),
    all: vi.fn().mockResolvedValue([]),
    batch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function installHeldLock(): { isHeld: () => boolean } {
  let held = false;
  vi.stubGlobal("navigator", {
    storage: { getDirectory: vi.fn() },
    locks: {
      request: vi.fn(
        (
          _name: string,
          options: LockOptions,
          callback: (lock: Lock | null) => Promise<void>,
        ) => {
          if (options.ifAvailable && held) {
            void callback(null);
            return;
          }
          held = true;
          void Promise.resolve(
            callback({ name: _name, mode: "exclusive" } as Lock),
          ).finally(() => {
            held = false;
          });
        },
      ),
    },
  });
  return { isHeld: () => held };
}

describe("openTursoCommunityDatabase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    connect.mockReset();
  });

  it("fails closed when the driver never becomes ready and releases the owner lock", async () => {
    const lock = installHeldLock();
    connect.mockReturnValue(new Promise(() => {}));

    await expect(
      openTursoCommunityDatabase({
        databaseName: "hung-open.db",
        openTimeoutMs: 20,
      }),
    ).rejects.toThrow(TURSO_OPEN_TIMEOUT_MESSAGE);
    expect(lock.isHeld()).toBe(false);
  });

  it("times out Turso store open when the driver never becomes ready", async () => {
    installHeldLock();
    vi.stubGlobal("SharedArrayBuffer", class SharedArrayBuffer {});
    vi.stubGlobal("Atomics", {});
    vi.stubGlobal("crossOriginIsolated", true);
    connect.mockReturnValue(new Promise(() => {}));
    const store = createTursoCommunityEventStore({
      databaseName: "hung-store.db",
      openTimeoutMs: 20,
    });

    await expect(store.open()).rejects.toThrow(TURSO_OPEN_TIMEOUT_MESSAGE);
  });

  it("closes a late driver handle after the open wait expires", async () => {
    installHeldLock();
    const opening = deferred<ReturnType<typeof lifecycleDatabase>>();
    connect.mockReturnValue(opening.promise);

    await expect(
      openTursoCommunityDatabase({
        databaseName: "late-connect.db",
        openTimeoutMs: 20,
      }),
    ).rejects.toThrow(TURSO_OPEN_TIMEOUT_MESSAGE);

    const database = lifecycleDatabase();
    opening.resolve(database);
    await vi.waitFor(() => expect(database.close).toHaveBeenCalledTimes(1));
  });
});
