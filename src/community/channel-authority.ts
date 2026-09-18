import type {
  CommunityActionAvailability,
  CommunityMemberModel,
  CommunityRoomModel,
} from "./workspace-model.js";

export const MAINTAINER_ROLE_ID = "maintainer";

export const MAINTAINER_ROLE_DEFINITION = {
  id: MAINTAINER_ROLE_ID,
  label: "Maintainer",
  description:
    "Can create repositories on this channel and review or merge its pull requests",
} as const;

export function memberCanMaintain(member: CommunityMemberModel): boolean {
  return (
    member.administrator === true ||
    (member.roles ?? []).includes(MAINTAINER_ROLE_ID)
  );
}

export function roomCanMaintain(room: CommunityRoomModel | undefined): boolean {
  return room?.permissions?.maintain?.state === "enabled";
}

export function roomMaintainAvailability(
  room: CommunityRoomModel | undefined,
): CommunityActionAvailability {
  return (
    room?.permissions?.maintain ?? {
      state: "denied",
      reason:
        "A maintainer or administrator role is required to create repositories and review or merge pull requests",
      requirement: "maintainer",
    }
  );
}

export function reviewerCandidates(
  members: readonly CommunityMemberModel[],
  extraPubkeys: readonly string[] = [],
): CommunityMemberModel[] {
  const extras = extraPubkeys.filter(
    (pubkey) => !members.some((member) => member.id === pubkey),
  );
  return [
    ...members.filter(memberCanMaintain),
    ...extras.map((id) => ({
      id,
      name: id.slice(0, 8),
      handle: id.slice(0, 8),
      initials: id.slice(0, 2).toUpperCase(),
    })),
  ].toSorted((left, right) => left.name.localeCompare(right.name));
}
