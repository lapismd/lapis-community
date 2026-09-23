export type LogReviewSubmitInput = {
  title: string;
  content: string;
  commit: string;
  targetBranch: string;
  branchName?: string;
};
