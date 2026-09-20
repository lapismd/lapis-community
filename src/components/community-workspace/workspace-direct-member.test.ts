import { describe, expect, it } from "vitest";

import {
  withDirectAgentKind,
  workspaceDirectMember,
} from "./workspace-direct-member.js";

const ada = {
  id: "ada",
  name: "Ada Lovelace",
  handle: "ada",
  initials: "AL",
};

describe("withDirectAgentKind", () => {
  it("tags a direct peer that matches a known agent pubkey", () => {
    expect(withDirectAgentKind(ada, [ada.id])).toEqual({
      ...ada,
      kind: "agent",
    });
  });

  it("leaves people and already tagged agents unchanged", () => {
    expect(withDirectAgentKind(ada, [])).toBe(ada);
    const agent = { ...ada, kind: "agent" as const };
    expect(withDirectAgentKind(agent, [ada.id])).toBe(agent);
  });
});

describe("workspaceDirectMember", () => {
  it("returns the peer from participant ids", () => {
    expect(
      workspaceDirectMember(
        {
          kind: "direct",
          name: "Ada Lovelace",
          participantIds: ["noor", "ada"],
        },
        [ada],
        "noor",
      ),
    ).toBe(ada);
  });
});
