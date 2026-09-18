import type { ProjectForgeBranchProtection } from "./protected-refs.js";
import type { ProjectForgeRepositoryCapabilities } from "./model.js";
import {
  compileProtectedRefPatterns,
  normalizeProtectedPattern,
} from "./protected-refs.js";
import {
  normalizeProtectionRules,
  type ProjectForgeProtectionRule,
} from "./protection-ruleset.js";
import { repositoryForgePath } from "./repository-address.js";

export const MAX_DOCUMENT_PATTERNS = 16;
export const MAX_REQUIRED_APPROVALS = 16;
export const DEFAULT_REQUIRED_APPROVALS = 1;

export interface ProjectForgeProtectionDocumentInput {
  version?: number;
  rules?: ProjectForgeProtectionRule[];
  protected_patterns?: string[];
  required_approvals?: number;
  admin_bypass?: boolean;
}

export interface ProjectForgeProtectionDocumentResponse {
  repository: string;
  protection: ProjectForgeBranchProtection;
}

export function normalizeRequiredApprovals(value: number | undefined): number {
  if (!value || value < DEFAULT_REQUIRED_APPROVALS) {
    return DEFAULT_REQUIRED_APPROVALS;
  }
  if (value > MAX_REQUIRED_APPROVALS) return MAX_REQUIRED_APPROVALS;
  return Math.trunc(value);
}

export function normalizeProtectionDocumentInput(
  input: ProjectForgeProtectionDocumentInput,
): ProjectForgeProtectionDocumentInput {
  if (input.rules) {
    return { version: 1, rules: normalizeProtectionRules(input.rules) };
  }
  const patterns = compileProtectedRefPatterns(input.protected_patterns);
  if (patterns.length > MAX_DOCUMENT_PATTERNS) {
    throw new Error("Branch protection allows at most 16 extra patterns");
  }
  for (const raw of input.protected_patterns ?? []) {
    if (raw.trim() && !normalizeProtectedPattern(raw)) {
      throw new Error(`Invalid protected-ref pattern: ${raw}`);
    }
  }
  return {
    protected_patterns: patterns,
    required_approvals: normalizeRequiredApprovals(input.required_approvals),
    admin_bypass: input.admin_bypass === true,
  };
}

export async function putRepositoryProtection(
  request: (
    method: "PUT",
    path: string,
    value: ProjectForgeProtectionDocumentInput,
    signal?: AbortSignal,
  ) => Promise<ProjectForgeProtectionDocumentResponse>,
  repository: string,
  input: ProjectForgeProtectionDocumentInput,
  signal?: AbortSignal,
): Promise<ProjectForgeBranchProtection> {
  const response = await request(
    "PUT",
    repositoryForgePath(repository, "protection"),
    normalizeProtectionDocumentInput(input),
    signal,
  );
  if (response.repository !== repository) {
    throw new Error(
      "Repository protection response does not match the request",
    );
  }
  return response.protection;
}

export function applySavedProtection(
  current: Record<string, ProjectForgeRepositoryCapabilities>,
  repository: string,
  protection: ProjectForgeBranchProtection,
): Record<string, ProjectForgeRepositoryCapabilities> {
  const existing = current[repository];
  if (!existing) return current;
  return {
    ...current,
    [repository]: { ...existing, protection },
  };
}
