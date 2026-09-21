import {
  communityIdentityMembers,
  type CommunityAgentIdentityFields,
} from "../../community/member-identity.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";

export function transcriptMarkdownMembers(
  members: readonly CommunityMemberModel[],
  agents: readonly CommunityAgentIdentityFields[],
): readonly CommunityMemberModel[] {
  return communityIdentityMembers(members, agents);
}
