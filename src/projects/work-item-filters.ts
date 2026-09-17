import type { RelayFilter } from "../nostr/index.js";

import { PROJECT_FORGE_KINDS } from "./model.js";

export const KIND_JJ_OPERATION = 3901;

const WORK_ITEM_LIMIT = 2_000;

export function buzzWorkItemFilters(
  repositoryCoordinate: string,
): RelayFilter[] {
  return [
    {
      kinds: [PROJECT_FORGE_KINDS.task, PROJECT_FORGE_KINDS.pullRequest],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [PROJECT_FORGE_KINDS.pullRequestUpdate],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [PROJECT_FORGE_KINDS.note],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [PROJECT_FORGE_KINDS.reaction],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [
        PROJECT_FORGE_KINDS.statusOpen,
        PROJECT_FORGE_KINDS.statusMerged,
        PROJECT_FORGE_KINDS.statusClosed,
        PROJECT_FORGE_KINDS.statusDraft,
      ],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [KIND_JJ_OPERATION],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
  ];
}
