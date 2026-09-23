import {
  groupItemsByProjectRepository,
  type ProjectForgeRepository,
} from "../../projects/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export function projectRepositoryContributorGroups(
  repositories: readonly ProjectForgeRepository[],
  rooms: readonly CommunityRoomModel[],
  members: readonly CommunityMemberModel[],
) {
  const byChannel = new Map<string, CommunityMemberModel[]>();
  for (const repository of repositories) {
    const room = rooms.find(
      (candidate) =>
        candidate.groupId === repository.channelId ||
        candidate.id === repository.channelId,
    );
    const ids = new Set(room?.participantIds ?? []);
    byChannel.set(
      repository.address.coordinate,
      members.filter((member) => ids.has(member.id)),
    );
  }
  return groupItemsByProjectRepository(
    members.flatMap((member) =>
      repositories
        .filter((repository) =>
          byChannel
            .get(repository.address.coordinate)
            ?.some((candidate) => candidate.id === member.id),
        )
        .map((repository) => ({
          member,
          repository: repository.address.coordinate,
        })),
    ),
    repositories,
    (item) => item.repository,
  ).map((group) => ({
    repository: group.repository,
    items: group.items.map((item) => item.member),
  }));
}
