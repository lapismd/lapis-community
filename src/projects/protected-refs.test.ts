import { describe, expect, it } from "vitest";

import {
  compileProtectedRefPatterns,
  normalizeProtectedPattern,
} from "./protected-refs.js";

describe("protected-ref patterns", () => {
  it("compiles release globs and ignores overly broad or jj-sync values", () => {
    expect(normalizeProtectedPattern("release/*")).toBe("refs/heads/release/*");
    expect(
      compileProtectedRefPatterns(["release/*", "*", "jj-sync/*", "release/*"]),
    ).toEqual(["refs/heads/release/*"]);
  });
});
