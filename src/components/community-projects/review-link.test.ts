import { describe, expect, it } from "vitest";

import { parseCommunityEntityLink } from "../../community/community-links.js";
import { locationForCommunityEntityLink } from "../community-application/application-location-hash.js";
import {
  projectRouteFromHash,
  projectRouteToHash,
} from "../community-application/project-route.js";
import { communityReviewLink } from "./review-link.js";

const owner = "a".repeat(64);
const id = "b".repeat(64);
const coordinate = `30617:${owner}:lapis-community`;

describe("review links", () => {
  it("copies a reviews route that reopens that pull request", () => {
    const href = communityReviewLink(coordinate, id);
    expect(href).toBe(
      `lapis-community://repo?owner=${owner}&d=lapis-community&tab=reviews&commit=${id}`,
    );
    const route = {
      kind: "repository" as const,
      coordinate,
      surface: "reviews" as const,
      commitSha: id,
    };
    expect(projectRouteFromHash(projectRouteToHash(route))).toEqual(route);
    expect(
      locationForCommunityEntityLink(parseCommunityEntityLink(href!)!),
    ).toMatchObject({ projectRoute: route });
  });
});
