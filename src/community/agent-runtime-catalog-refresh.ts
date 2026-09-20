import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import { runtimeModelOptions } from "./agent-runtime-catalog.js";

export function runtimeCatalogNeedsRefresh(
  runtime: CommunityAgentRuntimeState | undefined,
  runtimeAgent?: string,
): boolean {
  if (!runtime) return true;
  if (runtimeAgent) {
    const advertised = runtime.runtimeAgents.find(
      (entry) => entry.id === runtimeAgent,
    );
    const catalog =
      advertised?.catalog ??
      (runtime.catalog.agent === runtimeAgent ? runtime.catalog : undefined);
    return runtimeModelOptions(catalog).length === 0;
  }
  if (runtimeModelOptions(runtime.catalog).length > 0) return false;
  return !runtime.runtimeAgents.some(
    (entry) => runtimeModelOptions(entry.catalog).length > 0,
  );
}
