export type CommunityAgentRuntimeSetControl = {
  version: 2;
  command: "runtime_set";
  requestId: string;
  runtimeAgent?: string;
  model?: string;
  thinking?: "off" | "low" | "medium" | "high" | "xhigh";
  permissionMode?: string;
};

const RUNTIME_SET_KEYS = [
  "version",
  "command",
  "requestId",
  "runtimeAgent",
  "model",
  "thinking",
  "permissionMode",
] as const;

export function assertRuntimeSet(
  control: CommunityAgentRuntimeSetControl,
): void {
  const allowed = new Set<string>(RUNTIME_SET_KEYS);
  const permissionMode = control.permissionMode;
  if (
    !Object.keys(control).every((key) => allowed.has(key)) ||
    ![
      control.runtimeAgent,
      control.model,
      control.thinking,
      permissionMode,
    ].some((value) => value !== undefined) ||
    [control.runtimeAgent, control.model].some(
      (value) => value !== undefined && (!value.trim() || value.length > 256),
    ) ||
    (control.thinking !== undefined &&
      !["off", "low", "medium", "high", "xhigh"].includes(control.thinking)) ||
    (permissionMode !== undefined &&
      (!permissionMode.trim() || permissionMode.length > 64))
  )
    throw new Error("Agent runtime defaults are invalid");
}
