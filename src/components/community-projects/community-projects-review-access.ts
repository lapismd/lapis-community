import type { CommunityRoomModel } from "../../community/workspace-model.js";
import { allowsAuthorReviewDecision } from "../../projects/review-trust.js";
import type { PullRequestState } from "../../projects/model.js";
import {
  canMaintainRepository,
  canMergeMaintainedPullRequest,
  canReviewPullRequest,
  channelIdForCoordinate,
  repositoryRoom,
  type MergeCandidatePullRequest,
} from "./community-projects-permissions.js";

export interface ReviewAccessPullRequest extends MergeCandidatePullRequest {
  repository?: Pick<PullRequestState["repository"], "owner" | "coordinate">;
}

export function repositoryChannelAuthority(
  rooms: readonly CommunityRoomModel[],
  channelId: string | undefined,
): { canMaintain: boolean; isAdmin: boolean } {
  const room = repositoryRoom(rooms, channelId);
  return {
    canMaintain: canMaintainRepository(rooms, channelId),
    isAdmin: room?.permissions?.manageMembers.state === "enabled",
  };
}

export function canReviewSelectedPullRequest(options: {
  canCollaborate: boolean;
  canMaintain: boolean;
  lifecycle: PullRequestState["lifecycle"];
  actor?: string;
  author?: string;
  repositoryOwner?: string;
  isAdmin?: boolean;
}): boolean {
  if (
    !canReviewPullRequest({
      canCollaborate: options.canCollaborate,
      canMaintain: options.canMaintain,
      lifecycle: options.lifecycle,
    })
  ) {
    return false;
  }
  if (!options.actor || !options.author || options.actor !== options.author) {
    return true;
  }
  return allowsAuthorReviewDecision({
    signer: options.actor,
    author: options.author,
    repositoryOwner: options.repositoryOwner ?? "",
    ...(options.isAdmin === true ? { isAdmin: true } : {}),
  });
}

export function canMergeSelectedPullRequest(options: {
  canCollaborate: boolean;
  canMaintain: boolean;
  mergeAdvertised: boolean;
  pullRequest: MergeCandidatePullRequest;
  isAdmin?: boolean;
  adminBypass?: boolean;
}): boolean {
  if (
    options.adminBypass === true &&
    options.isAdmin === true &&
    options.pullRequest.lifecycle === "open" &&
    options.canCollaborate &&
    options.canMaintain &&
    options.mergeAdvertised
  ) {
    return true;
  }
  return canMergeMaintainedPullRequest(options);
}

export function selectedRepositoryReviewAccess(options: {
  rooms: readonly CommunityRoomModel[];
  repositories: readonly { address: { coordinate: string }; channelId: string }[];
  selectedRepositoryChannelId?: string;
  selectedCoordinate?: string;
  canCollaborate: boolean;
  actor?: string;
  pullRequest?: ReviewAccessPullRequest;
  capabilities?: Readonly<
    Record<
      string,
      { merge?: boolean; protection?: { admin_bypass?: boolean } } | undefined
    >
  >;
  mergeHandler?: unknown;
  canPublishReview: boolean;
}): { canMaintain: boolean; canSubmit: boolean; canMerge: boolean } {
  const channelId =
    options.selectedRepositoryChannelId ??
    channelIdForCoordinate(options.repositories, options.selectedCoordinate);
  const authority = repositoryChannelAuthority(options.rooms, channelId);
  const capabilities = options.pullRequest?.repository
    ? options.capabilities?.[options.pullRequest.repository.coordinate]
    : undefined;
  return {
    canMaintain: authority.canMaintain,
    canSubmit:
      options.canPublishReview &&
      canReviewSelectedPullRequest({
        canCollaborate: options.canCollaborate,
        canMaintain: authority.canMaintain,
        lifecycle: options.pullRequest?.lifecycle ?? "open",
        ...(authority.isAdmin ? { isAdmin: true } : {}),
        ...(options.actor === undefined ? {} : { actor: options.actor }),
        ...(options.pullRequest?.root.pubkey === undefined
          ? {}
          : { author: options.pullRequest.root.pubkey }),
        ...(options.pullRequest?.repository?.owner === undefined
          ? {}
          : { repositoryOwner: options.pullRequest.repository.owner }),
      }),
    canMerge: options.pullRequest
      ? canMergeSelectedPullRequest({
          canCollaborate: options.canCollaborate,
          canMaintain: authority.canMaintain,
          isAdmin: authority.isAdmin,
          adminBypass: capabilities?.protection?.admin_bypass === true,
          mergeAdvertised:
            capabilities?.merge === true && options.mergeHandler !== undefined,
          pullRequest: options.pullRequest,
        })
      : false,
  };
}
