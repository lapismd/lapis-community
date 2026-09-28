import type { CommunityMessageModel } from "../community-workspace/model.js";

const THREAD_DEPTH_STEP_REM = 2.25;
const MAX_VISIBLE_THREAD_DEPTH = 6;

export interface ThreadTreeRow {
  message: CommunityMessageModel;
  depth: number;
  indentRem: number;
  connectorIndentRem?: number;
  guideIndentRems: readonly number[];
  connectsToChildren: boolean;
}

export interface ThreadTreeLayout {
  messages: readonly CommunityMessageModel[];
  rowsById: ReadonlyMap<string, ThreadTreeRow>;
}

function visibleDepth(depth: number): number {
  return Math.min(Math.max(depth - 1, 0), MAX_VISIBLE_THREAD_DEPTH);
}

export function threadTreeIndentRem(depth: number): number {
  return visibleDepth(depth) * THREAD_DEPTH_STEP_REM;
}

/**
 * Keep sibling chronology while placing every nested branch directly after its
 * parent, matching Buzz's thread-panel tree rather than a flat event timeline.
 */
export function projectThreadTree(
  messages: readonly CommunityMessageModel[],
  rootId: string,
): ThreadTreeLayout {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const childrenByParent = new Map<string, CommunityMessageModel[]>();

  for (const message of messages) {
    if (message.id === rootId) continue;
    const requestedParent = message.parentMessageId;
    const parentId =
      requestedParent &&
      requestedParent !== message.id &&
      byId.has(requestedParent)
        ? requestedParent
        : rootId;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(message);
    childrenByParent.set(parentId, children);
  }

  const rows: ThreadTreeRow[] = [];
  const visited = new Set<string>();

  const visit = (
    message: CommunityMessageModel,
    depth: number,
    guideDepths: readonly number[],
  ): void => {
    if (visited.has(message.id)) return;
    visited.add(message.id);
    const children = (childrenByParent.get(message.id) ?? []).filter(
      (child) => !visited.has(child.id),
    );
    rows.push({
      message,
      depth,
      indentRem: threadTreeIndentRem(depth),
      ...(depth > 1
        ? { connectorIndentRem: threadTreeIndentRem(depth - 1) }
        : {}),
      guideIndentRems: guideDepths.map(threadTreeIndentRem),
      connectsToChildren: depth > 0 && children.length > 0,
    });

    children.forEach((child, index) => {
      const childGuides = [...guideDepths];
      if (depth > 0 && index < children.length - 1) childGuides.push(depth);
      visit(child, depth + 1, childGuides);
    });
  };

  const root = byId.get(rootId);
  if (root) visit(root, 0, []);
  for (const message of messages) {
    if (!visited.has(message.id))
      visit(message, message.id === rootId ? 0 : 1, []);
  }

  return {
    messages: rows.map(({ message }) => message),
    rowsById: new Map(rows.map((row) => [row.message.id, row])),
  };
}
