import { describe, expect, it } from "vitest";
import { presentAgentActivity } from "./model.js";
import {
  storyActivity,
  storyActivityItems,
} from "../community-agents/story-fixtures.js";
describe("agent activity presentation", () => {
  it("recognizes Buzz ACP messages, tools, plans, lifecycle, and errors", () => {
    expect(
      storyActivityItems.map((item) => presentAgentActivity(item).category),
    ).toEqual([
      "Status",
      "Event",
      "Error",
      "Plan",
      "Tool",
      "Message",
      "Status",
    ]);
  });
  it("keeps unknown payloads bounded, literal, and safe for custom sources", () => {
    expect(
      presentAgentActivity(storyActivity("new_event", undefined)).body,
    ).toBe("{}");
    expect(
      presentAgentActivity(
        storyActivity("new_event", { text: "<script>alert(1)</script>" }),
      ).body,
    ).toContain("<script>");
    expect(
      presentAgentActivity(
        storyActivity("new_event", { text: "a".repeat(100000) }),
      ).body.length,
    ).toBeLessThanOrEqual(12000);
  });
});
