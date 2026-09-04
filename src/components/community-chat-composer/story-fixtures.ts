import type { CommunityCustomEmoji } from "../../community/index.js";
import {
  communityStoryMembers,
  communityStoryNavigation,
} from "../community-workspace/story-fixtures.js";

export const communityComposerStoryMembers = communityStoryMembers;

export const communityComposerStoryRooms = communityStoryNavigation.flatMap(
  (section) => section.rooms,
);

export const communityComposerStoryEmojis: CommunityCustomEmoji[] = [
  {
    shortcode: "lapis",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%234f46e5'/%3E%3Cpath d='M10 8h5v11h8v5H10z' fill='white'/%3E%3C/svg%3E",
    ownerPubkey: "ada",
    owned: true,
  },
  {
    shortcode: "shipit",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%230f766e'/%3E%3Cpath d='m9 18 4 4L24 10' fill='none' stroke='white' stroke-width='3'/%3E%3C/svg%3E",
    ownerPubkey: "mara",
    owned: false,
  },
];

export const communityComposerStoryImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 96'%3E%3Crect width='160' height='96' rx='12' fill='%23e0e7ff'/%3E%3Ccircle cx='50' cy='46' r='22' fill='%234f46e5' opacity='.85'/%3E%3Cpath d='m76 68 24-28 34 39H36l19-22 17 16z' fill='%23312e81' opacity='.7'/%3E%3C/svg%3E";
