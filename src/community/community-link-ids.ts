export const COMMUNITY_HEX64 = /^[a-f0-9]{64}$/u;
export const COMMUNITY_COMMIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
export const COMMUNITY_CHANGE_ID = /^(?:[a-f0-9]{32}|[zyxwvutsrqponmlk]{32})$/u;
export const COMMUNITY_TAB = /^[a-z0-9-]+$/u;

export function trimLinkCandidate(value: string): string {
  return value.replace(/[),.;!?]+$/u, "");
}

export function validCommunityId(value: string): boolean {
  return validId(value);
}

export function decodeLinkSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function validId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1024 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function normalizeHex(
  value: string | null | undefined,
): string | undefined {
  const hex = value?.trim().toLowerCase();
  return hex && COMMUNITY_HEX64.test(hex) ? hex : undefined;
}

export function normalizeCommit(
  value: string | null | undefined,
): string | undefined {
  const hex = value?.trim().toLowerCase();
  return hex && COMMUNITY_COMMIT.test(hex) ? hex : undefined;
}

export function normalizeChange(
  value: string | null | undefined,
): string | undefined {
  const change = value?.trim().toLowerCase();
  return change && COMMUNITY_CHANGE_ID.test(change) ? change : undefined;
}

export function requireId(value: string, name: string): string {
  if (!validId(value)) throw new Error(`invalid ${name}`);
  return value;
}

export function requireHex64(value: string, name: string): string {
  const hex = normalizeHex(value);
  if (!hex) throw new Error(`invalid ${name}`);
  return hex;
}

export function requireCommit(value: string): string {
  const hex = normalizeCommit(value);
  if (!hex) throw new Error("invalid commit");
  return hex;
}

export function requireChange(value: string): string {
  const change = normalizeChange(value);
  if (!change) throw new Error("invalid change");
  return change;
}

export function normalizeBranch(
  value: string | null | undefined,
): string | undefined {
  if (!value || value.length > 512 || value.trim() !== value) return undefined;
  if (/[\u0000-\u001f\u007f]/u.test(value)) return undefined;
  return value;
}

export function requireBranch(value: string): string {
  const branch = normalizeBranch(value);
  if (!branch) throw new Error("invalid branch");
  return branch;
}
