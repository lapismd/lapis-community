import type {
  PullRequestComment,
  PullRequestLifecycleEvent,
  PullRequestState,
} from "../../projects/index.js";

export type ReviewTimelineEntry =
  | { kind: "opened"; event: PullRequestState["root"] }
  | {
      kind: "lifecycle";
      event: PullRequestLifecycleEvent["event"];
      lifecycle: PullRequestLifecycleEvent["lifecycle"];
      mergeCommit: string;
    }
  | {
      kind: "review-request";
      event: PullRequestComment["event"];
      comment: PullRequestComment;
    }
  | {
      kind: "comment";
      event: PullRequestComment["event"];
      comment: PullRequestComment;
    };

export const REVIEW_GROUP_LABELS = [
  { lifecycle: "open", label: "Open" },
  { lifecycle: "draft", label: "Draft" },
  { lifecycle: "merged", label: "Merged" },
  { lifecycle: "closed", label: "Closed" },
] as const;

export function conversationComment(comment: PullRequestComment): boolean {
  return !comment.isInlineComment || comment.inlineStatus !== "current";
}

export function pullRequestEventTagValue(
  event: PullRequestState["root"],
  name: string,
): string {
  return event.tags.find((tag) => tag[0] === name)?.[1]?.trim() ?? "";
}

export function reviewLifecycleAction(
  entry: Extract<ReviewTimelineEntry, { kind: "lifecycle" }>,
): string {
  if (entry.lifecycle === "merged") return "merged this review";
  if (entry.lifecycle === "closed") return "closed this review";
  if (entry.lifecycle === "draft") return "converted this review to draft";
  return "reopened this review";
}

export function reviewCommentDecision(
  comment: PullRequestComment,
): "approved" | "changes-requested" | undefined {
  if (comment.decision) return comment.decision;
  const external = pullRequestEventTagValue(comment.event, "external-decision")
    .toLocaleLowerCase()
    .replaceAll("_", "-");
  if (external === "approved") return "approved";
  if (external === "changes-requested") return "changes-requested";
  return undefined;
}

export function buildReviewTimeline(
  pullRequest: PullRequestState,
): readonly ReviewTimelineEntry[] {
  const entries: ReviewTimelineEntry[] = [
    { kind: "opened", event: pullRequest.root },
    ...pullRequest.lifecycleEvents.map((entry) => ({
      kind: "lifecycle" as const,
      event: entry.event,
      lifecycle: entry.lifecycle,
      mergeCommit: entry.mergeCommit,
    })),
    ...pullRequest.comments.filter(conversationComment).map((comment) => ({
      kind: comment.isReviewRequest
        ? ("review-request" as const)
        : ("comment" as const),
      event: comment.event,
      comment,
    })),
  ];
  return entries.toSorted(
    (left, right) =>
      left.event.created_at - right.event.created_at ||
      left.event.id.localeCompare(right.event.id),
  );
}

export function diffLineSide(variant: string | undefined): "old" | "new" {
  return variant === "removed" ? "old" : "new";
}

export function reviewTimelineActorLabel(
  event: PullRequestState["root"],
  memberName: string,
): string {
  const external = pullRequestEventTagValue(event, "external-author");
  if (external) return `@${external}`;
  if (pullRequestEventTagValue(event, "external-provider") === "github") {
    return "GitHub";
  }
  return memberName;
}

export function reviewHasExternalActor(
  event: PullRequestState["root"],
): boolean {
  return Boolean(
    pullRequestEventTagValue(event, "external-author") ||
      pullRequestEventTagValue(event, "external-provider"),
  );
}

export function reviewRequestTargetLabel(
  comment: PullRequestComment,
  memberName: string | undefined,
): string {
  const external = pullRequestEventTagValue(comment.event, "external-reviewer");
  if (external) return `@${external}`;
  return memberName ?? "a reviewer";
}
