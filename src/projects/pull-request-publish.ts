import type { NostrEventTemplate } from "../protocol/index.js";
import { createPullRequestTemplate } from "./builders.js";
import {
  projectForgeBranchRefs,
  type ProjectForgeRefsResponse,
} from "./model.js";

export interface PullRequestPublishSession {
  loadRefs(repository: string): Promise<ProjectForgeRefsResponse>;
  publish(template: NostrEventTemplate): Promise<unknown>;
}

export async function submitRepositoryPullRequest(input: {
  repository: string;
  title: string;
  content: string;
  cloneUrl: string;
  commit?: string;
  branchName?: string;
  targetBranch?: string;
  mutate: (
    label: string,
    action: (session: PullRequestPublishSession) => Promise<void>,
  ) => Promise<void>;
}): Promise<void> {
  const owner = input.repository.split(":")[1];
  if (!owner) throw new Error("Repository owner is missing");
  const directCommit = input.commit?.trim();
  await input.mutate("Creating pull request…", async (session) => {
    const commit = directCommit ?? (await compareCommit(session, input));
    await session.publish(
      createPullRequestTemplate({
        repository: input.repository,
        repositoryOwner: owner,
        title: input.title,
        content: input.content,
        commit,
        cloneUrls: [input.cloneUrl],
        ...(input.branchName ? { branchName: input.branchName } : {}),
        ...(input.targetBranch ? { targetBranch: input.targetBranch } : {}),
      }),
    );
  });
}

async function compareCommit(
  session: PullRequestPublishSession,
  input: { repository: string; branchName?: string; targetBranch?: string },
): Promise<string> {
  const branches = projectForgeBranchRefs(
    await session.loadRefs(input.repository),
  );
  if (!branches.some((branch) => branch.name === input.targetBranch)) {
    throw new Error("The selected base branch no longer exists");
  }
  const compare = branches.find((branch) => branch.name === input.branchName);
  if (!compare) throw new Error("The selected compare branch no longer exists");
  return compare.sha;
}
