import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMMUNITY_DEV_PORT,
  resolveCommunityDevLane,
} from "./community-dev-process.mjs";

describe("Community Vite process ownership", () => {
  it("uses a checkout-local owner record on the dedicated development port", () => {
    const lane = resolveCommunityDevLane({ root: process.cwd(), env: {} });

    expect(lane.port).toBe(DEFAULT_COMMUNITY_DEV_PORT);
    expect(lane.ownerPath).toBe(
      `${lane.root}/.cache/community-dev/${DEFAULT_COMMUNITY_DEV_PORT}.json`,
    );
  });

  it("validates an explicit development port", () => {
    expect(
      resolveCommunityDevLane({
        root: process.cwd(),
        env: { COMMUNITY_DEV_PORT: "7136" },
      }).port,
    ).toBe("7136");
    expect(() =>
      resolveCommunityDevLane({
        root: process.cwd(),
        env: { COMMUNITY_DEV_PORT: "invalid" },
      }),
    ).toThrow("Invalid STORYBOOK_PORT");
  });
});
