export interface CommunityAgentRuntimeValues {
  runtimeAgent?: string;
  model?: string;
  thinking?: string;
  permissionMode?: string;
  approvalPolicy?: "ask" | "allow-all";
  updatedAt?: number;
}
