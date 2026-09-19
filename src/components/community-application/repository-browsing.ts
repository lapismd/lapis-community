import type {
  ProjectForgeRepository,
  ProjectForgeRepositoryCapabilities,
} from "../../projects/model.js";
export function repositorySupportsBrowsing(
  repository: ProjectForgeRepository,
  capabilities: ProjectForgeRepositoryCapabilities | undefined,
): boolean {
  if (capabilities !== undefined) return capabilities.browse;
  // Preserve compatibility with relays that predate capability discovery.
  return repository.repositoryClass === "hosted";
}

import type { CommunityRoomModel } from "../../community/workspace-model.js";
export function findWorkspaceRoom(
  rooms: readonly CommunityRoomModel[],
  active: CommunityRoomModel,
  id: string,
) {
  return (
    rooms.find((room) => room.id === id) ??
    (active.id === id ? active : undefined)
  );
}
