import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import { runtimeCatalogNeedsRefresh } from "./agent-runtime-catalog-refresh.js";

export function queueEditorRuntimeRefresh(input: {
  open: boolean;
  pubkey?: string | undefined;
  runtime?: CommunityAgentRuntimeState | undefined;
  requestedKey: string;
  load?: (() => Promise<CommunityAgentRuntimeState>) | undefined;
}): { requestedKey: string; task?: Promise<CommunityAgentRuntimeState> } {
  if (!input.open || !input.pubkey || !input.load) {
    return { requestedKey: input.open ? input.requestedKey : "" };
  }
  if (
    !runtimeCatalogNeedsRefresh(input.runtime) ||
    input.requestedKey === input.pubkey
  ) {
    return { requestedKey: input.requestedKey };
  }
  return {
    requestedKey: input.pubkey,
    task: input.load(),
  };
}
