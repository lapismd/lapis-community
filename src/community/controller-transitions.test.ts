import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommunityController } from "./community-controller.svelte.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import type {
  CommunityController,
  CommunitySession,
  CommunitySearchResult,
  CommunityContentWindow,
} from "./contracts.js";

const controllers: CommunityController[] = [];
afterEach(() =>
  controllers.splice(0).forEach((controller) => controller.dispose()),
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function setup(overrides: Partial<CommunitySession> = {}) {
  const runtime = createInlineCommunityEventRuntime();
  const project = vi.spyOn(runtime, "project");
  const controller = createCommunityController({
    runtime,
    scopes: [
      {
        id: "test",
        name: "Test",
        relayUrl: "wss://test.invalid",
        rooms: [
          { id: "a", groupId: "a", name: "A", kind: "channel" },
          { id: "b", groupId: "b", name: "B", kind: "channel" },
        ],
      },
    ],
    source: {
      async open() {
        return {
          async snapshot() {
            return {
              events: [],
              capabilities: {
                channels: true,
                forums: true,
                directMessages: false,
                search: true,
                manageGroup: false,
                manageMembers: false,
                deleteEvents: false,
                archive: false,
                editMessages: false,
              },
            };
          },
          async subscribe() {
            return { close() {} };
          },
          async execute() {
            return [];
          },
          async search() {
            return [];
          },
          close() {},
          ...overrides,
        };
      },
    },
  });
  controllers.push(controller);
  controller.initialize();
  await vi.waitFor(() => expect(controller.state.status).toBe("connected"));
  return { controller, project };
}

describe("controller transition guards", () => {
  it("does not restore a signed-out identity when its earlier public-key lookup completes", async () => {
    const { controller } = await setup();
    const key = deferred<string>();
    const dispose = vi.fn();
    const pending = controller.actions.connectIdentity({
      connect: async () => ({
        getPublicKey: () => key.promise,
        signEvent: vi.fn(),
        dispose,
      }),
    });
    await vi.waitFor(() =>
      expect(controller.state.authentication.status).toBe("connecting"),
    );
    await controller.actions.disconnectIdentity();
    key.resolve("a".repeat(64));
    await pending;
    expect(controller.state.authentication.status).toBe("anonymous");
    expect(controller.state.workspace.currentMemberId).toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("ignores a replaced identity failure and clears private presentation state on sign-out", async () => {
    const { controller } = await setup();
    const key = deferred<string>();
    const old = controller.actions.connectIdentity({
      connect: async () => ({
        getPublicKey: () => key.promise,
        signEvent: vi.fn(),
      }),
    });
    await Promise.resolve();
    const activeKey = controller.state.timelinePresentation!.key;
    controller.actions.updateTimelinePresentation!(activeKey, {
      draft: "Private draft",
    });
    await controller.actions.disconnectIdentity();
    key.reject(new Error("Expired signer"));
    await old;
    expect(controller.state.authentication.status).toBe("anonymous");
    expect(controller.state.timelinePresentation?.draft).toBe("");
  });
  it("isolates member search and saved positions from the composed message state", async () => {
    const { controller, project } = await setup();
    const state = controller.state;
    const messages = state.workspace.messages;
    project.mockClear();
    await controller.actions.searchMembers("member");
    controller.actions.updateTimelinePresentation!(
      state.timelinePresentation!.key,
      {
        position: {
          messageId: "anchor",
          index: 0,
          offset: 10,
          atLatest: false,
        },
      },
    );
    expect(controller.state.workspace.messages).toBe(messages);
    expect(project).not.toHaveBeenCalled();
    expect(controller.state.memberDirectory.query).toBe("member");
    expect(controller.state.timelinePresentation?.position?.messageId).toBe(
      "anchor",
    );
  });

  it("keeps the latest member query after stale results, errors, and cleanup", async () => {
    const older = deferred<readonly CommunitySearchResult[]>();
    const latest = deferred<readonly CommunitySearchResult[]>();
    const { controller } = await setup({
      search: (query) => (query === "older" ? older.promise : latest.promise),
    });
    const oldRequest = controller.actions.searchMembers!("older");
    const newRequest = controller.actions.searchMembers!("latest");
    latest.resolve([]);
    await newRequest;
    older.resolve([]);
    await oldRequest;
    expect(controller.state.memberDirectory.query).toBe("latest");
    expect(controller.state.operations["members:search"]?.status).toBe("idle");
  });

  it("does not let an old search error replace the current operation", async () => {
    const older = deferred<readonly CommunitySearchResult[]>();
    const { controller } = await setup({
      search: (query) =>
        query === "older" ? older.promise : Promise.resolve([]),
    });
    const oldRequest = controller.actions.searchMembers!("older");
    await controller.actions.searchMembers!("latest");
    older.reject(new Error("Old failure"));
    await oldRequest.catch(() => {});
    expect(controller.state.operations["members:search"]?.status).toBe("idle");
  });

  it("coalesces rapid room selection into one projection", async () => {
    const { controller, project } = await setup();
    project.mockClear();
    controller.actions.selectRoom("b");
    controller.actions.selectRoom("a");
    controller.actions.selectRoom("b");
    await vi.waitFor(() =>
      expect(controller.state.workspace.activeRoomId).toBe("b"),
    );
    expect(project).toHaveBeenCalledTimes(1);
  });

  it("deduplicates overlapping canvas loads, including an empty resolved head", async () => {
    const head = deferred<null>();
    const loadCanvas = vi.fn(() => head.promise);
    const { controller } = await setup({ loadCanvas });
    const first = controller.actions.loadCanvas!("a");
    const second = controller.actions.loadCanvas!("a");
    await Promise.resolve();
    head.resolve(null);
    await Promise.all([first, second]);
    expect(loadCanvas).toHaveBeenCalledTimes(1);
    expect(Object.values(controller.state.canvases!)[0]).toMatchObject({
      content: "",
      loading: false,
      eventId: null,
    });
  });

  it("preserves incomplete mailbox coverage through a failed page and retry", async () => {
    const capabilities = {
      channels: true,
      forums: true,
      directMessages: true,
      search: true,
      manageGroup: false,
      manageMembers: false,
      deleteEvents: false,
      archive: false,
      editMessages: false,
    };
    const loadDirectHistory = vi
      .fn()
      .mockRejectedValueOnce(new Error("Relay unavailable"))
      .mockResolvedValue({
        events: [],
        capabilities,
        hasOlderDirectMessages: false,
      });
    const { controller } = await setup({
      snapshot: async () => ({
        events: [],
        capabilities,
        hasOlderDirectMessages: true,
        encryptedPage: {
          request: {
            groupId: "mailbox",
            collection: "room-history",
            limit: 100,
          },
          relayUrls: ["wss://test.invalid"],
          window: {
            events: [],
            primaryEventIds: [],
            hasOlder: true,
            olderCursor: { createdAt: 100, eventId: "a".repeat(64) },
            coverageGaps: [{ createdAt: 101, eventId: "b".repeat(64) }],
          },
        },
      }),
      loadDirectHistory,
    });
    expect(controller.state.directHistory?.complete).toBe(false);
    await expect(controller.actions.loadDirectHistory!()).rejects.toThrow(
      "Relay unavailable",
    );
    await controller.actions.loadDirectHistory!();
    expect(controller.state.directHistory).toMatchObject({
      hasOlder: false,
      complete: false,
      loading: false,
    });
  });

  it("does not query other rooms or repeat a connected empty revisit", async () => {
    const loadContentWindow = vi.fn(async () => ({
      events: [],
      primaryEventIds: [],
      hasOlder: false,
    }));
    const { controller } = await setup({ loadContentWindow });
    await vi.waitFor(() =>
      expect(controller.state.history?.loading).toBe(false),
    );
    expect(loadContentWindow).toHaveBeenCalledTimes(1);
    expect(loadContentWindow).toHaveBeenLastCalledWith(
      expect.objectContaining({ groupId: "a", limit: 50 }),
      expect.any(AbortSignal),
    );
    controller.actions.selectRoom("b");
    await vi.waitFor(() =>
      expect(controller.state.history?.loading).toBe(false),
    );
    expect(loadContentWindow).toHaveBeenCalledTimes(2);
    controller.actions.selectRoom("a");
    await vi.waitFor(() =>
      expect(controller.state.workspace.activeRoomId).toBe("a"),
    );
    expect(loadContentWindow).toHaveBeenCalledTimes(2);
    await controller.actions.loadOlderHistory!();
    expect(loadContentWindow).toHaveBeenCalledTimes(2);
  });
  it("serializes a newer jump behind pagination and ignores the stale older window", async () => {
    const signed = (created_at: number) =>
      finalizeEvent(
        {
          kind: 9,
          created_at,
          content: `Message ${created_at}`,
          tags: [["h", "a"]],
        },
        new Uint8Array(32).fill(70),
      );
    const initial = signed(100),
      earlier = signed(50),
      latest = signed(200);
    const window = (
      event: typeof initial,
      hasOlder = true,
    ): CommunityContentWindow => ({
      events: [event],
      primaryEventIds: [event.id],
      hasOlder,
      olderCursor: { createdAt: event.created_at, eventId: event.id },
    });
    const older = deferred<CommunityContentWindow>();
    const jump = deferred<CommunityContentWindow>();
    const loadContentWindow = vi
      .fn<NonNullable<CommunitySession["loadContentWindow"]>>()
      .mockResolvedValueOnce(window(initial))
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => jump.promise);
    const { controller } = await setup({ loadContentWindow });
    await vi.waitFor(() =>
      expect(controller.state.history?.loading).toBe(false),
    );
    const olderRequest = controller.actions.loadOlderHistory!();
    await vi.waitFor(() => expect(loadContentWindow).toHaveBeenCalledTimes(2));
    const latestRequest = controller.actions.loadNewerHistory!();
    expect(loadContentWindow).toHaveBeenCalledTimes(2);
    older.resolve(window(earlier, false));
    await olderRequest;
    await vi.waitFor(() => expect(loadContentWindow).toHaveBeenCalledTimes(3));
    expect(
      controller.state.workspace.messages.map((message) => message.id),
    ).toEqual([initial.id]);
    jump.resolve(window(latest));
    await latestRequest;
    expect(
      controller.state.workspace.messages.map((message) => message.id),
    ).toEqual([latest.id]);
    expect(controller.state.history?.hasNewer).toBe(false);
  });
});
