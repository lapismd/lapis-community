import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import { runtimeCatalogNeedsRefresh } from "./agent-runtime-catalog-refresh.js";

export function queueEditorRuntimeRefresh(input: {
  open: boolean;
  pubkey?: string | undefined;
  runtime?: CommunityAgentRuntimeState | undefined;
  runtimeAgent?: string | undefined;
  requestedKey: string;
  load?: (() => Promise<CommunityAgentRuntimeState>) | undefined;
}): { requestedKey: string; task?: Promise<CommunityAgentRuntimeState> } {
  if (!input.open || !input.pubkey || !input.load) {
    return { requestedKey: input.open ? input.requestedKey : "" };
  }
  const requestKey = input.runtimeAgent
    ? `${input.pubkey}:${input.runtimeAgent}`
    : input.pubkey;
  if (
    !runtimeCatalogNeedsRefresh(input.runtime, input.runtimeAgent) ||
    input.requestedKey === requestKey
  ) {
    return { requestedKey: input.requestedKey };
  }
  return {
    requestedKey: requestKey,
    task: input.load(),
  };
}
