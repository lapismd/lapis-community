import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { collaborationAuthorityFromGroupState } from "./authority.js";

function event(
  kind: number,
  pubkey: string,
  createdAt: number,
  tags: string[][],
): NostrEvent {
  return {
    id: `${kind}${createdAt}`.padEnd(64, "0"),
    kind,
    pubkey,
    created_at: createdAt,
    tags,
    content: "",
    sig: "f".repeat(128),
  };
}

const creator = "1".repeat(64);
const admin = "2".repeat(64);
const maintainer = "3".repeat(64);
const writer = "4".repeat(64);

describe("collaborationAuthorityFromGroupState", () => {
  it("trusts the creator, 39001 admins, and 39002 maintainers", () => {
    const authority = collaborationAuthorityFromGroupState(
      [
        event(39_000, creator, 1, [["d", "dev"]]),
        event(39_001, creator, 1, [
          ["d", "dev"],
          ["p", admin],
        ]),
        event(39_002, creator, 1, [
          ["d", "dev"],
          ["p", maintainer, "maintainer"],
          ["p", writer, "writer"],
        ]),
      ],
      "dev",
    );
    expect(authority.canMaintain(creator)).toBe(true);
    expect(authority.canMaintain(admin)).toBe(true);
    expect(authority.canMaintain(maintainer)).toBe(true);
    expect(authority.canMaintain(writer)).toBe(false);
  });
});
