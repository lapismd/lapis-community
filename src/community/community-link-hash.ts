export function extractCommunityHash(value: string): string | undefined {
  if (value.startsWith("#/")) return value;
  try {
    const url = new URL(value);
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hash.startsWith("#/")
    ) {
      return url.hash;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function decodeHashSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
