import type { CommunityAgentsActions } from "../../community/agent-contracts.js";

export function ownedAgentDirectoryActions(agents: CommunityAgentsActions) {
  return {
    onSavePersona: agents.savePersona.bind(agents),
    onSaveAgent: agents.saveAgent.bind(agents),
    onLoadProcessing: agents.loadProcessing,
    onSetProcessing: agents.setProcessing,
    onLoadRuntime: (pubkey: string) => agents.loadRuntime(pubkey),
    onSaveRuntime: (
      pubkey: string,
      defaults: Parameters<CommunityAgentsActions["saveRuntime"]>[1],
    ) => agents.saveRuntime(pubkey, defaults),
    onUnlinkPersona: (pubkey: string, fallbackName: string) =>
      agents.unlinkAgent(pubkey, fallbackName),
    onDeletePersona: (slug: string) => agents.deletePersona(slug),
    onCreateManagedAgent: agents.createManagedAgent.bind(agents),
    onClearManagedAgentDraft: () => agents.clearManagedAgentDraft(),
    onCreateReplacement: (pubkey: string) =>
      agents.createManagedAgentReplacement(pubkey),
    onRevokeManagedAgent: (pubkey: string) => agents.revokeManagedAgent(pubkey),
    onDeleteManagedAgent: (pubkey: string) => agents.deleteManagedAgent(pubkey),
  };
}
