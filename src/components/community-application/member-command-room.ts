export function memberCommandTitle(
  mode: string,
  taskTitle: string | undefined,
  kind: string,
): string {
  if (mode === "select" && taskTitle) return `Assign ${taskTitle}`;
  if (mode === "select") return "New direct message";
  if (kind === "forum") return "Forum members";
  if (kind === "direct") return "Conversation members";
  return "Channel members";
}

export function resolveMemberCommandRoom<
  T extends { id: string; groupId?: string },
>(rooms: readonly T[], active: T, overrideId?: string): T {
  if (!overrideId) return active;
  return (
    rooms.find((room) => room.id === overrideId || room.groupId === overrideId) ??
    active
  );
}

export function memberCommandGroupIds(
  room: { kind: string; participantIds?: readonly string[] },
  members: readonly { id: string; role?: string }[],
): string[] {
  if (room.kind === "direct") return [...(room.participantIds ?? [])];
  return members
    .filter((member) => member.role !== undefined)
    .map((member) => member.id);
}
