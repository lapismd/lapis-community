import { describe, expect, it, vi } from "vitest";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { createInMemoryRelayFactory } from "../testing/index.js";
import { createNip34ProjectForgeDataSource } from "./data-source.js";
import {
  createRepositoryTemplate,
  createTaskTemplate,
  createDeletionTemplate,
} from "./builders.js";
import type { NostrEvent } from "../protocol/index.js";
import type {
  ProjectForgeSession,
  ProjectForgeSourceEvent,
} from "./data-source.js";
import type { ProjectForgeWorkItems } from "./model.js";
import { reduceProjectTask } from "./reducer.js";
import { createProjectWorkItemResources } from "./work-item-resources.js";

const repository = (id: string): NostrEvent => ({
  id,
  kind: 30617,
  pubkey: "a".repeat(64),
  sig: "",
  created_at: 1,
  content: "",
  tags: [["d", id]],
});
const empty: ProjectForgeWorkItems = {
  tasks: [],
  pullRequests: [],
  events: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup() {
  const listeners: Array<(event: ProjectForgeSourceEvent) => void> = [];
  const stops: Array<ReturnType<typeof vi.fn>> = [];
  const loadWorkItems = vi.fn(
    async (_repository: NostrEvent, _signal?: AbortSignal) => empty,
  );
  const subscribe = vi.fn<ProjectForgeSession["subscribe"]>(
    async (_filters, listener) => {
      listeners.push(listener);
      const stop = vi.fn();
      stops.push(stop);
      return stop;
    },
  );
  const resources = createProjectWorkItemResources({
    loadWorkItems,
    subscribe,
  } as unknown as ProjectForgeSession);
  return { resources, loadWorkItems, subscribe, listeners, stops };
}

describe("session-owned project work items", () => {
  it("resolves empty results and reuses observations on A-B-A navigation", async () => {
    const t = setup(),
      a = repository("a"),
      b = repository("b");
    await t.resources.load(a);
    await t.resources.load(b);
    expect(await t.resources.load(a)).toBe(empty);
    expect(t.loadWorkItems).toHaveBeenCalledTimes(2);
    expect(t.subscribe).toHaveBeenCalledTimes(2);
    expect(
      t.subscribe.mock.calls
        .flatMap(([filters]) => filters)
        .every((filter) => filter.limit === 0),
    ).toBe(true);
    expect(t.loadWorkItems.mock.invocationCallOrder[0]).toBeGreaterThan(
      t.subscribe.mock.invocationCallOrder[0]!,
    );
    t.resources.dispose();
    expect(t.stops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });

  it("deduplicates overlapping views without letting a view cancel shared work", async () => {
    const t = setup(),
      result = deferred<ProjectForgeWorkItems>(),
      a = repository("a");
    t.loadWorkItems.mockReturnValue(result.promise);
    const cancelled = new AbortController();
    const first = t.resources.load(a, cancelled.signal);
    const rejected = expect(first).rejects.toMatchObject({
      name: "AbortError",
    });
    const second = t.resources.load(a);
    cancelled.abort();
    await rejected;
    await vi.waitFor(() => expect(t.loadWorkItems).toHaveBeenCalledOnce());
    expect(t.loadWorkItems.mock.calls[0]![1]!.aborted).toBe(false);
    result.resolve(empty);
    expect(await second).toBe(empty);
    expect(await t.resources.load(a)).toBe(empty);
    expect(t.subscribe).toHaveBeenCalledOnce();
    t.resources.dispose();
  });

  it("coalesces incoming updates for their repository and ignores duplicate events", async () => {
    const t = setup(),
      a = repository("a"),
      b = repository("b");
    await t.resources.load(a);
    await t.resources.load(b);
    const incoming = { ...repository("event"), kind: 7 };
    t.listeners[0]!({ type: "event", event: incoming });
    t.listeners[0]!({ type: "event", event: incoming });
    await vi.waitFor(() => expect(t.loadWorkItems).toHaveBeenCalledTimes(3));
    expect(t.loadWorkItems.mock.calls[2]![0]).toBe(a);
    expect(t.subscribe).toHaveBeenCalledTimes(2);
    t.resources.dispose();
  });

  it("confirms history after attaching event-ID comment and deletion observations", async () => {
    const t = setup(),
      a = repository("a");
    const root = {
      ...repository("root"),
      kind: 1621,
      tags: [
        ["a", `30617:${a.pubkey}:a`],
        ["subject", "Task"],
      ],
    };
    const bundle: ProjectForgeWorkItems = {
      ...empty,
      events: [root],
      tasks: [reduceProjectTask(root, a, [])],
    };
    t.loadWorkItems.mockResolvedValue(bundle);
    await t.resources.load(a);
    expect(t.loadWorkItems).toHaveBeenCalledTimes(2);
    expect(t.subscribe.mock.calls[1]![0]).toEqual([
      { kinds: [1111], "#E": [root.id], limit: 0 },
      { kinds: [5], "#e": [root.id], limit: 0 },
    ]);
    await t.resources.load(a);
    expect(t.loadWorkItems).toHaveBeenCalledTimes(2);
    t.resources.dispose();
    expect(t.stops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });

  it("invalidates closed or failed registrations and reconciles on retry", async () => {
    const t = setup(),
      a = repository("a");
    await t.resources.load(a);
    const listener = vi.fn();
    t.resources.subscribe([a.id], listener);
    t.listeners[0]!({ type: "close", reason: "connection lost" });
    expect(listener).toHaveBeenCalledWith(expect.any(Error));
    await t.resources.load(a);
    expect(t.subscribe).toHaveBeenCalledTimes(2);
    expect(t.loadWorkItems).toHaveBeenCalledTimes(2);
    t.resources.dispose();
    const retry = setup();
    retry.subscribe.mockRejectedValueOnce(new Error("denied"));
    await expect(retry.resources.load(a)).rejects.toThrow("denied");
    await retry.resources.load(a);
    expect(retry.subscribe).toHaveBeenCalledTimes(2);
    retry.resources.dispose();
  });

  it("evicts changed or removed repositories and suppresses stale completions", async () => {
    const t = setup(),
      a = repository("a"),
      result = deferred<ProjectForgeWorkItems>();
    t.loadWorkItems.mockReturnValueOnce(result.promise);
    const pending = t.resources.load(a);
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.waitFor(() => expect(t.loadWorkItems).toHaveBeenCalledOnce());
    const change = vi.fn();
    t.resources.subscribe([a.id], change);
    t.resources.retain([]);
    result.resolve(empty);
    await rejected;
    expect(t.resources.peek(a)).toBeUndefined();
    expect(change).not.toHaveBeenCalled();
    await t.resources.load(a);
    expect(t.subscribe).toHaveBeenCalledTimes(2);
    t.resources.dispose();
  });

  it("keeps real relay updates and event-ID deletions live between cached visits", async () => {
    const secret = generateSecretKey(),
      owner = getPublicKey(secret);
    const repo = finalizeEvent(
      createRepositoryTemplate(
        { identifier: "repo", name: "Repository", channelId: "channel" },
        1,
      ),
      secret,
    );
    const coordinate = `30617:${owner}:repo`;
    const root = finalizeEvent(
      createTaskTemplate(
        {
          repository: coordinate,
          repositoryOwner: owner,
          title: "Live task",
          content: "Task",
        },
        2,
      ),
      secret,
    );
    const factory = createInMemoryRelayFactory({ events: [repo] });
    const session = await createNip34ProjectForgeDataSource({
      relayFactory: factory,
    }).open({ relayUrl: "wss://project.example" });
    const load = vi.spyOn(session, "loadWorkItems"),
      subscribe = vi.spyOn(session, "subscribe");
    const resources = createProjectWorkItemResources(session);
    try {
      await resources.load(repo);
      factory.relay("wss://project.example").inject(root);
      await vi.waitFor(() =>
        expect(resources.peek(repo)?.tasks[0]?.title).toBe("Live task"),
      );
      const reads = load.mock.calls.length,
        registrations = subscribe.mock.calls.length;
      await resources.load(repo);
      expect(load).toHaveBeenCalledTimes(reads);
      expect(subscribe).toHaveBeenCalledTimes(registrations);
      factory
        .relay("wss://project.example")
        .inject(finalizeEvent(createDeletionTemplate(root, 3), secret));
      await vi.waitFor(() => expect(resources.peek(repo)?.tasks).toEqual([]));
    } finally {
      resources.dispose();
      session.close();
    }
  });

  it("drops private session data and ignores delayed callbacks after disposal", async () => {
    const t = setup(),
      a = repository("a");
    await t.resources.load(a);
    const change = vi.fn();
    t.resources.subscribe([a.id], change);
    t.resources.dispose();
    t.listeners[0]!({ type: "event", event: repository("late") });
    expect(change).not.toHaveBeenCalled();
    expect(t.resources.peek(a)).toBeUndefined();
    await expect(t.resources.load(a)).rejects.toThrow("closed");
    const next = setup();
    await next.resources.load(a);
    expect(next.loadWorkItems).toHaveBeenCalledOnce();
    next.resources.dispose();
  });
});
