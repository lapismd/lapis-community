import {
  publishComposerSlashSession,
  snapshotComposerSlashSession,
  type ComposerSlashSessionSource,
} from "../community-chat-composer/composer-slash-session.js";

export function bindComposerSlashSession(
  read: () => ComposerSlashSessionSource,
): void {
  $effect(() => {
    publishComposerSlashSession(snapshotComposerSlashSession(read()));
  });
}
