import { describe, expect, it } from "vitest";
import {
  PERMISSION_DECISION_LABELS,
  permissionDecisionVariant,
  permissionInputCode,
} from "./permission-decision.js";

describe("permission decision presentation", () => {
  it("uses distinct variants and a destructive deny", () => {
    expect(permissionDecisionVariant("allow_once")).toBe("default");
    expect(permissionDecisionVariant("allow_always")).toBe("secondary");
    expect(permissionDecisionVariant("reject_once")).toBe("destructive");
    expect(permissionDecisionVariant("reject_always")).toBe("destructive");
    expect(permissionDecisionVariant("cancel")).toBe("outline");
    expect(PERMISSION_DECISION_LABELS.reject_once).toBe("Deny once");
  });

  it("pretty-prints JSON permission input", () => {
    expect(permissionInputCode({ command: "pnpm test" })).toBe(
      '{\n  "command": "pnpm test"\n}',
    );
    expect(
      permissionInputCode('{"command":"pnpm test","kind":"execute"}'),
    ).toBe('{\n  "command": "pnpm test",\n  "kind": "execute"\n}');
    expect(permissionInputCode(undefined)).toBeUndefined();
  });
});
