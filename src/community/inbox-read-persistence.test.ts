import { expect, it, vi } from "vitest";
import {
  createCommunityTestRuntime,
  createCommunityTestScenario,
} from "../testing/community-test-runtime.js";
import { createCommunityController } from "./community-controller.svelte.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";
import { createNip17GiftWraps } from "./nip17.js";
import { createBrowserCommunityStateStore } from "./state-store.js";

it("restores Inbox read cursors across controller and browser-store recreation", async () => {
  const runtime = await createCommunityTestRuntime();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const controllers: ReturnType<typeof createCommunityController>[] = [];
  const create = () => {
    const scenario = createCommunityTestScenario();
    scenario.member.dispose();
    scenario.participant.dispose();
    const controller = createCommunityController({
      scopes: [runtime.scenario.scope],
      source: createNip29CommunitySource({
        relayFactory: runtime.relayFactory,
        agents: false,
        presence: false,
      }),
      identity: scenario.operator,
      stateStore: createBrowserCommunityStateStore({ storage }),
      now: () => 1700000400,
    });
    controllers.push(controller);
    controller.initialize();
    return controller;
  };
  try {
    const owner = await runtime.scenario.operator.getPublicKey();
    const wraps = await createNip17GiftWraps({
      identity: runtime.scenario.member,
      recipients: [owner],
      content: "Read this once",
      createdAt: 1700000300,
    });
    runtime.relay.inject(
      wraps.find((event) =>
        event.tags.some((tag) => tag[0] === "p" && tag[1] === owner),
      )!,
    );
    const first = create();
    await vi.waitFor(() =>
      expect(
        first.state.inbox?.items.some(
          (item) => item.excerpt === "Read this once",
        ),
      ).toBe(true),
    );
    const item = first.state.inbox!.items.find(
      (item) => item.excerpt === "Read this once",
    )!;
    await first.actions.selectInboxItem!(item.id);
    await first.actions.markRead(item.roomId!, {
      eventId: item.latestEventId!,
    });
    expect(
      first.state.inbox?.items.find((row) => row.id === item.id)?.unread,
    ).toBe(false);
    first.dispose();
    controllers.pop();

    const restored = create();
    await vi.waitFor(() =>
      expect(
        restored.state.inbox?.items.find((row) => row.id === item.id)?.unread,
      ).toBe(false),
    );
    const other = restored.state.inbox!.items.find(
      (row) => row.id !== item.id,
    )!;
    await restored.actions.selectInboxItem!(other.id);
    restored.actions.setInboxFilter!("Direct messages", true);
    await vi.waitFor(() => {
      expect(restored.state.inbox?.unreadOnly).toBe(true);
      expect(
        restored.state.inbox?.items.some((row) => row.id === item.id),
      ).toBe(false);
    });
  } finally {
    for (const controller of controllers) controller.dispose();
    runtime.dispose();
  }
});
