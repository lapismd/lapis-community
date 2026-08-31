export function parseRelayUrls(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => {
        try {
          const url = new URL(entry);
          return url.protocol === "ws:" || url.protocol === "wss:"
            ? url.toString()
            : undefined;
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is string => entry !== undefined)
      .filter((entry, index, entries) => entries.indexOf(entry) === index);
  } catch {
    return [];
  }
}

export function anyRelayPublished(
  results: readonly PromiseSettledResult<unknown>[],
): boolean {
  return results.some((result) => result.status === "fulfilled");
}
