import { expect, it } from "vitest";
import type { NostrEvent } from "../protocol/index.js";
import {
  contextFixture as f,
  repositoryContextEvents,
} from "../testing/repository-context-fixture.js";
import { retainLiveContext } from "./repository-live-context.js";
import { buildRepositoryAgentContexts } from "./repository-agent-context.js";

function preview(
  sequence: number,
  text: string,
  state = "running",
): NostrEvent {
  return {
    ...repositoryContextEvents()[0]!,
    kind: 23908,
    created_at: 100,
    id: String(sequence).padStart(64, "0"),
    content: JSON.stringify({
      schema: "jj-sync/agent-context-live",
      version: 2,
      scope_id: f.scope,
      span_id: f.span,
      sequence,
      state,
      records:
        state === "running"
          ? [
              {
                id: "message",
                kind: "assistant_message",
                sequence: 2,
                created_at_ms: 100_000,
                text,
              },
            ]
          : [],
    }),
  };
}

it("replaces streamed snapshots, ignores stale sequence and clears on completion", () => {
  let events = retainLiveContext([], preview(1, "Working"), 100);
  events = retainLiveContext(events, preview(2, "Working on README"), 100);
  events = retainLiveContext(events, preview(1, "Working"), 100);
  expect(events).toHaveLength(1);
  expect(buildRepositoryAgentContexts(events)[0]?.records[0]?.text).toBe(
    "Working on README",
  );
  events = retainLiveContext(events, preview(3, "", "completed"), 100);
  expect(buildRepositoryAgentContexts(events)).toEqual([]);
  expect(retainLiveContext([], preview(4, "Expired"), 500)).toEqual([]);
});

it("hides live copies once the complete durable message arrives", () => {
  const live = retainLiveContext([], preview(2, "Working on README"), 100);
  const contexts = buildRepositoryAgentContexts([
    ...repositoryContextEvents(),
    ...live,
  ]);
  expect(
    contexts
      .filter((context) => context.live)
      .flatMap((context) => context.records),
  ).toEqual([]);
  expect(
    contexts
      .flatMap((context) => context.records)
      .filter((record) => record.id === "message"),
  ).toHaveLength(1);
});
