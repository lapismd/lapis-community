import { expect, it, vi } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import type {
  CommunityContentWindowRequest,
  CommunityScope,
  CommunityEventRuntime,
} from "./contracts.js";
import { readCachedContentWindow } from "./cached-content-window.js";
const scope: CommunityScope = {
  id: "c",
  name: "Community",
  relayUrl: "wss://relay.test/",
};
const request: CommunityContentWindowRequest = {
  collection: "channel-roots",
  groupId: "general",
  limit: 50,
};
const key = new Uint8Array(32).fill(14);
const message = (created_at: number, tags: string[][] = [["h", "general"]]) =>
  finalizeEvent({ kind: 9, created_at, content: "cached", tags }, key);
function reader(events: ReturnType<typeof message>[]) {
  const readCachedEvents = vi
    .fn<NonNullable<CommunityEventRuntime["readCachedEvents"]>>()
    .mockImplementation(async (_scope, query) => {
      const matching = events
        .filter(
          (event) =>
            !query.before ||
            event.created_at < query.before.createdAt ||
            (event.created_at === query.before.createdAt &&
              event.id < query.before.eventId),
        )
        .sort(
          (a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id),
        );
      const selected = matching.slice(-query.limit),
        first = selected[0];
      return {
        events: selected,
        hasMoreCached: matching.length > selected.length,
        ...(first
          ? { olderCursor: { createdAt: first.created_at, eventId: first.id } }
          : {}),
      };
    });
  return { readCachedEvents };
}
it("restores an explicit saved page without a candidate scan", async () => {
  const event = message(10),
    page = {
      key: "head",
      audience: { type: "public" as const },
      relayUrls: [scope.relayUrl],
      request,
      eventIds: [event.id],
      primaryEventIds: [event.id],
      hasOlder: false,
      synchronizedAt: 20,
    };
  const runtime = {
    ...reader([]),
    readHistoryPage: vi.fn().mockResolvedValue({ page, events: [event] }),
  };
  const result = await readCachedContentWindow(runtime, scope, request, "head");
  expect(result?.covered).toBe(true);
  expect(result?.window.hasOlder).toBe(false);
  expect(runtime.readCachedEvents).not.toHaveBeenCalled();
});
it("selects fifty deterministic cached messages and never infers complete relay history", async () => {
  const events = Array.from({ length: 75 }, (_, index) => message(index + 1));
  const runtime = reader(events.reverse());
  const result = await readCachedContentWindow(runtime, scope, request, "head");
  expect(result?.window.primaryEventIds).toEqual(
    events
      .slice()
      .sort((a, b) => a.created_at - b.created_at)
      .slice(-50)
      .map((event) => event.id),
  );
  expect(result?.window.hasOlder).toBe(true);
  expect(result?.covered).toBe(false);
  expect(runtime.readCachedEvents).toHaveBeenCalledTimes(1);
});
it("retains sparse cache continuation after at most three hundred candidates", async () => {
  const events = Array.from({ length: 350 }, (_, index) =>
    message(index + 1, [
      ["h", "general"],
      ["e", "unrelated-root"],
    ]),
  );
  const runtime = reader(events);
  const result = await readCachedContentWindow(runtime, scope, request, "head");
  expect(runtime.readCachedEvents).toHaveBeenCalledTimes(3);
  expect(
    runtime.readCachedEvents.mock.calls.every(
      ([, query]) => query.limit === 100,
    ),
  ).toBe(true);
  expect(result?.window.primaryEventIds).toEqual([]);
  expect(result?.window.olderCursor?.createdAt).toBe(51);
  expect(result?.hasMoreCached).toBe(true);
  expect(result?.covered).toBe(false);
});
it("does not equate a short cached page with an exact zero beyond it", async () => {
  const runtime = reader([message(1), message(2)]);
  const result = await readCachedContentWindow(runtime, scope, request, "head");
  expect(result?.hasMoreCached).toBe(false);
  expect(result?.window.hasOlder).toBe(true);
  expect(result?.covered).toBe(false);
});
it("uses the event ID boundary when timestamps are equal", async () => {
  const events = Array.from({ length: 110 }, (_, index) =>
    message(100, [
      ["h", "general"],
      ["p", String(index)],
    ]),
  );
  const runtime = reader(events);
  const first = await readCachedContentWindow(runtime, scope, request, "head");
  const next = await readCachedContentWindow(
    runtime,
    scope,
    { ...request, before: first!.window.olderCursor! },
    "older",
  );
  expect(
    new Set([...first!.window.primaryEventIds, ...next!.window.primaryEventIds])
      .size,
  ).toBe(100);
});
it("ignores another thread when reading cached candidates", async () => {
  const root = "thread",
    events = [
      message(1, [
        ["h", "general"],
        ["e", root],
      ]),
      message(2, [
        ["h", "general"],
        ["e", "other"],
      ]),
    ];
  const result = await readCachedContentWindow(
    reader(events),
    scope,
    { ...request, collection: "thread", rootEventId: root },
    "thread",
  );
  expect(result?.window.primaryEventIds).toEqual([events[0]!.id]);
  expect(result?.window.events.map((event) => event.id)).toEqual([
    events[0]!.id,
  ]);
});
it("rejects an obsolete cache completion before callers can hydrate it", async () => {
  const abort = new AbortController();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const runtime = {
    readCachedEvents: vi.fn(async () => {
      await pending;
      return { events: [message(1)], hasMoreCached: false };
    }),
  };
  const result = readCachedContentWindow(
    runtime,
    scope,
    request,
    "head",
    abort.signal,
  );
  await vi.waitFor(() =>
    expect(runtime.readCachedEvents).toHaveBeenCalledTimes(1),
  );
  abort.abort();
  release();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
});
it("preserves runtimes without paged cache methods and resolves empty scans once", async () => {
  expect(
    await readCachedContentWindow({}, scope, request, "head"),
  ).toBeUndefined();
  const runtime = reader([]);
  expect(
    await readCachedContentWindow(runtime, scope, request, "head"),
  ).toBeUndefined();
  expect(runtime.readCachedEvents).toHaveBeenCalledTimes(1);
});
