import { describe, expect, it } from "vitest";

import { revisionGraphCopiedValue } from "./revision-graph-copy-link.js";

const owner = "ab".repeat(32);
const coordinate = `30617:${owner}:probe`;
const hash = `#/projects/repository/${coordinate}/log`;
const change = "nm".repeat(16);

describe("revision graph copy links", () => {
  it("copies a change id as a log link", () => {
    expect(
      revisionGraphCopiedValue({
        label: "change ID",
        value: change,
        hash,
      }),
    ).toBe(
      `lapis-community://repo?owner=${owner}&d=probe&tab=log&change=${change}`,
    );
  });

  it("copies a log commit id on the log tab and a git sha on commits", () => {
    const eventId = "ef".repeat(32);
    expect(
      revisionGraphCopiedValue({
        label: "commit ID",
        value: eventId,
        hash,
      }),
    ).toContain(`tab=log&commit=${eventId}`);
    expect(
      revisionGraphCopiedValue({
        coordinate,
        label: "commit ID",
        value: "a".repeat(40),
        hash: `#/projects/repository/${coordinate}/main/files`,
      }),
    ).toContain("tab=commits&commit=" + "a".repeat(40));
  });

  it("copies operation and replica ids on the oplog tab", () => {
    expect(
      revisionGraphCopiedValue({
        coordinate,
        label: "operation ID",
        value: "3".repeat(128),
        hash: "#/projects/project/30621:aa:notes/activity",
      }),
    ).toContain(`tab=oplog&id=${"3".repeat(128)}`);
    expect(
      revisionGraphCopiedValue({
        coordinate,
        label: "replica ID",
        value: "019d0000-0000-7000-8000-000000000002",
      }),
    ).toContain("tab=oplog&id=019d0000-0000-7000-8000-000000000002");
  });
});
