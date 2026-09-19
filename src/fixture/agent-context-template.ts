import type { NostrEventTemplate } from "../protocol/index.js";

export function agentContextTemplate(
  kind: number,
  createdAt: number,
  label: string,
  tags: string[][],
  content: unknown,
): NostrEventTemplate {
  return {
    kind,
    created_at: createdAt,
    tags: [["t", label], ...tags],
    content: JSON.stringify(content),
  };
}
