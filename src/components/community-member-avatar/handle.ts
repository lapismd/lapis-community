export function communityMemberHandleLabel(handle: string): string {
  const normalized = handle.trim().replace(/^@+/u, "");
  return normalized ? `@${normalized}` : "";
}
