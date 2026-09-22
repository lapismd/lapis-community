import { communityCopiedProjectRouteLink } from "../../community/community-copy-links.js";
import type { ComposerSlashSessionSource } from "../community-chat-composer/composer-slash-session.js";
import { provideCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
import { provideCommunityShareLink } from "../community-entity-chip/share-link.js";
import {
  applicationSlashEntityLabel,
  bindComposerSlashSession,
} from "./application-composer-slash.svelte.js";
import { locationForCommunityEntityLink } from "./application-location-hash.js";
import { bindForumTopicOpen } from "./forum-topic-open.svelte.js";
import type { CommunityApplicationLocation } from "./navigation.js";

export function provideForumTopicSync(
  location: () => CommunityApplicationLocation,
  rooms: () => readonly { id: string; kind: string; name: string }[],
  openTopic: (topicId: string) => void,
  copy: (value: string, success: string) => void,
  openLocation: (next: CommunityApplicationLocation) => void,
  slash?: () => ComposerSlashSessionSource,
): void {
  if (slash) bindComposerSlashSession(slash);
  // prettier-ignore
  provideCommunityEntityNavigation({ open: (link) => openLocation(locationForCommunityEntityLink(link)), label: (link) => applicationSlashEntityLabel(link, rooms()) });
  provideCommunityShareLink({
    href() {
      const route = location().projectRoute;
      return route ? communityCopiedProjectRouteLink(route) : undefined;
    },
    copy: copy ?? (() => {}),
  });
  bindForumTopicOpen(location, rooms, openTopic);
}
