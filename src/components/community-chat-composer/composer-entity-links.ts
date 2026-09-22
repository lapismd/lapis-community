import { EditorView } from "@codemirror/view";

import {
  communityEntityLinkMatches,
  normalizeCommunityEntityHref,
} from "../../community/community-link-normalize.js";
import { parseCommunityEntityLink } from "../../community/community-links.js";
import type { CommunityEntityLink } from "../../community/community-links.js";

export function communityComposerEntityMatches(value: string): Array<{
  from: number;
  to: number;
  href: string;
  link: CommunityEntityLink;
}> {
  const matches: Array<{
    from: number;
    to: number;
    href: string;
    link: CommunityEntityLink;
  }> = [];
  for (const match of communityEntityLinkMatches(value)) {
    const link = parseCommunityEntityLink(match.href);
    if (!link) continue;
    matches.push({
      from: match.start,
      to: match.end,
      href: match.href,
      link,
    });
  }
  return matches;
}

export function normalizedCommunityPasteHref(
  clipboard: string,
): string | undefined {
  const trimmed = clipboard.trim();
  if (trimmed === "" || trimmed.includes("\n")) return undefined;
  const href = normalizeCommunityEntityHref(trimmed);
  return href && href !== trimmed ? href : undefined;
}

export function communityComposerPasteHandler() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const href = normalizedCommunityPasteHref(text);
      if (!href) return false;
      event.preventDefault();
      view.dispatch(view.state.replaceSelection(href));
      return true;
    },
  });
}
