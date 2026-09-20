import { describe, expect, it } from "vitest";

import {
  communityIdentityMembers,
  communityIdentityMembersFromState,
  communityMemberFromAgent,
  presentCommunityIdentityModel,
  withCommunityMemberKinds,
} from "./member-identity.js";
import type { CommunityMemberModel } from "./workspace-model.js";

const person: CommunityMemberModel = {
  id: "a".repeat(64),
  name: "Maya Chen",
  handle: "maya",
  initials: "MC",
};
const agent = {
  pubkey: "b".repeat(64),
  name: "Nyra",
  avatarUrl: "https://example.test/nyra.png",
};

describe("withCommunityMemberKinds", () => {
  it("tags known agent pubkeys and leaves people unmarked", () => {
    expect(withCommunityMemberKinds([person, { ...person, id: agent.pubkey }], [agent.pubkey])).toEqual([
      person,
      { ...person, id: agent.pubkey, kind: "agent" },
    ]);
  });

  it("clears a stale agent kind when the pubkey is no longer known", () => {
    expect(
      withCommunityMemberKinds([{ ...person, kind: "agent" }], []),
    ).toEqual([person]);
  });
});

describe("communityMemberFromAgent", () => {
  it("projects a rounded-square identity from the agent directory", () => {
    expect(communityMemberFromAgent(agent)).toEqual({
      id: agent.pubkey,
      name: "Nyra",
      handle: `${agent.pubkey.slice(0, 7)}…${agent.pubkey.slice(-5)}`,
      initials: "NY",
      avatarUrl: agent.avatarUrl,
      kind: "agent",
    });
  });
});

describe("communityIdentityMembers", () => {
  it("tags room members and unions missing directory agents", () => {
    const members = communityIdentityMembers([person], [agent]);
    expect(members).toEqual([person, communityMemberFromAgent(agent)]);
  });

  it("keeps the room member name when the agent is already present", () => {
    const present = { ...person, id: agent.pubkey };
    expect(communityIdentityMembers([present], [agent])).toEqual([
      { ...present, kind: "agent" },
    ]);
  });
});

describe("presentCommunityIdentityModel", () => {
  it("returns the same model when no agent identities change", () => {
    const model = { members: [person] };
    expect(presentCommunityIdentityModel(model)).toBe(model);
  });
});

describe("communityIdentityMembersFromState", () => {
  it("unions live, archived, and public agents without duplicating pubkeys", () => {
    const members = communityIdentityMembersFromState([person], {
      publicAgents: [agent],
      archivedAgents: [{ ...agent, name: "Archived Nyra" }],
      agents: [{ ...agent, name: "Live Nyra" }],
    });
    expect(members).toEqual([
      person,
      communityMemberFromAgent({ ...agent, name: "Live Nyra" }),
    ]);
  });
});
