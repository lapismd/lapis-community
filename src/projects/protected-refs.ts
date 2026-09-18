export interface ProjectForgeBranchProtection {
  default_branch?: string;
  protected_ref?: string;
  protected_patterns?: string[];
  pull_requests_required?: boolean;
  merge_actors?: string;
  github_authoritative?: boolean;
}

const MAX_PATTERN_LENGTH = 256;
const DEFAULT_BOOTSTRAP_REF = "refs/heads/main";
const JJ_SYNC_PREFIX = "refs/heads/jj-sync/";

export function normalizeRefName(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed || trimmed === "HEAD") return DEFAULT_BOOTSTRAP_REF;
  if (trimmed.startsWith("refs/")) return trimmed;
  return `refs/heads/${trimmed.replace(/^heads\//u, "")}`;
}

export function normalizeProtectedPattern(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_PATTERN_LENGTH ||
    trimmed.includes("**")
  ) {
    return undefined;
  }
  const normalized = normalizeRefName(trimmed);
  const wildcard = normalized.endsWith("/*");
  const prefix = wildcard ? normalized.slice(0, -2) : normalized;
  if (
    prefix === "refs/heads" ||
    !prefix.startsWith("refs/heads/") ||
    prefix.includes("*")
  ) {
    return undefined;
  }
  if (prefix === "refs/heads/jj-sync" || prefix.startsWith(JJ_SYNC_PREFIX)) {
    return undefined;
  }
  return normalized;
}

export function compileProtectedRefPatterns(
  raw: readonly string[] | undefined,
): string[] {
  const seen = new Set<string>();
  const patterns: string[] = [];
  for (const value of raw ?? []) {
    const compiled = normalizeProtectedPattern(value);
    if (!compiled || seen.has(compiled)) continue;
    seen.add(compiled);
    patterns.push(compiled);
  }
  return patterns.toSorted();
}

export function protectedRefPatternsHelp(): string {
  return "Extra patterns come from protected-ref tags on the repository announcement. They cannot disable the default branch.";
}
