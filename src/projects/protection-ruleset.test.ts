import { describe, expect, it } from "vitest";

import {
  createProtectionRule,
  migrateLegacyProtectionRules,
  normalizeProtectionRules,
  rulesetBypassKindLabel,
  rulesetListSummary,
  rulesetMatches,
  rulesetTargetKindLabel,
} from "./protection-ruleset.js";

describe("protection rulesets", () => {
  it("migrates a legacy document to an Active Default rule", () => {
    expect(
      migrateLegacyProtectionRules({
        protected_patterns: ["refs/heads/release/*"],
        required_approvals: 2,
        admin_bypass: true,
      }),
    ).toEqual([
      {
        id: "default",
        name: "Default",
        enforcement: "active",
        targets: [
          { type: "default" },
          { type: "include", pattern: "refs/heads/release/*" },
        ],
        bypass: [{ kind: "admin" }],
        restrict_creations: false,
        restrict_updates: true,
        restrict_deletions: true,
        required_approvals: 2,
      },
    ]);
  });

  it("normalizes include/exclude targets and names ids", () => {
    const [rule] = normalizeProtectionRules([
      {
        ...createProtectionRule("Release"),
        targets: [
          { type: "include", pattern: "releases/**" },
          { type: "exclude", pattern: "releases/legacy" },
        ],
        restrict_deletions: true,
      },
    ]);
    expect(rule?.id).toBe("release");
    expect(rule?.targets[0]?.pattern).toBe("refs/heads/releases/**");
    expect(rulesetListSummary(rule!)).toBe(
      "1 branch rule • targeting 1 branch",
    );
    expect(
      rulesetMatches(rule!, "refs/heads/releases/1.0", "refs/heads/main"),
    ).toBe(true);
    expect(
      rulesetMatches(rule!, "refs/heads/releases/legacy", "refs/heads/main"),
    ).toBe(false);
    expect(rulesetTargetKindLabel({ type: "include", pattern: "x" })).toBe(
      "Include",
    );
    expect(rulesetTargetKindLabel({ type: "exclude", pattern: "x" })).toBe(
      "Exclude",
    );
    expect(rulesetBypassKindLabel({ kind: "admin" })).toBe("Admin");
  });
});
