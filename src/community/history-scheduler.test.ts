import { expect, it, vi } from "vitest";
import { createHistoryScheduler } from "./history-scheduler.js";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it("reevaluates visibility before starting queued work and eventually serves hidden work", async () => {
  const scheduler = createHistoryScheduler(1),
    blocker = deferred(),
    first = deferred(),
    second = deferred(),
    started: string[] = [];
  let selected = "old";
  const active = scheduler.run("active", () => blocker.promise);
  const hidden = scheduler.run(
    "old",
    async () => {
      started.push("old");
      await first.promise;
    },
    () => selected === "old",
  );
  const current = scheduler.run(
    "new",
    async () => {
      started.push("new");
      await second.promise;
    },
    () => selected === "new",
  );
  selected = "new";
  blocker.resolve();
  await active;
  await vi.waitFor(() => expect(started).toEqual(["new"]));
  second.resolve();
  await current;
  await vi.waitFor(() => expect(started).toEqual(["new", "old"]));
  first.resolve();
  await hidden;
});
it("retains boolean priorities, shared requests and per-conversation exclusion", async () => {
  const scheduler = createHistoryScheduler(2),
    a = deferred(),
    b = deferred(),
    started: string[] = [];
  const active = scheduler.run("a", () => a.promise, true, "room");
  expect(
    scheduler.run("a", async () => {
      throw new Error("duplicate started");
    }),
  ).toBe(active);
  const serial = scheduler.run(
    "a-next",
    async () => {
      started.push("a-next");
    },
    true,
    "room",
  );
  const other = scheduler.run(
    "b",
    async () => {
      started.push("b");
      await b.promise;
    },
    false,
    "another",
  );
  await vi.waitFor(() => expect(started).toEqual(["b"]));
  a.resolve();
  await active;
  await serial;
  expect(started).toEqual(["b", "a-next"]);
  b.resolve();
  await other;
});
