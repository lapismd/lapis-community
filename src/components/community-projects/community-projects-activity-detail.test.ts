import { describe, expect, it } from "vitest";

import type { ProjectForgeActivityItem } from "../../projects/model.js";
import { activityDetailPresentation } from "./community-projects-activity-detail.js";

const coordinate = "30617:aa:notes";

function item(
  values: Partial<ProjectForgeActivityItem> &
    Pick<ProjectForgeActivityItem, "kind">,
): ProjectForgeActivityItem {
  return {
    id: values.id ?? values.kind,
    createdAt: 1,
    actorPubkey: "1".repeat(64),
    action: "acted in",
    title: "Title",
    body: "",
    projectCoordinate: coordinate,
    ...values,
  };
}

describe("activityDetailPresentation", () => {
  it("turns dest-Git hashes into History-style copy values", () => {
    expect(
      activityDetailPresentation(
        item({ kind: "commit", detail: "a".repeat(40) }),
      ),
    ).toEqual({
      kind: "hash",
      value: "a".repeat(40),
      copyLabel: "commit ID",
    });
    expect(
      activityDetailPresentation(
        item({ kind: "review-update", detail: "b".repeat(40) }),
      ),
    ).toMatchObject({ kind: "hash", value: "b".repeat(40) });
  });

  it("styles jj-sync labels as muted square chips with a sync icon", () => {
    expect(
      activityDetailPresentation(item({ kind: "commit", detail: "jj-sync" })),
    ).toEqual({
      kind: "chip",
      label: "jj-sync",
      tone: "neutral",
      variant: "muted",
      shape: "square",
      icon: "sync",
    });
  });

  it("keeps review and task states as pill status chips", () => {
    expect(
      activityDetailPresentation(item({ kind: "approval" })),
    ).toMatchObject({
      kind: "chip",
      label: "Approved",
      tone: "success",
      shape: "pill",
    });
    expect(
      activityDetailPresentation(item({ kind: "task", detail: "open" })),
    ).toMatchObject({
      kind: "chip",
      label: "Backlog",
      tone: "warning",
      shape: "pill",
    });
  });
});
