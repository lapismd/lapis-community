import type { CommunityTopicModel } from "../community-workspace/model.js";

export function estimateForumTopicRow(
  topic: Partial<CommunityTopicModel> | undefined,
): number {
  if (!topic) return 92;
  const title = typeof topic.title === "string" ? topic.title : "";
  const excerpt = typeof topic.excerpt === "string" ? topic.excerpt : "";
  const tags = topic.tags?.length ?? 0;
  const titleLines = Math.max(1, Math.ceil(title.length / 72));
  const excerptLines = Math.max(1, Math.ceil(excerpt.length / 112));
  const tagRows = tags === 0 ? 0 : Math.ceil(tags / 4);
  const stateRow =
    topic.pinned || topic.solved || topic.unread || topic.isNew ? 6 : 0;

  return Math.max(
    84,
    72 + titleLines * 10 + excerptLines * 16 + tagRows * 28 + stateRow,
  );
}
