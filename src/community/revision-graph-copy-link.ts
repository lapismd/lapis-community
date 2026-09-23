import { COMMUNITY_COMMIT, normalizeChange } from "./community-link-ids.js";
import {
  COMMUNITY_REPOSITORY_KIND,
  buildCommunityRepoLink,
  parseAddressableCoordinate,
} from "./community-links.js";

const REPOSITORY_HASH = /^#\/projects\/repository\/([^/]+)/u;
const HASH_SURFACE = /^#\/projects\/repository\/[^/]+\/([^/]+)/u;

export function revisionGraphCopiedValue(input: {
  coordinate?: string | undefined;
  label: string;
  value: string;
  hash?: string | undefined;
}): string {
  const hash = input.hash ?? "";
  const coordinate = input.coordinate || coordinateFromHash(hash);
  const parsed = coordinate
    ? parseAddressableCoordinate(coordinate)
    : undefined;
  if (!parsed || parsed.kind !== COMMUNITY_REPOSITORY_KIND) return input.value;
  const tab = copyTab(input.label, hash);
  const change =
    input.label === "change ID" ? normalizeChange(input.value) : undefined;
  if (change) {
    return buildCommunityRepoLink({
      owner: parsed.owner,
      d: parsed.d,
      tab: tab === "oplog" ? "oplog" : "log",
      change,
    });
  }
  if (COMMUNITY_COMMIT.test(input.value)) {
    return buildCommunityRepoLink({
      owner: parsed.owner,
      d: parsed.d,
      tab,
      commit: input.value.toLowerCase(),
    });
  }
  return buildCommunityRepoLink({
    owner: parsed.owner,
    d: parsed.d,
    tab,
    id: input.value,
  });
}

function coordinateFromHash(hash: string): string {
  const match = REPOSITORY_HASH.exec(hash);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function copyTab(label: string, hash: string): string {
  const surface = HASH_SURFACE.exec(hash)?.[1] ?? "";
  if (label === "change ID") return surface === "oplog" ? "oplog" : "log";
  if (label === "operation ID" || label === "replica ID") return "oplog";
  if (label === "commit ID" && (surface === "log" || surface === "oplog"))
    return surface;
  return "commits";
}
