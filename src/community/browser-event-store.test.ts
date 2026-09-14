import { afterEach, describe, expect, it, vi } from "vitest";

const connect = vi.hoisted(() => vi.fn());

vi.mock("@tursodatabase/database-wasm/bundle", () => ({ connect }));

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

describe("browser cache lifecycle ordering", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    connect.mockReset();
  });
  it("repeated opens on the same wrapper acquire only one reference and release it on close", async () => {
    enableTursoBrowserCapabilities();
    const database = lifecycleDatabase(),
      opening = deferred<typeof database>();
    connect.mockReturnValue(opening.promise);
    const store = createBrowserCommunityEventStore({
      databaseName: crypto.randomUUID(),
    });
    const first = store.open(),
      second = store.open();
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    opening.resolve(database);
    await Promise.all([first, second]);
    await store.close();
    expect(database.close).toHaveBeenCalledTimes(1);
  });
  it("close waits for pending initialization and does not leave an opened candidate behind", async () => {
    enableTursoBrowserCapabilities();
    const database = lifecycleDatabase(),
      opening = deferred<typeof database>();
    connect.mockReturnValue(opening.promise);
    const store = createBrowserCommunityEventStore({
      databaseName: crypto.randomUUID(),
    });
    const opened = store.open();
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    let closed = false;
    const closing = store.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(false);
    opening.resolve(database);
    await Promise.all([opened, closing]);
    expect(database.close).toHaveBeenCalledTimes(1);
    expect(store.mode).toBe("memory");
  });
  it("a new wrapper waits until the previous database owner has finished closing", async () => {
    enableTursoBrowserCapabilities();
    const firstDb = lifecycleDatabase(),
      secondDb = lifecycleDatabase(),
      closing = deferred<void>();
    firstDb.close.mockReturnValue(closing.promise);
    connect.mockResolvedValueOnce(firstDb).mockResolvedValueOnce(secondDb);
    const databaseName = crypto.randomUUID(),
      first = createBrowserCommunityEventStore({ databaseName }),
      second = createBrowserCommunityEventStore({ databaseName });
    await first.open();
    const closed = first.close();
    await vi.waitFor(() => expect(firstDb.close).toHaveBeenCalledTimes(1));
    let opened = false;
    const opening = second.open().then(() => {
      opened = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(opened).toBe(false);
    expect(connect).toHaveBeenCalledTimes(1);
    closing.resolve();
    await Promise.all([closed, opening]);
    expect(connect).toHaveBeenCalledTimes(2);
    await second.close();
  });
  it("clears an earlier degraded reason when reopening with a working persistent store", async () => {
    enableTursoBrowserCapabilities();
    vi.stubGlobal("indexedDB", undefined);
    const database = lifecycleDatabase();
    connect
      .mockRejectedValueOnce(new Error("Unavailable driver"))
      .mockResolvedValueOnce(database);
    const onDegraded = vi.fn(),
      store = createBrowserCommunityEventStore({
        databaseName: crypto.randomUUID(),
        onDegraded,
      });
    await store.open();
    expect(store.mode).toBe("memory");
    expect(store.degradedReason).toContain("Unavailable driver");
    await store.close();
    await store.open();
    expect(store.mode).toBe("turso-opfs");
    expect(store.degradedReason).toBeUndefined();
    expect(onDegraded).toHaveBeenCalledTimes(1);
    await store.close();
  });
});

it("retains a failed shutdown for retry before opening another owner", async () => {
  enableTursoBrowserCapabilities();
  const database = lifecycleDatabase();
  database.close.mockRejectedValueOnce(new Error("Close failed"));
  connect.mockResolvedValue(database);
  const databaseName = crypto.randomUUID();
  const first = createBrowserCommunityEventStore({ databaseName });
  const next = createBrowserCommunityEventStore({ databaseName });
  await first.open();
  await expect(first.close()).rejects.toThrow("Close failed");
  await expect(first.open()).rejects.toThrow("retry close");
  await next.open();
  expect(next.mode).toBe("memory");
  expect(next.degradedReason).toContain("Close failed");
  expect(connect).toHaveBeenCalledTimes(1);
  await next.close();
  await first.close();
  await next.open();
  expect(next.mode).toBe("turso-opfs");
  await next.close();
  vi.unstubAllGlobals();
  connect.mockReset();
});

it("reopening the same wrapper waits for its previous close", async () => {
  enableTursoBrowserCapabilities();
  const database = lifecycleDatabase(),
    closing = deferred<void>();
  database.close.mockReturnValueOnce(closing.promise);
  connect.mockResolvedValue(database);
  const store = createBrowserCommunityEventStore({
    databaseName: crypto.randomUUID(),
  });
  await store.open();
  const closed = store.close();
  await vi.waitFor(() => expect(database.close).toHaveBeenCalledTimes(1));
  let ready = false;
  const opened = store.open().then(() => {
    ready = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ready).toBe(false);
  expect(connect).toHaveBeenCalledTimes(1);
  closing.resolve();
  await Promise.all([closed, opened]);
  expect(connect).toHaveBeenCalledTimes(2);
  await store.close();
  vi.unstubAllGlobals();
  connect.mockReset();
});
