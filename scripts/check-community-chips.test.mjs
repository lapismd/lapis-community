import { describe, expect, it } from "vitest";

import {
  inspectCommunityChipUsage,
  inspectRepository,
} from "./check-community-chips.mjs";

describe("Community chip policy", () => {
  it("accepts the shared component and its Design Core implementation", () => {
    expect(
      inspectCommunityChipUsage(`
        <script>
          import CommunityChip from "../community-chip/CommunityChip.svelte";
        </script>
        <CommunityChip tone="success">Approved</CommunityChip>
      `),
    ).toEqual([]);
    expect(
      inspectCommunityChipUsage(
        `
          <script>
            import { Badge } from "@lapismd/design-core/shadcn/badge";
          </script>
          <Badge variant="outline">Approved</Badge>
          <style>.community-chip { border-radius: 999px; }</style>
        `,
        "src/components/community-chip/CommunityChip.svelte",
      ),
    ).toEqual([]);
  });

  it("rejects direct Badge use outside CommunityChip", () => {
    const findings = inspectCommunityChipUsage(`
      <script>
        import { Badge } from "@lapismd/design-core/shadcn/badge";
      </script>
      <Badge variant="outline">Approved</Badge>
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("shared CommunityChip");
  });

  it("rejects native chip markup and forged badge hooks", () => {
    const findings = inspectCommunityChipUsage(`
      <span class="release-status-chip">Approved</span>
      <span data-ui-component="badge">Pending</span>
    `);
    expect(findings.map(({ message }) => message)).toEqual([
      "Chip-like native markup must use the shared CommunityChip component.",
      'Do not spoof data-ui-component="badge"; render CommunityChip.',
    ]);
  });

  it("rejects consumer chip appearance overrides", () => {
    const findings = inspectCommunityChipUsage(
      `
        .release-state-chip { border-radius: 999px; }
        [data-ui-part="community-chip"] { font-size: 1rem; }
      `,
      "chips.css",
    );
    expect(findings).toHaveLength(2);
    expect(
      findings.every(({ message }) => message.includes("CommunityChip")),
    ).toBe(true);
  });

  it("allows contextual chip positioning", () => {
    expect(
      inspectCommunityChipUsage(
        `[data-ui-part="community-chip"] { margin-inline-start: auto; }`,
        "layout.css",
      ),
    ).toEqual([]);
  });

  it("keeps current Community components compliant", () => {
    expect(inspectRepository()).toEqual([]);
  });
});
