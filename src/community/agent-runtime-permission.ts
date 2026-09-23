import type { CommunityAgentRuntimeOption } from "./agent-runtime-contracts.js";
import { editorRuntimeSaveInput } from "./agent-editor-runtime-save.js";

export function runtimePermissionOptions(
  catalog?: {
    configOptions?: readonly {
      id: string;
      options?: readonly CommunityAgentRuntimeOption[];
    }[];
  } | null,
): CommunityAgentRuntimeOption[] {
  return [
    ...(catalog?.configOptions?.find((option) => option.id === "mode")
      ?.options ?? []),
  ];
}

export function editorRuntimePermissionSave(
  runtimeAgent: string,
  selection: { model?: string; thinking?: string; permissionMode?: string },
  thinkingOptions: readonly CommunityAgentRuntimeOption[],
  permissionOptions: readonly CommunityAgentRuntimeOption[],
): ReturnType<typeof editorRuntimeSaveInput> & { permissionMode?: string } {
  const saved = editorRuntimeSaveInput(
    runtimeAgent,
    selection,
    thinkingOptions,
  );
  const permissionMode =
    selection.permissionMode &&
    permissionOptions.some((option) => option.value === selection.permissionMode)
      ? selection.permissionMode
      : undefined;
  return {
    ...saved,
    ...(permissionMode ? { permissionMode } : {}),
  };
}
