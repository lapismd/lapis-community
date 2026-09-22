import type { CommunityInboxModel } from "./model.js";

import { communityInboxFixture } from "./story-fixtures.js";

export function communityInboxSelectionHarnessModel(): CommunityInboxModel {
  const welcome = communityInboxFixture.items[0]!;
  return {
    ...communityInboxFixture,
    items: [
      {
        ...welcome,
        rootEventId: "fizz-introduction",
        latestEventId: "steve-reply",
      },
      {
        id: "support-thread",
        authorId: "honey",
        context: "Thread in #support",
        timestamp: "Today",
        excerpt: "Need a second conversation for selection loading.",
        rootEventId: "support-root",
        latestEventId: "support-latest",
      },
    ],
  };
}

export function selectInboxSelectionHarnessItem(
  model: CommunityInboxModel,
  itemId: string,
): CommunityInboxModel {
  const item = model.items.find((candidate) => candidate.id === itemId);
  if (!item) return model;
  return {
    ...model,
    activeItemId: item.id,
    selectedItem: item,
    threadTitle: item.context,
  };
}
