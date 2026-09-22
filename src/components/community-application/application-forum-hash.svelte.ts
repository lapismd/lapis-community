import { untrack } from "svelte";

import { communityCopiedProjectRouteLink } from "../../community/community-copy-links.js";
import { communityEntityLinkLabel } from "../../community/community-link-normalize.js";
import { provideCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
import { provideCommunityShareLink } from "../community-entity-chip/share-link.js";
import { locationForCommunityEntityLink } from "./application-location-hash.js";
import type { CommunityApplicationLocation } from "./navigation.js";

export function provideForumTopicSync(
  location: () => CommunityApplicationLocation,
  rooms: () => readonly { id: string; kind: string; name: string }[],
  openTopic: (topicId: string) => void,
  copy: (value: string, success: string) => void,
  openLocation: (next: CommunityApplicationLocation) => void,
): void {
  provideCommunityEntityNavigation({
    open: (link) => openLocation(locationForCommunityEntityLink(link)),
    label: (link) => communityEntityLinkLabel(link, rooms()),
  });
  provideCommunityShareLink({
    href() {
      const route = location().projectRoute;
      return route ? communityCopiedProjectRouteLink(route) : undefined;
    },
    copy: copy ?? (() => {}),
  });
  $effect(() => {
    const current = location();
    if (current.panel.kind !== "thread") return;
    const roomId = current.panel.roomId;
    const topicId = current.panel.rootMessageId;
    if (rooms().find((room) => room.id === roomId)?.kind !== "forum") return;
    untrack(() => openTopic(topicId));
  });
}
