import { describe, expect, it } from "vitest";
import type { CommunityMessageModel } from "../community-workspace/model.js";
import { projectThreadTree } from "./thread-tree-layout.js";

const message = (
  id: string,
  parentMessageId?: string,
): CommunityMessageModel => ({
  id,
  authorId: id,
  content: id,
  timestamp: id,
  ...(parentMessageId ? { parentMessageId } : {}),
});

describe("projectThreadTree", () => {
  it("places a nested branch directly after its parent with one indent per depth", () => {
    const layout = projectThreadTree(
      [
        message("root"),
        message("parent", "root"),
        message("later-direct", "root"),
        message("nested", "parent"),
        message("deep", "nested"),
      ],
      "root",
    );

    expect(layout.messages.map(({ id }) => id)).toEqual([
      "root",
      "parent",
      "nested",
      "deep",
      "later-direct",
    ]);
    expect(
      layout.messages.map(({ id }) => layout.rowsById.get(id)?.depth),
    ).toEqual([0, 1, 2, 3, 1]);
    expect(layout.rowsById.get("root")?.indentRem).toBe(0);
    expect(layout.rowsById.get("parent")?.indentRem).toBe(0);
    expect(layout.rowsById.get("nested")?.indentRem).toBe(2.25);
    expect(layout.rowsById.get("deep")?.indentRem).toBe(4.5);
  });

  it("keeps a parent rail continuous across sibling replies", () => {
    const layout = projectThreadTree(
      [
        message("root"),
        message("parent", "root"),
        message("first", "parent"),
        message("second", "parent"),
      ],
      "root",
    );

    expect(layout.rowsById.get("parent")?.connectsToChildren).toBe(true);
    expect(layout.rowsById.get("first")?.guideIndentRems).toEqual([0]);
    expect(layout.rowsById.get("second")?.guideIndentRems).toEqual([]);
    expect(layout.rowsById.get("first")?.connectorIndentRem).toBe(0);
  });
});
