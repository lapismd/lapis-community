import { describe, expect, it } from "vitest";
import {
  contextFixture as f,
  repositoryContextEvents,
} from "../testing/repository-context-fixture.js";
import {
  buildRepositoryAgentContexts,
  repositoryAgentContextsForSelection,
} from "./repository-agent-context.js";
import { withRepositoryContextActivity } from "./repository-context-activity.js";
import { repositoryContextTurns } from "../components/community-projects/repository-context-transcript.js";

describe("explicit checkpoint context", () => {
  it("uses exact commit targets, retains tool details, and groups Activity checkpoints", () => {
    const events = repositoryContextEvents();
    const contexts = buildRepositoryAgentContexts(events);
    expect(contexts[0]).toMatchObject({
      commitIds: [f.commit],
      targets: [{ commitId: f.commit, changeId: "d".repeat(32) }],
      repositoryAddress: f.repository,
      channelId: "room",
      actorName: "Nyra",
      availability: "complete",
    });
    expect(contexts[0]!.records[1]).toMatchObject({
      toolId: "edit-1",
      input: expect.stringContaining("README.md"),
      output: "Success. Updated README.md",
    });
    expect(
      repositoryAgentContextsForSelection(contexts, "log", "e".repeat(40)),
    ).toEqual([]);
    expect(withRepositoryContextActivity([], events)).toMatchObject([
      {
        repositoryCoordinate: f.repository,
        actorPubkey: f.agent,
        agentContext: contexts,
      },
    ]);
    const repeated = {
      ...contexts[0]!,
      eventId: "later",
      createdAt: contexts[0]!.createdAt + 1,
    };
    const turns = repositoryContextTurns([...contexts, repeated]);
    expect(
      turns[0]!.segments.flatMap((segment) => segment.activity),
    ).toHaveLength(3);
    expect(turns[0]!.segments.flatMap((segment) => segment.commitIds)).toEqual([
      f.commit,
    ]);
  });

  it("keeps commit association while pages are missing and rejects cross-author pages", () => {
    const events = repositoryContextEvents();
    expect(buildRepositoryAgentContexts(events.slice(1))[0]).toMatchObject({
      availability: "missing",
      commitIds: [f.commit],
      records: [],
    });
    events[0]!.pubkey = f.user;
    expect(buildRepositoryAgentContexts(events)).toEqual([]);
  });

  it("reassembles complete messages split across pages without duplicating logical entries", () => {
    const events = repositoryContextEvents();
    const page = events[2]!;
    const body = JSON.parse(page.content);
    body.page_count = 2;
    body.records[0].text = "A long complete ";
    page.content = JSON.stringify(body);
    const fragment = {
      ...page,
      id: "5".repeat(64),
      content: JSON.stringify({
        ...body,
        page_index: 1,
        records: [{ ...body.records[0], text: "message." }],
      }),
    };
    const manifest = JSON.parse(events[3]!.content);
    manifest.page_event_ids.push(fragment.id);
    events[3]!.content = JSON.stringify(manifest);
    expect(
      buildRepositoryAgentContexts([...events, fragment])[0]!.records[2]!.text,
    ).toBe("A long complete message.");
    fragment.pubkey = f.user;
    expect(buildRepositoryAgentContexts([...events, fragment])).toEqual([]);
  });
});
