import { observerText } from "./agent-observer.js";
import type { CommunityAgentRuntimeValues } from "./agent-runtime-values.js";

export function optionalRuntimeDefaults(
  value: Record<string, unknown>,
): CommunityAgentRuntimeValues | undefined {
  const runtimeAgent = observerText(value.runtimeAgent, 256);
  const model = observerText(value.model, 256);
  const thinking = observerText(value.thinking, 64);
  const permissionMode = observerText(value.permissionMode, 64);
  const updatedAt = Number(value.updatedAt);
  return runtimeAgent ||
    model ||
    thinking ||
    permissionMode ||
    Number.isSafeInteger(updatedAt)
    ? {
        ...(runtimeAgent ? { runtimeAgent } : {}),
        ...(model ? { model } : {}),
        ...(thinking ? { thinking } : {}),
        ...(permissionMode ? { permissionMode } : {}),
        ...(Number.isSafeInteger(updatedAt) ? { updatedAt } : {}),
      }
    : undefined;
}
