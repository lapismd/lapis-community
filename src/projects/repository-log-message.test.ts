import { describe, expect, it } from "vitest";

import { parseRepositoryLogMessage } from "./repository-log-message.js";

const commit = "d".repeat(40);
const change = "4".repeat(32);

describe("parseRepositoryLogMessage", () => {
  it("keeps plain descriptions as a single text part", () => {
    expect(parseRepositoryLogMessage("snapshot working copy")).toEqual([
      { type: "text", value: "snapshot working copy" },
    ]);
  });

  it("splits a commit SHA and a change hex out of the description", () => {
    expect(
      parseRepositoryLogMessage(`commit ${commit} for change ${change}`),
    ).toEqual([
      { type: "text", value: "commit " },
      { type: "commit", value: commit },
      { type: "text", value: " for change " },
      { type: "change", value: change },
    ]);
  });

  it("does not treat a 40-digit SHA as a 32-digit change hex", () => {
    const parts = parseRepositoryLogMessage(commit);
    expect(parts).toEqual([{ type: "commit", value: commit }]);
  });
});
