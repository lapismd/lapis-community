import type { RelayFilter } from "../nostr/index.js";

import { PROJECT_FORGE_KINDS } from "./model.js";

export const KIND_JJ_OPERATION = 3901;
export const KIND_JJ_REVISION = 3902;
export const KIND_JJ_VIEW = 3903;
export const KIND_JJ_OPERATION_GRAPH = 3904;
export const KIND_JJ_GRAPH_MANIFEST = 3905;

export const WORK_ITEM_LIMIT = 2_000;
export const GRAPH_CONTEXT_LIMIT = 64;
export const GRAPH_REVISION_LIMIT = 200;
export const GRAPH_OPERATION_LIMIT = 80;

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
    {
      kinds: [KIND_JJ_VIEW, KIND_JJ_GRAPH_MANIFEST],
      "#a": [repositoryCoordinate],
      limit: GRAPH_CONTEXT_LIMIT,
    },
    {
      kinds: [KIND_JJ_REVISION],
      "#a": [repositoryCoordinate],
      limit: GRAPH_REVISION_LIMIT,
    },
    {
      kinds: [KIND_JJ_OPERATION_GRAPH],
      "#a": [repositoryCoordinate],
      limit: GRAPH_OPERATION_LIMIT,
    },
  ];
}
