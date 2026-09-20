import { expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import { createCommunityTestScenario } from "../testing/community-test-runtime.js";
import { materializeCommunityWorkspace } from "./materialize.js";

it("keeps nested agent replies in the original request thread without flattening reply targets", () => {
  const scenario = createCommunityTestScenario();
  const sign = (content: string, tags: string[][], created_at: number) =>
    finalizeEvent(
      {
        kind: 9,
        created_at,
        content,
        tags: [["h", "general"], ...tags],
      },
      new Uint8Array(32).fill(53),
    );
  const root = sign("Please update README", [], 1700000000);
  const reply = sign(
    "Updated README",
    [
      ["e", root.id, "", "root"],
      ["e", root.id, "", "reply"],
    ],
    1700000001,
  );
  const followup = sign(
    "Please clarify the review",
    [
      ["e", root.id, "", "root"],
      ["e", reply.id, "", "reply"],
    ],
    1700000002,
  );
  const answer = sign(
    "Clarified the review",
    [
      ["e", root.id, "", "root"],
      ["e", followup.id, "", "reply"],
    ],
    1700000003,
  );
  const unrelated = sign("Another topic", [], 1700000004);
  const workspace = materializeCommunityWorkspace(
    [scenario.scope],
    {
      [scenario.scope.id]: [
        ...scenario.events,
        answer,
        unrelated,
        followup,
        reply,
        root,
      ],
    },
    scenario.scope.id,
    { activeRoomId: "general", activeThreadId: root.id },
  );
  expect(workspace.thread?.messages.map((message) => message.id)).toEqual([
    root.id,
    reply.id,
    followup.id,
    answer.id,
  ]);
  expect(workspace.thread?.messages.at(-1)?.parentMessageId).toBe(followup.id);
  expect(workspace.messages.map((message) => message.id)).not.toContain(
    answer.id,
  );
});
