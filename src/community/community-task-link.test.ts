import { describe, expect, it } from "vitest";

import { communityEntityLinkPresentation } from "./community-link-normalize.js";
import {
  buildCommunityTaskLink,
  communityEntityLinkHref,
  communityRepositoryCoordinate,
  parseCommunityEntityLink,
} from "./community-links.js";
import { entityLinkFromApplicationHash } from "./community-link-normalize.js";

const owner =
  "71d67180ba17e749ee825fc8819c9c6ee7003617e1c126504f9b658070ab9224";
const id = "c3b589fa5713ba25bad6dc095e2de00a4ac8f50050fdea00fc6444e603be1dd1";

describe("community task entity links", () => {
  it("builds, parses, and hashes a task URI", () => {
    const href = buildCommunityTaskLink({ owner, d: "buzz-world", id });
    expect(href).toBe(
      `lapis-community://task?owner=${owner}&d=buzz-world&id=${id}`,
    );
    const parsed = parseCommunityEntityLink(href);
    expect(parsed).toEqual({ kind: "task", owner, d: "buzz-world", id });
    expect(communityEntityLinkHref(parsed!)).toBe(href);
    expect(communityEntityLinkPresentation(parsed!)).toMatchObject({
      linkKind: "task",
      icon: "circle-dot",
    });
    expect(
      entityLinkFromApplicationHash(
        `#/projects/repository/${communityRepositoryCoordinate(owner, "buzz-world")}/tasks/${id}`,
      ),
    ).toEqual({ kind: "task", owner, d: "buzz-world", id });
  });
});
