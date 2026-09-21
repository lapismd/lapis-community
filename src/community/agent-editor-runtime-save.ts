import type {
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-contracts.js";
import { isRuntimeThinking } from "./agent-runtime-thinking.js";

export function editorRuntimeSaveInput(
  runtimeAgent: string,
  selection: { model?: string; thinking?: string },
  thinkingOptions: readonly CommunityAgentRuntimeOption[],
): {
  runtimeAgent: string;
  model?: string;
  thinking?: CommunityAgentRuntimeThinking;
} {
  const thinking =
    thinkingOptions.length > 0 &&
    selection.thinking &&
    thinkingOptions.some((option) => option.value === selection.thinking) &&
    isRuntimeThinking(selection.thinking)
      ? selection.thinking
      : undefined;
  return {
    runtimeAgent,
    ...(selection.model ? { model: selection.model } : {}),
    ...(thinking ? { thinking } : {}),
  };
}
