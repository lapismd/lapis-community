export interface CommunityProjectsVirtualEstimateInput {
  kind:
    | "activity"
    | "task"
    | "review"
    | "commit"
    | "repository-log"
    | "group"
    | "status";
  text?: string | undefined;
  detail?: string | undefined;
  hasBody?: boolean | undefined;
  hasSupplement?: boolean | undefined;
  selected?: boolean | undefined;
}

const BASE_ROW_ESTIMATES: Record<
  CommunityProjectsVirtualEstimateInput["kind"],
  number
> = {
  activity: 136,
  task: 58,
  review: 62,
  commit: 54,
  "repository-log": 40,
  group: 48,
  status: 56,
};

export function estimateCommunityProjectRow(
  row: CommunityProjectsVirtualEstimateInput | undefined,
): number {
  if (!row) return 64;
  let estimate = BASE_ROW_ESTIMATES[row.kind] ?? 64;
  const textLength = `${row.text ?? ""} ${row.detail ?? ""}`.trim().length;
  if (textLength > 120) estimate += Math.ceil((textLength - 120) / 80) * 20;
  if (row.hasBody) estimate += 56;
  if (row.hasSupplement) estimate += 72;
  if (row.selected) estimate += row.kind === "repository-log" ? 180 : 48;
  return Math.min(Math.max(estimate, 36), 420);
}
