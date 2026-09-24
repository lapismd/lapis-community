import { expect, it } from "vitest";
import type { NostrEvent } from "../protocol/index.js";
import { orderConversationEvents } from "./conversation-event-order.js";

const request = "f".repeat(64);
function event(
  id: string,
  tags: string[][] = [],
  pubkey = "a".repeat(64),
): NostrEvent {
  return { id, tags, pubkey, created_at: 10, kind: 9, content: id, sig: "" };
}
const record = (sequence: number, target = request, prefix = "agent") => [
  ["e", target, "", "root"],
  ["d", `${prefix}:${target}:${sequence}:assistant_message`],
];
const ids = (events: NostrEvent[]) =>
  orderConversationEvents(events).map((e) => e.id);

it("keeps numeric record order stable across duplicate and reversed replay", () => {
  const events = [
    event("a", record(11)),
    event("b", record(2)),
    event(request),
  ];
  expect(ids(events)).toEqual([request, "b", "a"]);
  expect(ids([...events].reverse().concat(events))).toEqual(ids(events));
});

it("keeps author, request, and agent identity batches independent", () => {
  for (const unrelated of [
    event("b", record(2), "b".repeat(64)),
    event("b", record(2, "e".repeat(64))),
    event("b", record(2, request, "another-agent")),
  ])
    expect(ids([unrelated, event("a", record(11))])).toEqual(["a", "b"]);
});

it("ignores ambiguous, malformed, and unreferenced record identities", () => {
  for (const tags of [
    [...record(2), ["d", `agent:${request}:3:assistant_message`]],
    [
      ["e", request],
      ["d", `agent:${request}:NaN:assistant_message`],
    ],
    record(Number.MAX_SAFE_INTEGER + 1),
    [["d", `agent:${request}:2:assistant_message`]],
    [
      ["e", request],
      ["d", `agent:${request}:2:tool_call`],
    ],
  ])
    expect(ids([event("b", tags), event("a", record(11))])).toEqual(["a", "b"]);
});

it("places same-second channel and forum parents before replies but ignores mentions", () => {
  for (const tag of [
    ["e", "z", "", "reply"],
    ["E", "z"],
    ["e", "z"],
  ]) {
    expect(ids([event("a", [tag]), event("z")])).toEqual(["z", "a"]);
  }
  expect(ids([event("a", [["e", "z", "", "mention"]]), event("z")])).toEqual([
    "a",
    "z",
  ]);
});

it("never reorders different timestamps to satisfy references or sequences", () => {
  expect(
    ids([
      event("a", record(11)),
      { ...event("b", record(2)), created_at: 11 },
      { ...event(request), created_at: 12 },
    ]),
  ).toEqual(["a", "b", request]);
});

it("retains cyclic and self-referencing events deterministically without hanging", () => {
  const events = [
    event("a", [["e", "b"]]),
    event("b", [["e", "a"]]),
    event("c", [["e", "c"]]),
  ];
  expect(ids(events)).toEqual(["b", "a", "c"]);
  expect(ids([...events].reverse())).toEqual(ids(events));
});

it("handles long same-second chains without recursion or dropping records", () => {
  const events = Array.from({ length: 20_000 }, (_, index) =>
    event(String(20_000 - index).padStart(5, "0"), record(index)),
  );
  expect(ids(events)).toEqual(events.map((e) => e.id));
});
