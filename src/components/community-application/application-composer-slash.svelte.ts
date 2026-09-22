import { communityEntityLinkLabel } from "../../community/community-link-normalize.js";
import type { CommunityEntityLink } from "../../community/community-links.js";
import { composerSlashEntityLabel } from "../community-chat-composer/composer-slash-labels.js";
import {
  publishComposerSlashSession,
  readComposerSlashSession,
  snapshotComposerSlashSession,
  type ComposerSlashSessionSource,
} from "../community-chat-composer/composer-slash-session.js";

export function applicationSlashEntityLabel(
  link: CommunityEntityLink,
  rooms: readonly { id: string; name: string }[],
): string {
  return (
    composerSlashEntityLabel(link, readComposerSlashSession()) ??
    communityEntityLinkLabel(link, rooms)
  );
}

export function bindComposerSlashSession(
  read: () => ComposerSlashSessionSource,
): void {
  const publish = () =>
    publishComposerSlashSession(snapshotComposerSlashSession(read()));
  publish();
  $effect(publish);
}
