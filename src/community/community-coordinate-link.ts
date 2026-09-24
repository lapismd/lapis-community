import {
  COMMUNITY_TAB,
  requireHex64,
  requireId,
  requireCommit,
  requireBranch,
  requireChange,
} from "./community-link-ids.js";
import { COMMUNITY_LINK_SCHEME } from "./community-link-scheme.js";

export function coordinateLink(
  host: "project" | "repo",
  input: {
    owner: string;
    d: string;
    tab?: string;
    commit?: string;
    branch?: string;
    change?: string;
    id?: string;
  },
): string {
  const params = new URLSearchParams();
  params.set("owner", requireHex64(input.owner, "owner"));
  params.set("d", requireId(input.d, "d"));
  if (input.tab) {
    if (!COMMUNITY_TAB.test(input.tab))
      throw new Error(`invalid tab: ${input.tab}`);
    params.set("tab", input.tab);
  }
  if (input.commit) params.set("commit", requireCommit(input.commit));
  if (input.branch) params.set("branch", requireBranch(input.branch));
  if (input.change) params.set("change", requireChange(input.change));
  if (input.id) params.set("id", requireId(input.id, "id"));
  return `${COMMUNITY_LINK_SCHEME}//${host}?${params}`;
}
