import { describe, expect, it } from "vitest";

import { parseOwnersDocument } from "../../projects/owners.js";
import { protectedRefPatternsHelp } from "../../projects/protected-refs.js";
import {
  ownersFileHelp,
  ownersSummary,
  peopleChannelAction,
  repositoryProtectionSummary,
} from "./community-projects-settings.js";

describe("repository settings projection", () => {
  it("explains hosted protection and OWNERS.md path reviewers", () => {
    expect(
      repositoryProtectionSummary({
        merge: true,
        protection: {
          default_branch: "main",
          protected_ref: "refs/heads/main",
          protected_patterns: ["release/*"],
          pull_requests_required: true,
          merge_actors: "channel_maintainers",
        },
      } as never),
    ).toMatchObject({
      protectedRef: "refs/heads/main",
      protectedPatterns: ["refs/heads/release/*"],
    });
    expect(protectedRefPatternsHelp()).toMatch(/cannot disable the default/u);
    expect(
      ownersSummary(parseOwnersDocument(`docs/ ${"a".repeat(64)}\n`)),
    ).toContain("docs/");
    expect(ownersFileHelp()).toMatch(/pull request/i);
    expect(peopleChannelAction("dev")).toBe("Open #dev to manage People");
  });
});
