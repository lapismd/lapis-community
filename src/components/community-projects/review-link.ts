import {
  buildCommunityRepoLink,
  parseAddressableCoordinate,
} from "../../community/community-links.js";

export function communityReviewLink(
  coordinate: string,
  id: string,
): string | undefined {
  const parsed = parseAddressableCoordinate(coordinate);
  if (!parsed) return undefined;
  try {
    return buildCommunityRepoLink({
      owner: parsed.owner,
      d: parsed.d,
      tab: "reviews",
      commit: id,
    });
  } catch {
    return undefined;
  }
}
