import { describe, expect, it } from "vitest";

import { parseOwnersDocument } from "../../projects/owners.js";
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
          pull_requests_required: true,
          merge_actors: "channel_maintainers",
        },
      } as never).protectedRef,
    ).toBe("refs/heads/main");
    expect(
      ownersSummary(parseOwnersDocument(`docs/ ${"a".repeat(64)}\n`)),
    ).toContain("docs/");
    expect(ownersFileHelp()).toMatch(/pull request/i);
    expect(peopleChannelAction("dev")).toBe("Open #dev to manage People");
  });
});
