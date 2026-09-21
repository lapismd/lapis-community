export type CommunityAgentPlanStatus = "pending" | "in_progress" | "completed";

export type CommunityAgentPlanEntry = {
  content: string;
  status?: CommunityAgentPlanStatus;
  priority?: string;
};

export type CommunityAgentPlanTranscript = {
  id: string;
  type: "plan";
  entries: readonly CommunityAgentPlanEntry[];
  createdAt: string;
  sequence?: number;
};

const PLAN_STATUSES = new Set<CommunityAgentPlanStatus>([
  "pending",
  "in_progress",
  "completed",
]);

export function parsePlanEntries(value: unknown): CommunityAgentPlanEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const content =
      typeof record.content === "string" ? record.content.trim() : "";
    if (!content) return [];
    const status =
      typeof record.status === "string" && PLAN_STATUSES.has(record.status)
        ? record.status
        : undefined;
    const priority =
      typeof record.priority === "string" && record.priority
        ? record.priority
        : undefined;
    return [
      {
        content,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
      },
    ];
  });
}

export function planEntriesFromRecord(
  value: Record<string, unknown>,
): CommunityAgentPlanEntry[] {
  return parsePlanEntries(value.entries ?? value.plan_entries);
}

export function planStatusLabel(
  status: CommunityAgentPlanStatus | undefined,
): string {
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return "Pending";
}
