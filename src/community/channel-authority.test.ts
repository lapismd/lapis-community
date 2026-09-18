import { describe, expect, it } from "vitest";

import {
  memberCanMaintain,
  reviewerCandidates,
  roomCanMaintain,
} from "./channel-authority.js";
import type { CommunityMemberModel, CommunityRoomModel } from "./workspace-model.js";

function member(
  id: string,
  extras: Partial<CommunityMemberModel> = {},
): CommunityMemberModel {
  return {
    id,
    name: id,
    handle: id.slice(0, 8),
    initials: id.slice(0, 2),
    ...extras,
  };
}

describe("channel maintainer authority", () => {
  it("treats administrators and maintainers as CanMaintain", () => {
    expect(memberCanMaintain(member("a", { administrator: true }))).toBe(true);
    expect(
      memberCanMaintain(member("b", { roles: ["maintainer", "writer"] })),
    ).toBe(true);
    expect(memberCanMaintain(member("c", { roles: ["writer"] }))).toBe(false);
  });

  it("reads maintain permission from the room projection", () => {
    const denied = {
      id: "dev",
      name: "dev",
      kind: "channel",
      permissions: {
        publish: { state: "enabled" },
        join: { state: "denied" },
        leave: { state: "enabled" },
        update: { state: "denied" },
        delete: { state: "denied" },
        manageMembers: { state: "denied" },
        maintain: {
          state: "denied",
          reason: "A maintainer or administrator role is required",
          requirement: "maintainer",
        },
      },
    } as CommunityRoomModel;
    expect(roomCanMaintain(denied)).toBe(false);
    expect(
      roomCanMaintain({
        ...denied,
        permissions: {
          ...denied.permissions!,
          maintain: { state: "enabled" },
        },
      }),
    ).toBe(true);
  });

  it("offers only maintainers and administrators as reviewers", () => {
    expect(
      reviewerCandidates([
        member("writer", { roles: ["writer"] }),
        member("admin", { administrator: true, name: "Admin" }),
        member("maint", { roles: ["maintainer"], name: "Maint" }),
      ]).map((candidate) => candidate.id),
    ).toEqual(["admin", "maint"]);
  });
});
