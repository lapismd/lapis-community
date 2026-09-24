import type { CommunityAgentControl } from "./agent-contracts.js";
import { assertRuntimeSet } from "./agent-runtime-set.js";

const AGENT_PERMISSION_DECISIONS = new Set([
  "allow_once",
  "allow_always",
  "reject_once",
  "reject_always",
  "cancel",
]);

export function validateAgentControl(control: CommunityAgentControl): void {
  if (control.command === "continue_turn") {
    const fields = [
      "requestId",
      "targetRequestId",
      "scopeKey",
      "expectedSessionId",
      "expectedTurnId",
    ] as const;
    if (
      control.version !== 2 ||
      !hasOnlyObjectKeys(control, ["version", "command", ...fields]) ||
      fields.some((key) => !control[key]?.trim() || control[key].length > 2048)
    )
      throw new Error("Agent continuation target is invalid");
    return;
  }
  const versionTwo = new Set([
    "sync_activity",
    "runtime_get",
    "runtime_set",
    "processing_get",
    "processing_set",
    "memory_list",
    "memory_action",
  ]).has(control.command);
  if (
    (versionTwo && control.version !== 2) ||
    (!versionTwo && control.version !== 1)
  )
    throw new Error("Unsupported agent control version");
  const channelId = "channelId" in control ? control.channelId : undefined;
  if (channelId !== undefined && (!channelId.trim() || channelId.length > 512))
    throw new Error("Agent control channel is invalid");
  if (
    control.command === "cancel_turn" ||
    control.command === "reset_conversation"
  ) {
    if (!control.scopeKey.trim() || control.scopeKey.length > 4_096)
      throw new Error("Agent control scope is invalid");
    return;
  }
  if (control.command === "sync_activity") {
    if (
      !hasOnlyObjectKeys(control as unknown as Record<string, unknown>, [
        "version",
        "command",
        "requestId",
        "context",
        "cursor",
        "highWaterMark",
        "notBefore",
        "channelId",
      ])
    )
      throw new Error("Agent activity control contains unknown fields");
    if (!control.requestId.trim() || control.requestId.length > 128)
      throw new Error("Agent activity request is invalid");
    const context = control.context;
    if (
      !context ||
      !["dm", "channel", "thread", "forum-topic"].includes(context.kind) ||
      (context.kind === "dm" &&
        (!hasOnlyObjectKeys(context, ["kind", "conversationId"]) ||
          (context.conversationId !== undefined &&
            !/^[0-9a-f]{64}$/.test(context.conversationId)))) ||
      (context.kind !== "dm" &&
        (!context.channelId.trim() || context.channelId.length > 256)) ||
      (context.kind === "channel" &&
        !hasOnlyObjectKeys(context, ["kind", "channelId"])) ||
      ((context.kind === "thread" || context.kind === "forum-topic") &&
        (!hasOnlyObjectKeys(context, ["kind", "channelId", "threadRootId"]) ||
          !context.threadRootId.trim() ||
          context.threadRootId.length > 256)) ||
      (context.kind === "dm" && control.channelId !== undefined) ||
      (context.kind !== "dm" && control.channelId !== context.channelId) ||
      (control.cursor !== undefined &&
        (!hasOnlyObjectKeys(control.cursor, ["streamId", "offset"]) ||
          !control.cursor.streamId ||
          control.cursor.streamId.length > 128 ||
          !Number.isSafeInteger(control.cursor.offset) ||
          control.cursor.offset < 0)) ||
      (control.highWaterMark !== undefined &&
        (!Number.isSafeInteger(control.highWaterMark) ||
          control.highWaterMark < 0)) ||
      (control.notBefore !== undefined &&
        (!Number.isSafeInteger(control.notBefore) || control.notBefore < 0))
    )
      throw new Error("Agent activity context or cursor is invalid");
    return;
  }
  if (
    versionTwo &&
    (!control.requestId.trim() || control.requestId.length > 128)
  )
    throw new Error("Agent administration request is invalid");
  if (
    control.command === "processing_get" ||
    control.command === "processing_set"
  ) {
    if (
      !hasOnlyObjectKeys(
        control,
        control.command === "processing_get"
          ? ["version", "command", "requestId"]
          : ["version", "command", "requestId", "enabled", "expectedRevision"],
      ) ||
      (control.command === "processing_set" &&
        (typeof control.enabled !== "boolean" ||
          !Number.isSafeInteger(control.expectedRevision) ||
          control.expectedRevision < 0))
    )
      throw new Error("Agent processing request is invalid");
    return;
  }
  if (control.command === "runtime_get") {
    if (!hasOnlyObjectKeys(control, ["version", "command", "requestId"]))
      throw new Error("Agent runtime request contains unknown fields");
    return;
  }
  if (control.command === "runtime_set") {
    assertRuntimeSet(control);
    return;
  }
  if (control.command === "memory_list") {
    if (
      !hasOnlyObjectKeys(control, [
        "version",
        "command",
        "requestId",
        "channelId",
        "status",
        "query",
      ]) ||
      (control.status !== undefined &&
        !["approved", "review", "rejected", "retracted"].includes(
          control.status,
        )) ||
      (control.query !== undefined && control.query.length > 256)
    )
      throw new Error("Agent memory query is invalid");
    return;
  }
  if (control.command === "memory_action") {
    const candidateAction =
      control.action === "approve" || control.action === "reject";
    if (
      !hasOnlyObjectKeys(control, [
        "version",
        "command",
        "requestId",
        "channelId",
        "action",
        "candidateId",
        "memoryId",
      ]) ||
      !["approve", "reject", "retract"].includes(control.action) ||
      (candidateAction &&
        (!control.candidateId || control.memoryId !== undefined)) ||
      (!candidateAction &&
        (!control.memoryId || control.candidateId !== undefined))
    )
      throw new Error("Agent memory action is invalid");
    return;
  }
  if (!control.requestId.trim() || control.requestId.length > 512)
    throw new Error("Agent permission request is invalid");
  if (!AGENT_PERMISSION_DECISIONS.has(control.decision))
    throw new Error("Agent permission decision is invalid");
}

function hasOnlyObjectKeys(value: object, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}
