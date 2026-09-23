import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import { logReviewBranchName } from "./log-review.js";
import { submitRepositoryPullRequest } from "./pull-request-publish.js";

const commit = "ab".repeat(20);

describe("submitRepositoryPullRequest", () => {
  it("publishes a selected dest-Git commit without a compare branch", async () => {
    const published: unknown[] = [];
    await submitRepositoryPullRequest({
      repository: `30617:${"cd".repeat(32)}:notes`,
      title: "Review the log change",
      content: "Please look",
      cloneUrl: "https://relay.example/git/notes",
      commit,
      mutate: async (_label, action) => {
        await action({
          loadRefs: () => Promise.reject(new Error("refs should not load")),
          publish: async (template) => {
            published.push(template);
          },
        });
      },
    });
    const template = published[0] as { tags: string[][] };
    expect(template.tags).toContainEqual(["c", commit]);
    expect(template.tags.some((tag) => tag[0] === "branch-name")).toBe(false);
    expect(template.tags.some((tag) => tag[0] === "target-branch")).toBe(false);
  });

  it("publishes a selected dest-Git target and matching bookmark", async () => {
    const published: unknown[] = [];
    await submitRepositoryPullRequest({
      repository: `30617:${"cd".repeat(32)}:notes`,
      title: "Review the log change",
      content: "Please look",
      cloneUrl: "https://relay.example/git/notes",
      commit,
      branchName: "feature/files",
      targetBranch: "trunk",
      mutate: async (_label, action) => {
        await action({
          loadRefs: () => Promise.reject(new Error("refs should not load")),
          publish: async (template) => {
            published.push(template);
          },
        });
      },
    });
    const template = published[0] as { tags: string[][] };
    expect(template.tags).toContainEqual(["c", commit]);
    expect(template.tags).toContainEqual(["branch-name", "feature/files"]);
    expect(template.tags).toContainEqual(["target-branch", "trunk"]);
  });

  it("publishes a Log review as the author change ref against the selected base", async () => {
    const author = getPublicKey(generateSecretKey());
    const changeId = "ef".repeat(16);
    const published: unknown[] = [];
    await submitRepositoryPullRequest({
      repository: `30617:${"cd".repeat(32)}:notes`,
      title: "Review the log change",
      content: "Please look",
      cloneUrl: "https://relay.example/git/notes",
      commit,
      changeId,
      authorPubkey: author,
      targetBranch: "main",
      mutate: async (_label, action) => {
        await action({
          loadRefs: () => Promise.reject(new Error("refs should not load")),
          publish: async (template) => {
            published.push(template);
          },
        });
      },
    });
    const template = published[0] as { tags: string[][] };
    expect(template.tags).toContainEqual([
      "branch-name",
      logReviewBranchName(author, changeId),
    ]);
    expect(template.tags).toContainEqual(["target-branch", "main"]);
    expect(template.tags).toContainEqual(["c", commit]);
  });
});
