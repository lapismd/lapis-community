import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../testing/transcript-comment-fixture.js";
import { checkpointThreadComments } from "../components/community-agent-thread-context/projection.js";
import { buildRepositoryAgentContexts } from "./repository-agent-context.js";
it.each([false, true])(
  "validates the checkpoint author before putting a review into a thread (forged=%s)",
  (forged) => {
    const f = transcriptCommentFixture();
    const body = JSON.parse(f.checkpoint.content);
    body.targets = [
      { commit_id: "a".repeat(40), change_id_hex: "b".repeat(32) },
    ];
    const checkpoint = f.sign(
      { ...f.checkpoint, content: JSON.stringify(body) },
      true,
    );
    const comment = f.sign({
      kind: 1111,
      created_at: 1800000001,
      content: "Please revise",
      tags: [
        ["E", checkpoint.id],
        ["K", "3907"],
        ["P", forged ? f.owner : f.agent],
        ["a", f.repository],
        ["h", "general"],
        ["c", "a".repeat(40)],
        ["t", "commit-comment"],
        ["thread", f.root.id],
        ["request", f.request.id],
      ],
    });
    const events = [
      ...f.events.filter((e) => e.id !== f.checkpoint.id),
      checkpoint,
      comment,
    ];
    expect(
      checkpointThreadComments(
        buildRepositoryAgentContexts(events),
        events,
        f.root.id,
        "general",
      ),
    ).toEqual(forged ? [] : [comment]);
  },
);
