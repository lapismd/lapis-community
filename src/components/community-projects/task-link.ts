import {
  buildCommunityTaskLink,
  parseAddressableCoordinate,
} from "../../community/community-links.js";

export function communityTaskLink(
  coordinate: string,
  id: string,
): string | undefined {
  const parsed = parseAddressableCoordinate(coordinate);
  if (!parsed) return undefined;
  try {
    return buildCommunityTaskLink({
      owner: parsed.owner,
      d: parsed.d,
      id,
    });
  } catch {
    return undefined;
  }
}
