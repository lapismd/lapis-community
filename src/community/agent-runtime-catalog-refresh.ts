import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

export function runtimeCatalogNeedsRefresh(
  runtime: CommunityAgentRuntimeState | undefined,
): boolean {
  if (!runtime) return true;
  if (runtime.catalog.models.length > 0) return false;
  return !runtime.runtimeAgents.some(
    (entry) => (entry.catalog?.models.length ?? 0) > 0,
  );
}
