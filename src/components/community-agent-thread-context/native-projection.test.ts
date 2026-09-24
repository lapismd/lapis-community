import { expect, it } from "vitest";
import { nativeTranscriptCommentFixture } from "../../testing/native-transcript-comment-fixture.js";
import { buildRepositoryAgentContexts } from "../../projects/repository-agent-context.js";
import { threadContextSegments } from "./projection.js";

it("keeps native plan, settled permission and usage beside their original request", () => {
  const fixture = nativeTranscriptCommentFixture();
  const checkpoints = buildRepositoryAgentContexts(fixture.events);
  const activity = threadContextSegments(
    checkpoints,
    fixture.events,
    fixture.root.id,
    fixture.root.id,
  ).flatMap((segment) => segment.activity);
  expect(activity.map((item) => item.frame.kind)).toEqual([
    "thinking",
    "plan",
    "tool",
    "permission",
    "usage",
  ]);
  expect(
    activity.find((item) => item.frame.kind === "plan")?.frame.payload,
  ).toMatchObject({
    entry: {
      entries: [
        { content: "Inspect the repository" },
        { content: "Add the license" },
      ],
    },
  });
});
