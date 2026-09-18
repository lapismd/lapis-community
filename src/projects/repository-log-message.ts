export type RepositoryLogMessagePart =
  | { type: "text"; value: string }
  | { type: "commit"; value: string }
  | { type: "change"; value: string };

const IDENTITY = /\b(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{32})\b/gu;

export function parseRepositoryLogMessage(
  message: string,
): RepositoryLogMessagePart[] {
  const parts: RepositoryLogMessagePart[] = [];
  let last = 0;
  for (const match of message.matchAll(IDENTITY)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ type: "text", value: message.slice(last, start) });
    }
    const value = match[0].toLowerCase();
    parts.push({
      type: value.length === 40 ? "commit" : "change",
      value,
    });
    last = start + match[0].length;
  }
  if (last < message.length) {
    parts.push({ type: "text", value: message.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: message }];
}
