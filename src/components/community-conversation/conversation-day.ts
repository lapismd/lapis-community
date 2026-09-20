import type { CommunityMessageModel } from "../community-workspace/model.js";

export function communityMessageDay(message: CommunityMessageModel): string {
  if (message.createdAt === undefined) return "unknown";
  const date = new Date(message.createdAt);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function communityMessageStartsDay(
  entries: readonly CommunityMessageModel[],
  index: number,
): boolean {
  return (
    index === 0 ||
    communityMessageDay(entries[index - 1]!) !==
      communityMessageDay(entries[index]!)
  );
}

export function communityMessageDayLabel(
  message: CommunityMessageModel,
  now = new Date(),
): string {
  if (message.createdAt === undefined) return "Today";
  const date = new Date(message.createdAt);
  if (!Number.isFinite(date.getTime())) return "Today";
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.round(
    (todayStart.getTime() - dateStart.getTime()) / 86_400_000,
  );
  if (elapsedDays === 0) return "Today";
  if (elapsedDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}
