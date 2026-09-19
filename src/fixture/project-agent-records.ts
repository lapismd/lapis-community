/** Public fixture records exercise complete messages, visible thinking and finished tools. */
export function localAgentRecords(
  createdAt: number,
  sourceMessages?: { request: string; response: string; owner: string },
  agentPubkey?: string,
) {
  return [
    {
      id: "local-user-message",
      sequence: 0,
      created_at_ms: (createdAt + 5) * 1_000,
      kind: "user_message",
      ...(sourceMessages
        ? {
            source_event_id: sourceMessages.request,
            author_pubkey: sourceMessages.owner,
          }
        : {}),
      text: "Add agent context beside the local repository history.",
    },
    {
      id: "local-thinking",
      sequence: 1,
      created_at_ms: (createdAt + 5) * 1_000 + 50,
      kind: "thinking",
      text: "I’ll inspect the README and keep the explanation beside the checkpoint.",
    },
    {
      id: "local-tool-call",
      sequence: 2,
      created_at_ms: (createdAt + 5) * 1_000 + 100,
      kind: "tool",
      text: undefined,
      tool_name: "apply_patch",
      tool_id: "local-readme-edit",
      input:
        "*** Update File: README.md\n+Agent checkpoints keep code and conversation together.",
      output: "Success. Updated README.md",
      tool_state: "completed",
    },
    {
      id: "local-assistant-message",
      sequence: 3,
      created_at_ms: (createdAt + 5) * 1_000 + 200,
      kind: "assistant_message",
      ...(sourceMessages
        ? {
            source_event_id: sourceMessages.response,
            author_pubkey: agentPubkey,
          }
        : {}),
      text: "Published the checkpoint with collaborator-visible context.",
    },
  ];
}
