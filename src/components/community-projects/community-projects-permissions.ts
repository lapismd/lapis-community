import type { CommunityRoomModel } from "../../community/workspace-model.js";
import { roomCanMaintain } from "../../community/channel-authority.js";
import type { PullRequestState } from "../../projects/model.js";

export interface MergeCandidatePullRequest {
  lifecycle: PullRequestState["lifecycle"];
  root: Pick<PullRequestState["root"], "pubkey">;
  approvals: readonly { reviewer: string }[];
}

export function repositoryRoom(
  rooms: readonly CommunityRoomModel[],
  channelId: string | undefined,
): CommunityRoomModel | undefined {
  if (!channelId) return undefined;
  return rooms.find((room) => (room.groupId ?? room.id) === channelId);
}

export function canMaintainRepository(
  rooms: readonly CommunityRoomModel[],
  channelId: string | undefined,
): boolean {
  return roomCanMaintain(repositoryRoom(rooms, channelId));
}

export function channelIdForCoordinate(
  repositories: readonly {
    address: { coordinate: string };
    channelId: string;
  }[],
  coordinate: string | undefined,
  fallback?: string,
): string | undefined {
  if (!coordinate) return fallback;
  return (
    repositories.find(
      (repository) => repository.address.coordinate === coordinate,
    )?.channelId ?? fallback
  );
}

export function canReviewPullRequest(options: {
  canCollaborate: boolean;
  canMaintain: boolean;
  lifecycle: PullRequestState["lifecycle"];
}): boolean {
  return (
    options.canCollaborate &&
    options.canMaintain &&
    options.lifecycle !== "merged"
  );
}

export function canMergeMaintainedPullRequest(options: {
  canCollaborate: boolean;
  canMaintain: boolean;
  mergeAdvertised: boolean;
  pullRequest: MergeCandidatePullRequest;
  actor?: string;
}): boolean {
  return mergeDenialReason(options) === undefined;
}

export function mergeDenialReason(options: {
  canCollaborate: boolean;
  canMaintain: boolean;
  mergeAdvertised: boolean;
  pullRequest: MergeCandidatePullRequest;
}): string | undefined {
  if (options.pullRequest.lifecycle !== "open")
    return "This pull request is not open";
  if (!options.canCollaborate) return "Sign in to merge this pull request";
  if (!options.canMaintain)
    return "A maintainer or administrator role is required to merge";
  if (!options.mergeAdvertised)
    return "The repository does not advertise merge capability";
  if (
    !options.pullRequest.approvals.some(
      (approval) => approval.reviewer !== options.pullRequest.root.pubkey,
    )
  ) {
    return "A trusted non-author approval is required before merge";
  }
  return undefined;
}
