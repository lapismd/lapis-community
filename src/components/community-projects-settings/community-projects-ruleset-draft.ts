import { normalizeRulesetPattern } from "../../projects/protected-refs.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";
import type {
  ProjectForgeProtectionRule,
  ProjectForgeRulesetBypass,
  ProjectForgeRulesetTarget,
} from "../../projects/protection-ruleset.js";

export function cloneProtectionRule(
  rule: ProjectForgeProtectionRule,
): ProjectForgeProtectionRule {
  return { ...rule, targets: [...rule.targets], bypass: [...rule.bypass] };
}

export function withRulesetTarget(
  rule: ProjectForgeProtectionRule,
  target: ProjectForgeRulesetTarget,
): ProjectForgeProtectionRule {
  const key = `${target.type}:${target.pattern ?? ""}`;
  if (rule.targets.some((item) => `${item.type}:${item.pattern ?? ""}` === key)) {
    return rule;
  }
  return { ...rule, targets: [...rule.targets, target] };
}

export function withRulesetBypass(
  rule: ProjectForgeProtectionRule,
  actor: ProjectForgeRulesetBypass,
): ProjectForgeProtectionRule {
  const key = `${actor.kind}:${actor.pubkey ?? ""}`;
  if (rule.bypass.some((item) => `${item.kind}:${item.pubkey ?? ""}` === key)) {
    return rule;
  }
  return { ...rule, bypass: [...rule.bypass, actor] };
}

export function compileRulesetPattern(raw: string): string | undefined {
  return normalizeRulesetPattern(raw);
}

export function rulesetBypassMember(
  actor: ProjectForgeRulesetBypass,
  members: readonly CommunityMemberModel[],
): CommunityMemberModel | undefined {
  if (actor.kind !== "member" || !actor.pubkey) return undefined;
  const found = members.find((member) => member.id === actor.pubkey);
  if (found) return found;
  const short = actor.pubkey.slice(0, 8);
  return {
    id: actor.pubkey,
    name: short,
    handle: short,
    initials: actor.pubkey.slice(0, 2).toUpperCase(),
  };
}
