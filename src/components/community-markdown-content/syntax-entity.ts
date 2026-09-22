import {
  communityEntityLinkMatches,
  normalizeCommunityEntityHref,
} from "../../community/community-link-normalize.js";
import { parseCommunityEntityLink } from "../../community/community-links.js";

export type CommunityEntityMarkdownSegment = {
  kind: "entity";
  href: string;
  value: string;
};

export function communityMarkdownEntityMatches(value: string) {
  return communityEntityLinkMatches(value);
}

export function entitySegmentFromHref(
  href: string | undefined,
  label: string,
): CommunityEntityMarkdownSegment | undefined {
  if (!href) return undefined;
  const normalized = normalizeCommunityEntityHref(href);
  if (!normalized || !parseCommunityEntityLink(normalized)) return undefined;
  return {
    kind: "entity",
    href: normalized,
    value: label === href || label === normalized ? normalized : label,
  };
}
