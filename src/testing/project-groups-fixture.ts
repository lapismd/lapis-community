import type { ProjectForgeProject } from "../projects/model.js";
export function groupProject(
  identifier: string,
  repository: string,
): ProjectForgeProject {
  return {
    event: {
      id: identifier,
      pubkey: "owner",
      kind: 30621,
      created_at: 0,
      content: "",
      tags: [],
      sig: "",
    },
    name: identifier,
    description: "",
    channelId: "room",
    relatedChannelIds: [],
    listing: "listed",
    address: {
      kind: 30621,
      owner: "owner",
      identifier,
      coordinate: `30621:owner:${identifier}`,
    },
    repositories: [{ coordinate: repository }],
  };
}
