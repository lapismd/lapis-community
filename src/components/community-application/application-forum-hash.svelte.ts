import { untrack } from "svelte";

import type { CommunityApplicationLocation } from "./navigation.js";

export function provideForumTopicSync(
  location: () => CommunityApplicationLocation,
  rooms: () => readonly { id: string; kind: string }[],
  openTopic: (topicId: string) => void,
): void {
  $effect(() => {
    const current = location();
    if (current.panel.kind !== "thread") return;
    const roomId = current.panel.roomId;
    const topicId = current.panel.rootMessageId;
    if (rooms().find((room) => room.id === roomId)?.kind !== "forum") return;
    untrack(() => openTopic(topicId));
  });
}
