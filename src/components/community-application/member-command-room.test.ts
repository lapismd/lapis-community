import { describe, expect, it } from "vitest";

import {
  memberCommandGroupIds,
  resolveMemberCommandRoom,
} from "./member-command-room.js";

describe("member command room", () => {
  it("resolves an override by room or group id", () => {
    const active = { id: "projects", groupId: "proj" };
    const home = { id: "dev-room", groupId: "dev" };
    expect(resolveMemberCommandRoom([home], active, "dev")).toEqual(home);
    expect(resolveMemberCommandRoom([home], active)).toEqual(active);
  });

  it("lists direct participants or channel members with roles", () => {
    expect(
      memberCommandGroupIds({ kind: "direct", participantIds: ["a"] }, [
        { id: "b", role: "member" },
      ]),
    ).toEqual(["a"]);
    expect(
      memberCommandGroupIds({ kind: "channel" }, [
        { id: "b", role: "member" },
        { id: "c" },
      ]),
    ).toEqual(["b"]);
  });
});
