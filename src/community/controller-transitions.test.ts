import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommunityController } from "./community-controller.svelte.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import type {
  CommunityController,
  CommunitySession,
  CommunitySearchResult,
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
});
