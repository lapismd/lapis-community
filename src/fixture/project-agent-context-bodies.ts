import { createHash } from "node:crypto";

export const LOCAL_AGENT_CONTEXT_IDS = {
  scopeId: "019d0000-0000-7000-8000-000000000001",
  replicaId: "019d0000-0000-7000-8000-000000000002",
  operationId: "3".repeat(128),
  viewId: "4".repeat(128),
  initialCommitId: "1".repeat(40),
  agentCommitId: "2".repeat(40),
  checkpointId: "local-agent-context-checkpoint",
  spanId: "local-agent-context-span",
} as const;

const nativeProfile =
  "jj-exact-v1:7627c80c16eccd7800647e670f676d56d73c3e0f72f6d093de0316d767f9628e";
const projectionProfile = "jj-graph-v1";

export function createLocalProjectAgentContextBodies(createdAt: number) {
  const ids = LOCAL_AGENT_CONTEXT_IDS;
  const person = {
    name: "Owen Local",
    email: "owen@example.test",
    timestamp_ms: (createdAt + 2) * 1_000,
    tz_offset_minutes: 0,
  };
  const initialRevision = projection({
    schema: "jj-sync/revision",
    version: 1,
    scope_id: ids.scopeId,
    native_profile: nativeProfile,
    projection_profile: projectionProfile,
    git_object_format: "sha1",
    commit_id: ids.initialCommitId,
    change_id_hex: "a".repeat(32),
    node_kind: "commit",
    parent_commit_ids: [],
    description: "Initialize the local Community project",
    author: person,
    committer: person,
    facts: { has_conflict: false, is_empty: false },
    metadata_disclosure: "full",
  });
  const agentRevision = projection({
    schema: "jj-sync/revision",
    version: 1,
    scope_id: ids.scopeId,
    native_profile: nativeProfile,
    projection_profile: projectionProfile,
    git_object_format: "sha1",
    commit_id: ids.agentCommitId,
    change_id_hex: "b".repeat(32),
    node_kind: "commit",
    parent_commit_ids: [ids.initialCommitId],
    description: "Show agent context beside JJ revisions",
    author: person,
    committer: person,
    facts: { has_conflict: false, is_empty: false },
    metadata_disclosure: "full",
  });
  const view = projection({
    schema: "jj-sync/view",
    version: 1,
    scope_id: ids.scopeId,
    native_profile: nativeProfile,
    projection_profile: projectionProfile,
    view_id: ids.viewId,
    head_commit_ids: [ids.agentCommitId],
    local_bookmarks: [
      {
        name: "main",
        target: { state: "resolved", commit_id: ids.agentCommitId },
      },
    ],
    local_tags: [],
    remote_bookmarks: [],
    remote_tags: [],
    workspaces: [
      {
        native_workspace_name: "default",
        working_copy_commit_id: ids.agentCommitId,
      },
    ],
    git_head: { state: "resolved", commit_id: ids.agentCommitId },
  });
  const operationGraph = projection({
    schema: "jj-sync/operation-graph",
    version: 1,
    scope_id: ids.scopeId,
    native_profile: nativeProfile,
    projection_profile: projectionProfile,
    operation_id: ids.operationId,
    view_id: ids.viewId,
    parent_operation_ids: [],
    metadata: {
      description: "checkpoint agent context",
      started_at_ms: (createdAt + 1) * 1_000,
      ended_at_ms: (createdAt + 4) * 1_000,
      is_snapshot: false,
      native_workspace_name: "default",
    },
    evolution: {
      recording: "recorded",
      evidence_model: "operation-native",
      entries: [{ commit_id: ids.agentCommitId, predecessor_commit_ids: [] }],
    },
  });
  const graphManifest = projection({
    schema: "jj-sync/graph-publication",
    version: 1,
    scope_id: ids.scopeId,
    native_profile: nativeProfile,
    projection_profile: projectionProfile,
    context: { operation_id: ids.operationId, view_id: ids.viewId },
    selection: {
      policy_id: "workspace-heads-and-context-v1",
      seed_commit_ids: [ids.agentCommitId],
      ancestor_budget: 500,
    },
    required_records: [
      record("operation", ids.operationId, operationGraph.projection_digest),
      record("view", ids.viewId, view.projection_digest),
      record(
        "revision",
        ids.initialCommitId,
        initialRevision.projection_digest,
      ),
      record("revision", ids.agentCommitId, agentRevision.projection_digest),
    ],
    boundaries: [],
    evolution_context: {
      start_operation_id: ids.operationId,
      covered_operation_ids: [ids.operationId],
      boundary_operation_ids: [],
      status: "complete",
    },
  });
  const page = {
    schema: "jj-sync/agent-context-page",
    version: 1,
    checkpoint_id: ids.checkpointId,
    span_id: ids.spanId,
    scope_id: ids.scopeId,
    operation_id: ids.operationId,
    page_index: 0,
    page_count: 1,
    records: [
      {
        id: "local-user-message",
        sequence: 0,
        created_at_ms: (createdAt + 5) * 1_000,
        kind: "user_message",
        text: "Add agent context beside the local repository history.",
      },
      {
        id: "local-tool-call",
        sequence: 1,
        created_at_ms: (createdAt + 5) * 1_000 + 100,
        kind: "tool",
        tool_name: "apply_patch",
        tool_state: "completed",
      },
      {
        id: "local-assistant-message",
        sequence: 2,
        created_at_ms: (createdAt + 5) * 1_000 + 200,
        kind: "assistant_message",
        text: "Published the checkpoint with collaborator-visible context.",
      },
    ],
  };
  return {
    initialRevision,
    agentRevision,
    view,
    operationGraph,
    graphManifest,
    page,
    nativeProfile,
  };
}

function projection<T extends Record<string, unknown>>(
  value: T,
): T & { projection_digest: string } {
  return { ...value, projection_digest: digest(value) };
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function record(type: string, nativeId: string, digestValue: string) {
  return { type, native_id: nativeId, digest: digestValue };
}
