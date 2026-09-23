import { expect, it, vi } from "vitest";

import { runStorybookSuite } from "./test-storybook-all.mjs";

it("runs every shard once without filtering tests or suppressing diagnostics", () => {
  const run = vi.fn(() => ({ status: 0 }));
  expect(runStorybookSuite(run, () => {})).toBe(0);
  expect(run).toHaveBeenCalledTimes(8);
  const shards = run.mock.calls.map(([, args, options]) => {
    expect(args.slice(1, 4)).toEqual(["run", "--project", "storybook"]);
    expect(args).toHaveLength(7);
    expect(args.slice(5)).toEqual(["--maxWorkers=1", "--reporter=verbose"]);
    expect(options.stdio).toBe("inherit");
    return args[4];
  });
  expect(shards).toEqual(
    Array.from({ length: 8 }, (_, index) => `--shard=${index + 1}/8`),
  );
});

it("stops at the first failing shard and preserves its exit status", () => {
  const run = vi
    .fn()
    .mockReturnValueOnce({ status: 0 })
    .mockReturnValueOnce({ status: 2 });
  expect(runStorybookSuite(run, () => {})).toBe(2);
  expect(run).toHaveBeenCalledTimes(2);
});

it("fails when a browser process is terminated", () => {
  const run = vi.fn(() => ({ status: null, signal: "SIGTERM" }));
  expect(runStorybookSuite(run, () => {})).toBe(1);
  expect(run).toHaveBeenCalledTimes(1);
});

it("fails when a test process cannot start", () => {
  const run = vi.fn(() => ({ status: null, error: new Error("spawn failed") }));
  const log = vi.fn();
  expect(runStorybookSuite(run, log)).toBe(1);
  expect(log).toHaveBeenCalledWith(expect.stringContaining("spawn failed"));
  expect(run).toHaveBeenCalledTimes(1);
});
