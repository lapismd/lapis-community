import type { CommunityAgentIdentityFields } from "../../community/member-identity.js";
import { presentCommunityIdentityModel } from "../../community/member-identity.js";
import type {
  CommunityRoomModel,
  CommunityWorkspaceModel,
} from "../community-workspace/model.js";

export function presentCommunityWorkspace(
  workspace: CommunityWorkspaceModel,
  presentRoom: (room: CommunityRoomModel) => CommunityRoomModel,
  agents?: {
    agents?: readonly CommunityAgentIdentityFields[];
    archivedAgents?: readonly CommunityAgentIdentityFields[];
    publicAgents?: readonly CommunityAgentIdentityFields[];
  },
): CommunityWorkspaceModel {
  let changed = false;
  const navigationSections = workspace.navigationSections.map((section) => {
    const rooms = section.rooms.map(presentRoom);
    if (rooms.every((room, index) => room === section.rooms[index]))
      return section;
    changed = true;
    return { ...section, rooms };
  });
  return presentCommunityIdentityModel(
    changed ? { ...workspace, navigationSections } : workspace,
    agents,
  );
}
