import { npubEncode } from "nostr-tools/nip19";

export type LogReviewSubmitInput = {
  title: string;
  content: string;
  commit: string;
  changeId: string;
  targetBranch: string;
};

export function logReviewBranchName(
  authorPubkey: string,
  changeId: string,
): string {
  const author = authorPubkey.trim().toLowerCase();
  const change = changeId.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(author)) {
    throw new Error("Log review author is missing");
  }
  if (!/^[0-9a-f]{32}$/u.test(change)) {
    throw new Error("Log review change id is missing");
  }
  return `review/${npubEncode(author)}/${change}`;
}

export function logReviewRequest(
  input: LogReviewSubmitInput,
  authorPubkey: string | undefined,
  repository: string,
): {
  repository: string;
  title: string;
  content: string;
  commit: string;
  branchName: string;
  targetBranch: string;
} {
  return {
    repository,
    title: input.title,
    content: input.content,
    commit: input.commit,
    targetBranch: input.targetBranch,
    branchName: logReviewBranchName(authorPubkey ?? "", input.changeId),
  };
}
