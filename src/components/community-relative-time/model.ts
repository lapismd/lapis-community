export interface CommunityRelativeTimeOptions {
  now?: number;
  absoluteAfterDays?: number;
  locale?: Intl.LocalesArgument;
}

export function formatCommunityFullDate(
  timestamp: number,
  locale?: Intl.LocalesArgument,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp * 1_000);
}

export function formatCommunityRelativeTime(
  timestamp: number,
  options: CommunityRelativeTimeOptions = {},
): string {
  const now = options.now ?? Math.floor(Date.now() / 1_000);
  const elapsedSeconds = Math.max(0, now - timestamp);
  if (elapsedSeconds < 60) return "just now";
  const relative = new Intl.RelativeTimeFormat(options.locale, {
    numeric: "auto",
    style: "long",
  });
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (
    options.absoluteAfterDays !== undefined &&
    days >= options.absoluteAfterDays
  ) {
    return new Intl.DateTimeFormat(options.locale, {
      dateStyle: "medium",
    }).format(timestamp * 1_000);
  }
  if (days < 7) return relative.format(-days, "day");
  const weeks = Math.floor(days / 7);
  if (days < 30) return relative.format(-weeks, "week");
  const months = Math.floor(days / 30);
  if (days < 365) return relative.format(-months, "month");
  const years = Math.floor(days / 365);
  return relative.format(-years, "year");
}
