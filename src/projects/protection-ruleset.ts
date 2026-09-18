import {
  normalizeRefName,
  normalizeRulesetPattern,
} from "./protected-refs.js";

const MAX_RULESET_TARGETS = 16;
const MAX_REQUIRED_APPROVALS = 16;

export const MAX_PROTECTION_RULES = 16;
export const DEFAULT_RULESET_ID = "default";
export const DEFAULT_RULESET_NAME = "Default";

export type RulesetEnforcement = "active" | "disabled";
export type RulesetTargetType = "default" | "all" | "include" | "exclude";
export type RulesetBypassKind = "admin" | "maintainer" | "member";

export interface ProjectForgeRulesetTarget {
  type: RulesetTargetType;
  pattern?: string;
}

export interface ProjectForgeRulesetBypass {
  kind: RulesetBypassKind;
  pubkey?: string;
}

export interface ProjectForgeProtectionRule {
  id: string;
  name: string;
  enforcement: RulesetEnforcement;
  targets: ProjectForgeRulesetTarget[];
  bypass: ProjectForgeRulesetBypass[];
  restrict_creations: boolean;
  restrict_updates: boolean;
  restrict_deletions: boolean;
  required_approvals: number;
}

export function rulesetsFromProtection(
  protection:
    | {
        rules?: ProjectForgeProtectionRule[];
        document_patterns?: string[];
        required_approvals?: number;
        admin_bypass?: boolean;
      }
    | undefined,
): ProjectForgeProtectionRule[] {
  if (protection?.rules) {
    try {
      return normalizeProtectionRules(protection.rules);
    } catch {
      return [];
    }
  }
  if (!protection) return [];
  return migrateLegacyProtectionRules({
    protected_patterns: protection.document_patterns,
    required_approvals: protection.required_approvals,
    admin_bypass: protection.admin_bypass,
  });
}

export function createProtectionRule(
  name = "New branch ruleset",
): ProjectForgeProtectionRule {
  return {
    id: "",
    name,
    enforcement: "active",
    targets: [{ type: "default" }],
    bypass: [],
    restrict_creations: false,
    restrict_updates: false,
    restrict_deletions: false,
    required_approvals: 1,
  };
}

export function migrateLegacyProtectionRules(input: {
  protected_patterns?: readonly string[] | undefined;
  required_approvals?: number | undefined;
  admin_bypass?: boolean | undefined;
}): ProjectForgeProtectionRule[] {
  const targets: ProjectForgeRulesetTarget[] = [{ type: "default" }];
  for (const raw of input.protected_patterns ?? []) {
    const pattern = normalizeRulesetPattern(raw);
    if (pattern) targets.push({ type: "include", pattern });
  }
  return [
    {
      id: DEFAULT_RULESET_ID,
      name: DEFAULT_RULESET_NAME,
      enforcement: "active",
      targets,
      bypass: input.admin_bypass === true ? [{ kind: "admin" }] : [],
      restrict_creations: false,
      restrict_updates: true,
      restrict_deletions: true,
      required_approvals: clampApprovals(input.required_approvals),
    },
  ];
}

export function normalizeProtectionRules(
  rules: readonly ProjectForgeProtectionRule[],
): ProjectForgeProtectionRule[] {
  if (rules.length > MAX_PROTECTION_RULES) {
    throw new Error("Branch protection allows at most 16 rulesets");
  }
  const seen = new Set<string>();
  return rules.map((rule, index) => {
    const normalized = normalizeProtectionRule(rule, index, seen);
    seen.add(normalized.id);
    return normalized;
  });
}

function normalizeProtectionRule(
  rule: ProjectForgeProtectionRule,
  index: number,
  seen: Set<string>,
): ProjectForgeProtectionRule {
  const name = rule.name.trim();
  if (!name || name.length > 64) {
    throw new Error("Each ruleset needs a name of at most 64 characters");
  }
  const enforcement =
    rule.enforcement === "disabled" ? "disabled" : "active";
  const id = allocateRuleId(rule.id, name, index, seen);
  return {
    id,
    name,
    enforcement,
    targets: normalizeTargets(rule.targets),
    bypass: normalizeBypass(rule.bypass),
    restrict_creations: rule.restrict_creations === true,
    restrict_updates: rule.restrict_updates === true,
    restrict_deletions: rule.restrict_deletions === true,
    required_approvals: clampApprovals(rule.required_approvals),
  };
}

