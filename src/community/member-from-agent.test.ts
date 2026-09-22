import { describe, expect, it } from "vitest";

import { applyAgentAvatars } from "./member-from-agent.js";
import type { CommunityMemberModel } from "./workspace-model.js";

const person: CommunityMemberModel = {
  id: "a".repeat(64),
  name: "Nyra",
  handle: "nyra",
  initials: "NY",
};

describe("applyAgentAvatars", () => {
  it("copies a directory image or emoji onto a matching member", () => {
    expect(
      applyAgentAvatars(
        [person],
        [{ pubkey: person.id, name: "Nyra", avatarUrl: "🧭" }],
      ),
    ).toEqual([{ ...person, avatarUrl: "🧭" }]);
  });

  it("leaves unmatched people and members that already have the avatar", () => {
    const pictured = { ...person, avatarUrl: "🧭" };
    expect(applyAgentAvatars([pictured], [])).toEqual([pictured]);
    expect(
      applyAgentAvatars(
        [pictured],
        [{ pubkey: person.id, name: "Nyra", avatarUrl: "🧭" }],
      ),
    ).toEqual([pictured]);
  });
});
