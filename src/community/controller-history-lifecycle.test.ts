import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, expect, it, vi } from "vitest";
import { createCommunityController } from "./community-controller.svelte.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import type {
  CommunityController,
  CommunitySession,
  CommunitySnapshot,
} from "./contracts.js";

const controllers: CommunityController[] = [];
const releases: (() => void)[] = [];
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  releases.splice(0).forEach((resolve) => resolve());
});
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
function create(overrides: Partial<CommunitySession> = {}, paged = true) {
  const runtime = createInlineCommunityEventRuntime();
  const started: string[] = [],
    release = new Map<string, () => void>();
  const controller = createCommunityController({
    runtime,
    scopes: [
      {
        id: "s",
        name: "S",
        relayUrl: "wss://test.invalid",
        rooms: ["a", "b", "c", "d"].map((id) => ({
          id,
          groupId: id,
          name: id,
          kind: "channel",
        })),
      },
    ],
    source: {
      historyPaging: paged,
      open: async () => ({
        snapshot: async () => ({ events: [], capabilities }),
        subscribe: async () => ({ close() {} }),
        execute: async () => [],
        search: async () => [],
        close() {},
        ...(paged
          ? {
              loadContentWindow: async (request: { groupId: string }) => {
                started.push(request.groupId);
                await new Promise<void>((resolve) => {
                  release.set(request.groupId, resolve);
                  releases.push(resolve);
                });
                return { events: [], primaryEventIds: [], hasOlder: false };
              },
            }
          : {}),
        ...overrides,
      }),
    },
  });
  controllers.push(controller);
  controller.initialize();
  return { controller, runtime, started, release };
}

it("starts the currently visible queued room before an earlier hidden selection", async () => {
  const { controller, started, release } = create();
  await vi.waitFor(() => expect(started).toEqual(["a"]));
  controller.actions.selectRoom("b");
  await vi.waitFor(() => expect(started).toEqual(["a", "b"]));
  controller.actions.selectRoom("c");
  controller.actions.selectRoom("d");
  release.get("a")!();
  await vi.waitFor(() => expect(started).toEqual(["a", "b", "d"]));
  expect(controller.state.workspace.activeRoomId).toBe("d");
});

for (const operation of ["loadDirectHistory", "loadOlderInbox"] as const) {
  it(`does not start queued ${operation} after disposal`, async () => {
    const staleRead = vi.fn(async () => {
      throw new Error("Closed session used");
    });
    const { controller, started, release } = create({
      loadDirectHistory: staleRead,
      loadInboxWindow: staleRead,
    });
    await vi.waitFor(() => expect(started).toEqual(["a"]));
    controller.actions.selectRoom("b");
    await vi.waitFor(() => expect(started).toEqual(["a", "b"]));
    const pending = controller.actions[operation]!();
    controller.dispose();
    release.forEach((resolve) => resolve());
    await pending;
    expect(staleRead).not.toHaveBeenCalled();
    expect(controller.state.status).toBe("idle");
  });
}

it("ignores a refresh snapshot from the previous session after sign-out", async () => {
  let resolve!: (snapshot: CommunitySnapshot) => void;
  const pending = new Promise<CommunitySnapshot>((done) => {
    resolve = done;
  });
  const snapshot = vi
    .fn()
    .mockResolvedValueOnce({ events: [], capabilities })
    .mockImplementationOnce(() => pending)
    .mockResolvedValue({ events: [], capabilities });
  const { controller, runtime } = create({ snapshot }, false);
  const ingest = vi.spyOn(runtime, "ingest");
  await vi.waitFor(() => expect(controller.state.status).toBe("connected"));
  const refreshing = controller.refresh();
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2));
  await controller.actions.disconnectIdentity();
  ingest.mockClear();
  const old = finalizeEvent(
    { kind: 9, created_at: 100, tags: [["h", "a"]], content: "Stale refresh" },
    new Uint8Array(32).fill(3),
  );
  resolve({
    events: [old],
    capabilities: { ...capabilities, manageGroup: true },
  });
  await refreshing;
  expect(ingest).not.toHaveBeenCalled();
  expect(
    controller.state.workspace.messages.map((message) => message.id),
  ).not.toContain(old.id);
  expect(controller.state.operations.refresh).toBeUndefined();
});
