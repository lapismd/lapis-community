/** Synthetic sanitized transport records shared by local fixtures and functional stories. */
export function canonicalFixtureRecord(
  payload: Record<string, unknown>,
  sequence: number,
  at = 1_700_000_000_000,
) {
  return {
    schema: "lapis.transcript/1",
    id: `canonical-${sequence}`,
    sessionId: "fixture-session",
    threadId: "fixture-session",
    turnId: "fixture-turn",
    attemptId: "fixture-attempt",
    sequence,
    at,
    source: { provider: "fixture" },
    payload,
    coverage: {
      mode: "external-acp",
      observations: "normalized",
      gaps: [
        "native-agent-storage",
        "native-provider-traffic",
        "unexposed-acp-updates",
      ],
    },
    sanitization: {
      version: 1,
      policy: "fixture-sanitized/1",
      coverage: "portable",
      redacted: true,
      pathsNormalized: true,
    },
  };
}

export function canonicalLocalRecords(
  createdAt: number,
  source?: { request: string; response: string; owner: string },
  agent?: string,
) {
  const payloads = [
    {
      kind: "message",
      role: "user",
      messageId: "request",
      text: "Add agent context beside the local repository history.",
    },
    {
      kind: "plan",
      entries: [
        {
          content: "Inspect README and update the checkpoint guide",
          status: "completed",
        },
      ],
    },
    {
      kind: "thinking",
      visible: true,
      blockId: "thinking",
      text: "I’ll inspect the README and keep the explanation beside the checkpoint.",
    },
    {
      kind: "tool-invocation",
      invocationId: "edit",
      name: "apply_patch",
      input: { path: "$WORKSPACE[local]/README.md" },
      execution: "observed",
    },
    {
      kind: "tool-result",
      invocationId: "edit",
      outcome: "succeeded",
      output: "Success. Updated README.md",
    },
    {
      kind: "permission",
      interactionId: "perm-1",
      name: "apply_patch",
      state: "resolved",
      decision: "allow_once",
      options: ["allow_once", "deny"],
    },
    { kind: "usage", used: 8, limit: 10 },
    {
      kind: "message",
      role: "assistant",
      messageId: "response",
      text: "Published the checkpoint with collaborator-visible context.",
    },
  ];
  return payloads.map((payload, index) => {
    const record = canonicalFixtureRecord(
      payload,
      index + 1,
      (createdAt + 5) * 1000 + index * 50,
    );
    return {
      id: record.id,
      sequence: record.sequence,
      created_at_ms: record.at,
      kind: "transcript",
      text: JSON.stringify(record),
      ...(source && payload.kind === "message"
        ? {
            source_event_id:
              payload.role === "user" ? source.request : source.response,
            author_pubkey: payload.role === "user" ? source.owner : agent,
          }
        : {}),
    };
  });
}
