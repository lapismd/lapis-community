import type { CommunityMemberModel } from "../community-workspace/model.js";

export interface CommunityMarkdownInteractionContext {
  member(id: string): CommunityMemberModel | undefined;
  onOpenMember: ((member: CommunityMemberModel) => void) | undefined;
  onOpenRoom: ((roomId: string) => void) | undefined;
}

export const communityMarkdownInteractionContext = Symbol(
  "community-markdown-interactions",
);
