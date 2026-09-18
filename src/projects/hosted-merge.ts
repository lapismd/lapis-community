import { createWorkItemStatusTemplate } from "./builders.js";
import type { ProjectForgeSession } from "./data-source.js";
import type { ProjectForgeOperation, PullRequestState } from "./model.js";

export async function mergeHostedPullRequest(
  session: ProjectForgeSession,
  pullRequest: PullRequestState,
  collaborationBackend: string | undefined,
): Promise<ProjectForgeOperation> {
  const operation = await session.mergePullRequest(
    pullRequest.root.id,
    pullRequest.currentCommit,
  );
  const mergeCommit = operation.result?.merged_commit;
  if (mergeCommit && collaborationBackend !== "github") {
    await session.publish(
      createWorkItemStatusTemplate(
        pullRequest.root,
        pullRequest.repository.coordinate,
        "merged",
        { mergeCommit },
      ),
    );
  }
  return operation;
}
