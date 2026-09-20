export type CommunityAgentTranscriptEntry =
  | {
      id: string;
      type: "message";
      role: "user" | "assistant";
      text: string;
      authorPubkey: string;
      createdAt: string;
      sourceEventId?: string;
      sequence?: number;
      truncated?: boolean;
      redacted?: boolean;
    }
  | {
      id: string;
      type: "thinking";
      text: string;
      state: "streaming" | "done";
      createdAt: string;
      sequence?: number;
      truncated?: boolean;
      redacted?: boolean;
    }
  | {
      id: string;
      type: "tool";
      toolId: string;
      name: string;
      state: "running" | "completed" | "error";
      input?: string;
      output?: string;
      error?: string;
      createdAt: string;
      sequence?: number;
      truncated?: boolean;
      redacted?: boolean;
    }
  | {
      id: string;
      type: "permission";
      requestId: string;
      tool: string;
      input?: string;
      options: string[];
      state: "pending" | "resolved";
      decision?: string;
      createdAt: string;
      sequence?: number;
    }
  | {
      id: string;
      type: "turn";
      state: "started" | "completed" | "failed" | "cancelled";
      message?: string;
      createdAt: string;
      sequence?: number;
    }
  | {
      id: string;
      type: "context";
      label: string;
      text: string;
      createdAt: string;
      sequence?: number;
    };
