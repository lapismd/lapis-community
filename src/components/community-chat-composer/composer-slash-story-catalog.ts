import { communityComposerStoryRooms } from "./story-fixtures.js";
import type { ComposerSlashCatalog } from "./composer-slash-catalog.js";
import { composerSlashChangeLabel } from "./composer-slash-labels.js";

export const composerSlashStoryOwner =
  "71d67180ba17e749ee825fc8819c9c6ee7003617e1c126504f9b658070ab9224";
export const composerSlashStoryTaskId =
  "c3b589fa5713ba25bad6dc095e2de00a4ac8f50050fdea00fc6444e603be1dd1";
export const composerSlashStoryCommitSha = "a".repeat(40);
export const composerSlashStoryChangeId = "b".repeat(32);

export const composerSlashStoryCatalog: ComposerSlashCatalog = {
  rooms: communityComposerStoryRooms,
  projects: [],
  repositories: [],
  tasks: [
    {
      owner: composerSlashStoryOwner,
      d: "buzz-world",
      id: composerSlashStoryTaskId,
      title: "Awesome",
    },
  ],
  commits: [
    {
      owner: composerSlashStoryOwner,
      d: "buzz-world",
      sha: composerSlashStoryCommitSha,
      subject: "Prepare the next Community project milestone",
    },
  ],
  logs: [
    {
      owner: composerSlashStoryOwner,
      d: "buzz-world",
      tab: "log",
      label: "Prepare the next Community project milestone",
      detail: composerSlashStoryCommitSha.slice(0, 8),
      commit: composerSlashStoryCommitSha,
    },
    {
      owner: composerSlashStoryOwner,
      d: "buzz-world",
      tab: "oplog",
      label: composerSlashChangeLabel(composerSlashStoryChangeId),
      detail: "Show agent context beside JJ revisions",
      commit: composerSlashStoryCommitSha,
      changeId: composerSlashStoryChangeId,
    },
  ],
};
