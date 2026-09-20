import { agentContextTemplate } from "./agent-context-template.js";
import type { NostrEventTemplate } from "../protocol/index.js";
import {
  KIND_JJ_AGENT_CONTEXT_PAGE,
  KIND_JJ_CHECKPOINT_MANIFEST,
  KIND_JJ_GRAPH_MANIFEST,
  KIND_JJ_OPERATION,
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
  KIND_JJ_VIEW,
} from "../projects/work-item-filters.js";
import {
  createLocalProjectAgentContextBodies,
  LOCAL_AGENT_CONTEXT_IDS,
} from "./project-agent-context-bodies.js";

export { LOCAL_AGENT_CONTEXT_IDS } from "./project-agent-context-bodies.js";

export interface LocalProjectAgentContextOptions {
  repositoryCoordinate: string;
  channelId: string;
  createdAt: number;
  agentPubkey?: string;
  sourceMessages?: { request: string; response: string; owner: string };
}

export interface LocalProjectAgentContextFixture {
  publications: readonly NostrEventTemplate[];
  contextPageIndex: number;
  contextPageIndices: number[];
  checkpointManifest(
    pageEventIds: string | readonly string[],
  ): NostrEventTemplate;
}

const carrierDigest = "6".repeat(64);
const carrierCommitId = "7".repeat(40);

export function createLocalProjectAgentContextFixture(
  options: LocalProjectAgentContextOptions,
): LocalProjectAgentContextFixture {
  const ids = LOCAL_AGENT_CONTEXT_IDS;
  const bodies = createLocalProjectAgentContextBodies(
    options.createdAt,
    options.agentPubkey,
    options.sourceMessages,
  );
  const baseTags = [
    ["a", options.repositoryCoordinate],
    ["h", options.channelId],
  ];
  const publications = [
    agentContextTemplate(
      KIND_JJ_OPERATION,
      options.createdAt,
      "jj-operation",
      [
        ["r", ids.scopeId],
        ["o", ids.operationId],
        ["x", carrierDigest],
        ...baseTags,
      ],
      {
        schema: "jj-sync/operation",
        version: 2,
        scope_id: ids.scopeId,
        replica_id: ids.replicaId,
        native_profile: bodies.nativeProfile,
        operation_id: ids.operationId,
        view_id: ids.viewId,
        parent_operation_ids: [],
        occurred_at_ms: options.createdAt * 1_000,
        storage: {
          type: "git-branch",
          repository_binding_id: "local-community",
          object_format: "sha1",
          branch_ref: `refs/heads/jj-sync/${ids.scopeId}/${ids.replicaId}`,
          carrier_format: "jj-sync/git-carrier-v2",
          carrier_commit_id: carrierCommitId,
          bundle: {
            path: `jj-sync/bundles/${carrierDigest}.json`,
            sha256: carrierDigest,
            byte_length: 1,
            media_type: "application/vnd.jj-sync.native-bundle+json",
          },
        },
      },
    ),
    agentContextTemplate(
      KIND_JJ_REVISION,
      options.createdAt + 1,
      "jj-revision",
      [
        ["r", ids.scopeId],
        ["c", ids.initialCommitId],
        ["i", bodies.initialRevision.change_id_hex],
        ["x", bodies.initialRevision.projection_digest],
        ...baseTags,
      ],
      bodies.initialRevision,
    ),
    agentContextTemplate(
      KIND_JJ_REVISION,
      options.createdAt + 2,
      "jj-revision",
      [
        ["r", ids.scopeId],
        ["c", ids.agentCommitId],
        ["i", bodies.agentRevision.change_id_hex],
        ["x", bodies.agentRevision.projection_digest],
        ...baseTags,
      ],
      bodies.agentRevision,
    ),
    agentContextTemplate(
      KIND_JJ_VIEW,
      options.createdAt + 3,
      "jj-view",
      [
        ["r", ids.scopeId],
        ["v", ids.viewId],
        ["x", bodies.view.projection_digest],
        ...baseTags,
      ],
      bodies.view,
    ),
    agentContextTemplate(
      KIND_JJ_OPERATION_GRAPH,
      options.createdAt + 4,
      "jj-operation-graph",
      [
        ["r", ids.scopeId],
        ["o", ids.operationId],
        ["v", ids.viewId],
        ["x", bodies.operationGraph.projection_digest],
        ...baseTags,
      ],
      bodies.operationGraph,
    ),
    agentContextTemplate(
      KIND_JJ_GRAPH_MANIFEST,
      options.createdAt + 5,
      "jj-graph-manifest",
      [
        ["r", ids.scopeId],
        ["o", ids.operationId],
        ["v", ids.viewId],
        ["x", bodies.graphManifest.projection_digest],
        ...baseTags,
      ],
      bodies.graphManifest,
    ),
    ...bodies.page.records.map((record, index) =>
      agentContextTemplate(
        KIND_JJ_AGENT_CONTEXT_PAGE,
        options.createdAt + 6,
        "jj-agent-context-page",
        [
          ["r", ids.scopeId],
          ["o", ids.operationId],
          ["d", ids.spanId],
          ["sequence", "0"],
          ...baseTags,
        ],
        {
          ...bodies.page,
          version: 3,
          checkpoint_id: ids.spanId,
          records: [record],
        },
      ),
    ),
  ];
  return {
    publications,
    contextPageIndex: 6,
    contextPageIndices: bodies.page.records.map((_, index) => 6 + index),
    checkpointManifest: (pageEventIds) =>
      agentContextTemplate(
        KIND_JJ_CHECKPOINT_MANIFEST,
        options.createdAt + 7,
        "jj-checkpoint-manifest",
        [
          ["r", ids.scopeId],
          ["o", ids.operationId],
          ["d", ids.checkpointId],
          ["sequence", "1"],
          ...baseTags,
        ],
        {
          schema: "jj-sync/checkpoint-manifest",
          version: 3,
          begin_operation_id: ids.operationId,
          targets: [
            {
              commit_id: ids.agentCommitId,
              change_id_hex: bodies.agentRevision.change_id_hex,
            },
          ],
          ...(options.agentPubkey
            ? {
                actor: {
                  agent_id: "local-agent",
                  pubkey: options.agentPubkey,
                  name: "Owen Local",
                  email: bodies.agentRevision.author.email,
                },
              }
            : {}),
          checkpoint_id: ids.checkpointId,
          span_id: ids.spanId,
          scope_id: ids.scopeId,
          operation_id: ids.operationId,
          page_event_ids:
            typeof pageEventIds === "string" ? [pageEventIds] : pageEventIds,
          record_count: bodies.page.records.length,
          complete: true,
          outcome: "completed",
        },
      ),
  };
}
