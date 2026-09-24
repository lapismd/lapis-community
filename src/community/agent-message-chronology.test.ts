import { expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import { createCommunityTestScenario } from "../testing/community-test-runtime.js";
import { materializeCommunityWorkspace } from "./materialize.js";

it("orders same-second agent messages by durable record sequence after their triggering reply", () => {
  const scenario = createCommunityTestScenario();
  const secret = new Uint8Array(32).fill(54);
  const root = finalizeEvent(
    {
      kind: 9,
      created_at: 1700000010,
      content: "Start",
      tags: [["h", "general"]],
    },
    secret,
  );
  const first = finalizeEvent(
    {
      kind: 9,
      created_at: root.created_at,
      content: "Preparing the edit",
      tags: [
        ["h", "general"],
        ["e", root.id, "", "root"],
        ["e", root.id, "", "reply"],
        ["d", `agent:${root.id}:2:assistant_message`],
      ],
    },
    secret,
  );
  const complete = (nonce: number) =>
    finalizeEvent(
      {
        kind: 9,
        created_at: root.created_at,
        content: `The edit is complete ${nonce}`,
        tags: [
          ["h", "general"],
          ["e", root.id, "", "root"],
          ["e", root.id, "", "reply"],
          ["d", `agent:${root.id}:11:assistant_message`],
        ],
      },
      secret,
    );
  let nonce = 0,
    last = complete(nonce);
  while (last.id > first.id && nonce < 1000) last = complete(++nonce);
  expect(last.id < first.id).toBe(true);
  for (const events of [
    [last, first, root],
    [root, last, first, last],
  ]) {
    const workspace = materializeCommunityWorkspace(
      [scenario.scope],
      { [scenario.scope.id]: [...scenario.events, ...events] },
      scenario.scope.id,
      { activeRoomId: "general", activeThreadId: root.id },
    );
    expect(workspace.thread?.messages.map((message) => message.id)).toEqual([
      root.id,
      first.id,
      last.id,
    ]);
  }
});
