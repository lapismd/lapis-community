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
  const absoluteAfterDays = options.absoluteAfterDays ?? 7;
  const elapsedSeconds = Math.max(0, now - timestamp);
  if (elapsedSeconds < 60) return "just now";

  const relative = new Intl.RelativeTimeFormat(options.locale, {
    numeric: "auto",
    style: "long",
  });
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return relative.format(-elapsedMinutes, "minute");

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return relative.format(-elapsedHours, "hour");

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < absoluteAfterDays) {
    return relative.format(-elapsedDays, "day");
  }
  return formatCommunityFullDate(timestamp, options.locale);
}
