import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import { runtimeModelOptions } from "./agent-runtime-catalog.js";

export function runtimeCatalogNeedsRefresh(
  runtime: CommunityAgentRuntimeState | undefined,
): boolean {
  if (!runtime) return true;
  const harnesses = runtime.runtimeAgents.length
    ? runtime.runtimeAgents
    : [{ id: runtime.catalog.agent, catalog: runtime.catalog }];
  return harnesses.some((entry) => {
    const catalog =
      entry.catalog ??
      (runtime.catalog.agent === entry.id ? runtime.catalog : undefined);
    if (runtimeModelOptions(catalog).length > 0) return false;
    return !catalog?.error;
  });
}
