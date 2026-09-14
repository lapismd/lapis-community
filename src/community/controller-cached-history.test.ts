import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, expect, it, vi } from "vitest";
import { createCommunityController } from "./community-controller.svelte.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { historyPageKey } from "./history-pages.js";
import type {
  CommunityCapabilities,
  CommunityController,
  CommunityScope,
  CommunitySession,
  CommunityDataSource,
  CommunityContentWindow,
} from "./contracts.js";
const scope: CommunityScope = {
  id: "cache",
  name: "Cache",
  relayUrl: "wss://test.invalid",
  rooms: [
    { id: "a", groupId: "a", name: "A", kind: "channel" },
    { id: "b", groupId: "b", name: "B", kind: "channel" },
  ],
};
const key = new Uint8Array(32).fill(71);
const message = (created_at: number, room = "a", root?: string) =>
  finalizeEvent(
    {
      kind: 9,
      created_at,
      content: `Message ${created_at}`,
      tags: [["h", room], ...(root ? [["e", root]] : [])],
    },
    key,
  );
const capabilities: CommunityCapabilities = {
  channels: true,
  forums: true,
  directMessages: false,
  search: true,
  manageGroup: false,
  manageMembers: false,
  deleteEvents: false,
  archive: false,
  editMessages: false,
};
const controllers: CommunityController[] = [];
afterEach(() =>
  controllers.splice(0).forEach((controller) => controller.dispose()),
);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function setup(
  events: ReturnType<typeof message>[],
  options: {
    offline?: boolean;
    forum?: boolean;
    legacy?: boolean;
    load?: CommunitySession["loadContentWindow"];
  } = {},
) {
  const store = createMemoryCommunityEventStore();
  await store.open();
  await store.commit({
    scope,
    records: events.map((event) => ({
      event,
      relayUrl: scope.relayUrl,
      audience: { type: "public" },
    })),
  });
  const source: CommunityDataSource = {
    ...(!options.legacy ? { historyPaging: true } : {}),
    async open() {
      if (options.offline) throw new Error("Offline fixture");
      return {
        snapshot: async () => ({ events: [], capabilities }),
        subscribe: async () => ({ close() {} }),
        execute: async () => [],
        search: async () => [],
        close() {},
        ...(options.load ? { loadContentWindow: options.load } : {}),
      };
    },
  };
  const runtime = createInlineCommunityEventRuntime({ store });
  const controller = createCommunityController({
    runtime,
    source,
    scopes: [
      options.forum
        ? {
            ...scope,
            rooms: scope.rooms!.map((room) =>
              room.id === "a" ? { ...room, kind: "forum" } : room,
            ),
          }
        : scope,
    ],
  });
  controllers.push(controller);
  controller.initialize();
  await vi.waitFor(() =>
    expect(["connected", "offline"]).toContain(controller.state.status),
  );
  return { controller, store, runtime };
}
it("shows fifty legacy cached messages while the bounded relay head is pending", async () => {
  const events = Array.from({ length: 75 }, (_, i) => message(i + 1));
  const pending = deferred<CommunityContentWindow>();
  const load = vi.fn().mockImplementation(() => pending.promise);
  const { controller, store } = await setup(events, { load });
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(controller.state.workspace.messages.map((event) => event.id)).toEqual(
    events.slice(-50).map((event) => event.id),
  );
  expect(load.mock.calls[0]?.[0]).toEqual({
    collection: "channel-roots",
    groupId: "a",
    limit: 50,
  });
  expect(controller.state.history?.complete).toBe(false);
  const savedKey = historyPageKey(scope, { type: "public" }, "nip29", {
    collection: "channel-roots",
    groupId: "a",
    limit: 50,
  });
  expect(await store.readHistoryPage!(scope, savedKey)).toBeUndefined();
  const latest = message(76);
  pending.resolve({
    events: [latest],
    primaryEventIds: [latest.id],
    hasOlder: false,
    olderCursor: { createdAt: 76, eventId: latest.id },
  });
  await vi.waitFor(() => expect(controller.state.history?.loading).toBe(false));
  expect(controller.state.workspace.messages.map((event) => event.id)).toEqual(
    [...events, latest].slice(-50).map((event) => event.id),
  );
  expect(
    (await store.readHistoryPage!(scope, savedKey))?.page.primaryEventIds,
  ).toHaveLength(50);
});
it("loads older cached windows offline without creating relay coverage", async () => {
  const events = Array.from({ length: 125 }, (_, i) => message(i + 1));
  const { controller, store } = await setup(events, { offline: true });
  expect(controller.state.workspace.messages).toHaveLength(50);
  await controller.actions.loadOlderHistory!();
  expect(controller.state.workspace.messages.map((event) => event.id)).toEqual(
    events.slice(-100).map((event) => event.id),
  );
  await controller.actions.loadOlderHistory!();
  expect(controller.state.workspace.messages.map((event) => event.id)).toEqual(
    events.map((event) => event.id),
  );
  expect(controller.state.history).toMatchObject({
    complete: false,
    hasNewer: true,
  });
  expect(
    controller.state.workspace.navigationSections
      .flatMap((section) => section.rooms)
      .find((room) => room.id === "a")?.unreadComplete,
  ).toBe(false);
  await expect(controller.actions.loadOlderHistory!()).rejects.toThrow(
    "not cached",
  );
  expect(controller.state.history?.error).toContain("not cached");
  expect(controller.state.workspace.messages).toHaveLength(125);
  const savedKey = historyPageKey(scope, { type: "public" }, "nip29", {
    collection: "channel-roots",
    groupId: "a",
    limit: 50,
  });
  expect(await store.readHistoryPage!(scope, savedKey)).toBeUndefined();
});
it("hydrates a selected cached thread without displaying replies from its neighbour", async () => {
  const root = message(1),
    other = message(2);
  const replies = Array.from({ length: 65 }, (_, i) =>
    message(10 + i, "a", root.id),
  );
  const unrelated = Array.from({ length: 80 }, (_, i) =>
    message(100 + i, "a", other.id),
  );
  const { controller } = await setup([root, other, ...replies, ...unrelated], {
    offline: true,
  });
  controller.actions.openThread(root.id);
  await vi.waitFor(() =>
    expect(
      controller.state.workspace.thread?.messages.filter(
        (event) => event.id !== root.id,
      ),
    ).toHaveLength(50),
  );
  expect(
    controller.state.workspace.thread?.messages
      .filter((event) => event.id !== root.id)
      .map((event) => event.id),
  ).toEqual(replies.slice(-50).map((event) => event.id));
  await controller.actions.loadOlderHistory!({
    scopeId: scope.id,
    roomId: "a",
    rootEventId: root.id,
  });
  expect(
    controller.state.workspace.thread?.messages
      .filter((event) => event.id !== root.id)
      .map((event) => event.id),
  ).toEqual(replies.map((event) => event.id));
});
it("preserves unpaged source restoration without opting it into history windows", async () => {
  const events = Array.from({ length: 75 }, (_, i) => message(i + 1));
  const { controller } = await setup(events, { legacy: true });
  expect(controller.state.workspace.messages.map((event) => event.id)).toEqual(
    events.map((event) => event.id),
  );
  await controller.actions.loadOlderHistory!();
  expect(controller.state.workspace.messages).toHaveLength(75);
});

