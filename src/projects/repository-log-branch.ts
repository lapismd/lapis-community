import type { ProjectForgeRef } from "./model.js";
import { projectForgeBranchKind } from "./repository-refs.js";

export function repositoryLogBranchSeed(
  refs: readonly ProjectForgeRef[] | undefined,
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  const ref = refs?.find((item) => item.name === value || item.sha === value);
  if (!ref || projectForgeBranchKind(ref.name) === "sync") return undefined;
  return ref.sha;
}
