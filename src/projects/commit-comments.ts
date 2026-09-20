import { agentContextMessageRole } from "./repository-agent-context.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import type { RepositoryAgentCheckpoint } from "./repository-agent-context.js";
export interface CommitCommentAnchor {
  path: string;
  side: "old" | "new";
  line: number;
}
export function createCommitComment(
  checkpoint: RepositoryAgentCheckpoint,
  commit: string,
  root: string,
  content: string,
  options: {
    anchor?: CommitCommentAnchor;
    base?: string;
  } = {},
): NostrEventTemplate {
  if (
    !checkpoint.commitIds.includes(commit) ||
    !checkpoint.repositoryAddress ||
    !checkpoint.channelId ||
    !/^[a-f0-9]{64}$/.test(root)
  )
    throw new Error("A linked agent checkpoint is required");
  const request = checkpoint.records.find(
    (record) => agentContextMessageRole(record) === "user",
  )?.sourceEventId;
  if (!request || !content.trim())
    throw new Error("A request and comment are required");
  const anchor = options.anchor;
  if (
    anchor &&
    (!anchor.path ||
      anchor.path.startsWith("/") ||
      /[\\\x00]/.test(anchor.path) ||
      anchor.path.split("/").includes("..") ||
      !Number.isSafeInteger(anchor.line) ||
      anchor.line < 1)
  )
    throw new Error("Invalid diff location");
  return {
    kind: 1111,
    created_at: Math.floor(Date.now() / 1000),
    content: content.trim(),
    tags: [
      ["E", checkpoint.eventId],
      ["K", "3907"],
      ["P", checkpoint.authorPubkey],
      ["e", checkpoint.eventId],
      ["k", "3907"],
      ["a", checkpoint.repositoryAddress],
      ["h", checkpoint.channelId],
      ["c", commit],
      ["t", "commit-comment"],
      ["request", request],
      ["thread", root],
      ["p", checkpoint.authorPubkey],
      ...(options.base ? [["base", options.base]] : []),
      ...(anchor
        ? [
            ["t", "inline-comment"],
            ["file", anchor.path],
            ["side", anchor.side],
            ["line", String(anchor.line)],
          ]
        : []),
    ],
  };
}
export function commitComments(
  events: readonly NostrEvent[],
  checkpointIds: readonly string[],
  commit: string,
  anchor?: CommitCommentAnchor,
) {
  return events.filter(
    (event) =>
      event.kind === 1111 &&
      event.tags.some(([key, value]) => key === "K" && value === "3907") &&
      event.tags.some(
        ([key, value]) => key === "t" && value === "commit-comment",
      ) &&
      event.tags.some(
        ([key, id]) => key === "E" && checkpointIds.includes(id!),
      ) &&
      event.tags.some(([key, id]) => key === "c" && id === commit) &&
      (!anchor ||
        [
          ["file", anchor.path],
          ["side", anchor.side],
          ["line", String(anchor.line)],
        ].every(([key, value]) =>
          event.tags.some(([name, item]) => name === key && item === value),
        )),
  );
}