for (const kind of [5, 9005]) {
  it(`retains cached kind ${kind} deletion controls when loading an offline legacy window`, async () => {
    const deleted = message(10),
      retained = message(11);
    const deletion = finalizeEvent(
      {
        kind,
        created_at: 200,
        content: "",
        tags: [
          ["h", "a"],
          ["e", deleted.id],
        ],
      },
      key,
    );
    const { controller } = await setup([deleted, retained, deletion], {
      offline: true,
    });
    expect(
      controller.state.workspace.messages.map((event) => event.id),
    ).toEqual([retained.id]);
    expect(controller.state.history?.complete).toBe(false);
  });
}

it("keeps a cached forum root visible while its thread replies load", async () => {
  const root = finalizeEvent(
    {
      kind: 11,
      created_at: 10,
      content: "Cached forum root",
      tags: [
        ["h", "a"],
        ["title", "Cached topic"],
      ],
    },
    key,
  );
  const pending = deferred<CommunityContentWindow>();
  const load = vi
    .fn()
    .mockResolvedValueOnce({
      events: [root],
      primaryEventIds: [root.id],
      hasOlder: false,
    })
    .mockImplementation(() => pending.promise);
  const { controller } = await setup([root], { forum: true, load });
  await vi.waitFor(() => expect(controller.state.history?.loading).toBe(false));
  controller.actions.openTopic(root.id);
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  expect(
    controller.state.workspace.messages.map((message) => message.id),
  ).toContain(root.id);
  pending.resolve({ events: [], primaryEventIds: [], hasOlder: false });
  await vi.waitFor(() => expect(controller.state.history?.loading).toBe(false));
  expect(
    controller.state.workspace.messages.map((message) => message.id),
  ).toContain(root.id);
});
