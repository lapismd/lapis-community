import type { ProjectForgeActivityItem } from "../../projects/model.js";
import type {
  CommunityChipShape,
  CommunityChipTone,
  CommunityChipVariant,
} from "../community-chip/model.js";

const ACTIVITY_HASH = /^[0-9a-f]{7,128}$/iu;

export type ActivityDetailPresentation =
  | { kind: "none" }
  | { kind: "hash"; value: string; copyLabel: string }
  | {
      kind: "chip";
      label: string;
      tone: CommunityChipTone;
      variant: CommunityChipVariant;
      shape: CommunityChipShape;
      icon?: "sync";
    };

function activityStatusLabel(value: string): string {
  if (value === "open") return "Backlog";
  if (value === "applied" || value === "closed") return "Completed";
  return value[0]!.toUpperCase() + value.slice(1);
}

export function isActivityHashDetail(value: string): boolean {
  return ACTIVITY_HASH.test(value);
}

export function activityDetailPresentation(
  item: ProjectForgeActivityItem,
): ActivityDetailPresentation {
  if (item.kind === "approval") {
    return chip("Approved", "success");
  }
  if (item.kind === "changes-requested") {
    return chip("Changes requested", "warning");
  }
  if (!item.detail) return { kind: "none" };
  if (item.kind === "task")
    return chip(activityStatusLabel(item.detail), "warning");
  if (item.kind === "review") {
    return chip(
      item.detail[0]!.toUpperCase() + item.detail.slice(1),
      "success",
    );
  }
  if (item.kind === "commit" || item.kind === "review-update") {
    if (isActivityHashDetail(item.detail)) {
      return { kind: "hash", value: item.detail, copyLabel: "commit ID" };
    }
    return {
      kind: "chip",
      label: item.detail,
      tone: "neutral",
      variant: "muted",
      shape: "square",
      ...(item.detail === "jj-sync" ? { icon: "sync" as const } : {}),
    };
  }
  return { kind: "none" };
}

function chip(
  label: string,
  tone: CommunityChipTone,
): Extract<ActivityDetailPresentation, { kind: "chip" }> {
  return {
    kind: "chip",
    label,
    tone,
    variant: "outline",
    shape: "pill",
  };
}