function normalizeTargets(
  targets: readonly ProjectForgeRulesetTarget[] | undefined,
): ProjectForgeRulesetTarget[] {
  if ((targets?.length ?? 0) > MAX_RULESET_TARGETS) {
    throw new Error("A ruleset allows at most 16 targets");
  }
  const seen = new Set<string>();
  const normalized: ProjectForgeRulesetTarget[] = [];
  for (const target of targets ?? []) {
    const item = normalizeTarget(target);
    const key = `${item.type}:${item.pattern ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }
  return normalized;
}

function normalizeTarget(
  target: ProjectForgeRulesetTarget,
): ProjectForgeRulesetTarget {
  if (target.type === "default" || target.type === "all") {
    return { type: target.type };
  }
  if (target.type === "include" || target.type === "exclude") {
    const pattern = normalizeRulesetPattern(target.pattern ?? "");
    if (!pattern) {
      throw new Error(`Invalid ruleset pattern: ${target.pattern ?? ""}`);
    }
    return { type: target.type, pattern };
  }
  throw new Error("Unknown ruleset target");
}

function normalizeBypass(
  actors: readonly ProjectForgeRulesetBypass[] | undefined,
): ProjectForgeRulesetBypass[] {
  if ((actors?.length ?? 0) > MAX_RULESET_TARGETS) {
    throw new Error("A ruleset allows at most 16 bypass actors");
  }
  const seen = new Set<string>();
  const normalized: ProjectForgeRulesetBypass[] = [];
  for (const actor of actors ?? []) {
    const item = normalizeBypassActor(actor);
    const key = `${item.kind}:${item.pubkey ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }
  return normalized;
}

function normalizeBypassActor(
  actor: ProjectForgeRulesetBypass,
): ProjectForgeRulesetBypass {
  if (actor.kind === "admin" || actor.kind === "maintainer") {
    return { kind: actor.kind };
  }
  if (actor.kind === "member") {
    const pubkey = (actor.pubkey ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/u.test(pubkey)) {
      throw new Error("Bypass members need a 64-character hex public key");
    }
    return { kind: "member", pubkey };
  }
  throw new Error("Unknown bypass actor");
}

function allocateRuleId(
  raw: string | undefined,
  name: string,
  index: number,
  seen: Set<string>,
): string {
  const requested = raw?.trim();
  if (requested && !seen.has(requested)) return requested;
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "rule";
  let id = seen.has(base) ? `${base}-${index + 1}` : base;
  for (let n = 2; seen.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

export function rulesetTargetLabel(target: ProjectForgeRulesetTarget): string {
  if (target.type === "default") return "Default";
  if (target.type === "all") return "All branches";
  return target.pattern ?? "";
}

export function rulesetBypassLabel(actor: ProjectForgeRulesetBypass): string {
  if (actor.kind === "admin") return "Channel creator / relay admin";
  if (actor.kind === "maintainer") return "Maintainer";
  return actor.pubkey ?? "Member";
}

export function rulesetBypassKindLabel(actor: ProjectForgeRulesetBypass): string {
  if (actor.kind === "admin") return "Admin";
  if (actor.kind === "maintainer") return "Maintainer";
  return "Member";
}

export function rulesetTargetKindLabel(target: ProjectForgeRulesetTarget): string {
  return target.type === "exclude" ? "Exclude" : "Include";
}

export function rulesetListSummary(rule: ProjectForgeProtectionRule): string {
  const count = [
    rule.restrict_creations,
    rule.restrict_updates,
    rule.restrict_deletions,
  ].filter(Boolean).length;
  return `${count} branch rule${count === 1 ? "" : "s"} • targeting ${targetCountLabel(rule.targets)}`;
}

function targetCountLabel(
  targets: readonly ProjectForgeRulesetTarget[],
): string {
  if (targets.some((target) => target.type === "all")) return "all branches";
  const included = targets.filter((target) => target.type !== "exclude");
  if (included.length === 1 && included[0]?.type === "default") {
    return "default branch";
  }
  return `${included.length || 0} branch${included.length === 1 ? "" : "es"}`;
}

export function rulesetMatches(
  rule: ProjectForgeProtectionRule,
  ref: string,
  defaultRef: string,
): boolean {
  if (rule.enforcement !== "active") return false;
  const normalized = normalizeRefName(ref);
  let included = false;
  let excluded = false;
  for (const target of rule.targets) {
    if (target.type === "default" && normalized === normalizeRefName(defaultRef)) {
      included = true;
    }
    if (target.type === "all") included = true;
    if (
      (target.type === "include" || target.type === "exclude") &&
      target.pattern &&
      normalizeRulesetPattern(target.pattern) &&
      matchesRulesetGlob(target.pattern, normalized)
    ) {
      if (target.type === "include") included = true;
      else excluded = true;
    }
  }
  return included && !excluded;
}

function clampApprovals(value: number | undefined): number {
  if (!value || value < 1) return 1;
  if (value > MAX_REQUIRED_APPROVALS) return MAX_REQUIRED_APPROVALS;
  return Math.trunc(value);
}

function matchesRulesetGlob(pattern: string, ref: string): boolean {
  const compiled = normalizeRulesetPattern(pattern);
  if (!compiled) return false;
  if (compiled === "refs/heads/*") return true;
  if (compiled === ref) return true;
  if (compiled.endsWith("/**")) {
    const prefix = compiled.slice(0, -3);
    return ref === prefix || ref.startsWith(`${prefix}/`);
  }
  if (compiled.endsWith("/*")) {
    const prefix = `${compiled.slice(0, -2)}/`;
    const rest = ref.startsWith(prefix) ? ref.slice(prefix.length) : "";
    return rest !== "" && !rest.includes("/");
  }
  return false;
}
