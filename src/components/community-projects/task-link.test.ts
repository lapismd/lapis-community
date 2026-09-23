import { describe, expect, it } from "vitest";

import { parseCommunityEntityLink } from "../../community/community-links.js";
import { locationForCommunityEntityLink } from "../community-application/application-location-hash.js";
import { communityTaskLink } from "./task-link.js";

const owner = "a".repeat(64);
const id = "b".repeat(64);
const coordinate = `30617:${owner}:lapis-community`;

describe("task links", () => {
  it("copies a task route that reopens that task", () => {
    const href = communityTaskLink(coordinate, id);
    expect(href).toBe(
      `lapis-community://task?owner=${owner}&d=lapis-community&id=${id}`,
    );
    expect(
      locationForCommunityEntityLink(parseCommunityEntityLink(href!)!),
    ).toMatchObject({
      projectRoute: {
        kind: "repository",
        coordinate,
        surface: "tasks",
        commitSha: id,
      },
    });
  });
});
