import { describe, expect, it } from "vitest";

import { communityRepositoryCoordinate } from "../../community/community-links.js";
import { locationForCommunityEntityLink } from "./application-location-hash.js";

const owner = "d".repeat(64);
const id = "c".repeat(64);

describe("application task location", () => {
  it("opens a task chip on the repository tasks hash", () => {
    expect(
      locationForCommunityEntityLink({
        kind: "task",
        owner,
        d: "buzz-world",
        id,
      }).projectRoute,
    ).toEqual({
      kind: "repository",
      coordinate: communityRepositoryCoordinate(owner, "buzz-world"),
      surface: "tasks",
      commitSha: id,
    });
  });
});
