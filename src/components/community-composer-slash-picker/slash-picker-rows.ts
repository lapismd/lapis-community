import { communityEntityLinkPresentation } from "../../community/community-link-normalize.js";
import {
  parseCommunityEntityLink,
  type CommunityEntityLinkIcon,
} from "../../community/community-links.js";
import type { CommunityComposerAutocompleteItem } from "../community-chat-composer/autocomplete.js";
import {
  COMPOSER_SLASH_CATEGORIES,
  composerSlashItemHref,
  composerSlashItemKind,
} from "../community-chat-composer/composer-slash-catalog.js";

export function slashPickerHeading(
  item: CommunityComposerAutocompleteItem | undefined,
): string {
  if (!item) return "Insert";
  const kind = composerSlashItemKind(item);
  if (kind) return "Insert";
  const href = composerSlashItemHref(item);
  const link = href ? parseCommunityEntityLink(href) : undefined;
  if (!link) return "Insert";
  const presentation = communityEntityLinkPresentation(link);
  if (presentation.linkKind === "task") return "Tasks";
  if (presentation.linkKind === "channel") return "Channels";
  if (presentation.linkKind === "project") return "Projects";
  if (presentation.linkKind === "commit") return "Commits";
  if (presentation.linkKind === "log" || presentation.linkKind === "oplog") {
    return "Logs";
  }
  return "Repositories";
}

export function slashItemIcon(
  item: CommunityComposerAutocompleteItem,
): CommunityEntityLinkIcon {
  const kind = composerSlashItemKind(item);
  if (kind) {
    return (
      COMPOSER_SLASH_CATEGORIES.find((category) => category.kind === kind)
        ?.icon ?? "hash"
    );
  }
  const href = composerSlashItemHref(item);
  const link = href ? parseCommunityEntityLink(href) : undefined;
  return link ? communityEntityLinkPresentation(link).icon : "hash";
}
