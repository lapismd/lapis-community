import type {
  RichFileEdit,
  RichSearchMatch,
  RichTranscriptToolDetail,
  TranscriptToolEntry,
} from "./transcript-tool-rich.js";

const SHELL_TOOLS = new Set([
  "bash",
  "command",
  "exec",
  "execute",
  "run",
  "shell",
  "sh",
  "terminal",
]);
const SEARCH_COMMAND = /^(?:rg|grep|find)\b/u;
const EDIT_NAME =
  /(?:apply[_ -]?patch|edit|write|replace|update).*(?:file|source|patch)?|(?:file|source|patch).*(?:edit|write|replace|update)/iu;

export function detectRichTranscriptToolDetail(
  tool: TranscriptToolEntry,
): RichTranscriptToolDetail | undefined {
  const input = displayValue(tool.input);
  const output = displayValue(tool.output);
  const error = displayValue(tool.error);
  const fileEdit = fileEditDetail(tool, input, output);
  if (fileEdit) return fileEdit;
  const command = commandForTool(tool, input);
  const search = searchDetail(command, input, output);
  if (search) return search;
  const shell = shellDetail(tool, command, output, error);
  if (shell) return shell;
}

function fileEditDetail(
  tool: TranscriptToolEntry,
  input: unknown,
  output: unknown,
): RichTranscriptToolDetail | undefined {
  if (!EDIT_NAME.test(tool.name)) return;
  const candidates = dedupeFileEdits([
    ...fileEditsFromValue(input),
    ...fileEditsFromValue(output),
  ]);
  if (candidates.length) return { kind: "file-edit", files: candidates };
  const patch = patchText(output) ?? patchText(input);
  if (!patch) return;
  const path =
    pathFromPatch(patch) ||
    pathFromRecord(record(input)) ||
    pathFromRecord(record(output));
  if (!path) return;
  return { kind: "file-edit", files: [fileEdit(path, { patch })] };
}

function dedupeFileEdits(files: RichFileEdit[]): RichFileEdit[] {
  return [...new Map(files.map((file) => [file.path, file])).values()];
}

function fileEditsFromValue(value: unknown): RichFileEdit[] {
  const direct = fileEditFromRecord(record(value));
  if (direct) return [direct];
  const files = Array.isArray(value)
    ? value
    : (arrayFromRecord(value, "files") ?? arrayFromRecord(value, "changes"));
  if (!files) return [];
  return files.flatMap((item) => {
    const edit = fileEditFromRecord(record(item));
    return edit ? [edit] : [];
  });
}

function fileEditFromRecord(value: Record<string, unknown> | undefined) {
  if (!value) return;
  const content = stringValue(value.content ?? value.text);
  const patch =
    stringValue(
      value.patch ?? value.diff ?? value.unifiedPatch ?? value.unified_diff,
    ) ?? patchText(content);
  const path =
    pathFromRecord(value) || (patch ? pathFromPatch(patch) : undefined);
  if (!path) return;
  if (patch) return fileEdit(path, { patch });
  const oldText = stringValue(
    value.oldText ?? value.before ?? value.original ?? value.previous,
  );
  const newText = stringValue(
    value.newText ?? value.after ?? value.updated ?? content,
  );
  if (oldText === undefined && newText === undefined) return;
  return fileEdit(path, { oldText: oldText ?? null, newText: newText ?? "" });
}

function fileEdit(
  path: string,
  input: { patch?: string; oldText?: string | null; newText?: string | null },
): RichFileEdit {
  const stats = input.patch
    ? patchStats(input.patch)
    : textStats(input.oldText ?? "", input.newText ?? "");
  return { path, ...input, ...stats };
}

function shellDetail(
  tool: TranscriptToolEntry,
  command: string | undefined,
  output: unknown,
  error: unknown,
): RichTranscriptToolDetail | undefined {
  const name = normalized(tool.name);
  const shellTool = SHELL_TOOLS.has(name) || command !== undefined;
  if (!shellTool || !command) return;
  const body = outputText(output);
  const errorText = outputText(error) ?? stderrText(output);
  return {
    kind: "shell",
    command,
    ...(body ? { output: body } : {}),
    ...(errorText ? { error: errorText } : {}),
  };
}

function searchDetail(
  command: string | undefined,
  input: unknown,
  output: unknown,
): RichTranscriptToolDetail | undefined {
  if (!command || !SEARCH_COMMAND.test(command.trim())) return;
  const body = outputText(output);
  const matches = body ? searchMatches(body) : [];
  if (matches.length === 0) return;
  const query = queryFromValue(input) ?? queryFromCommand(command);
  return {
    kind: "search",
    command,
    ...(query ? { query } : {}),
    matches,
    ...(body ? { output: body } : {}),
  };
}

function searchMatches(text: string): RichSearchMatch[] {
  return text.split(/\r?\n/u).flatMap((line) => {
    const match = /^(.*?):(\d+)(?::(\d+))?:(.*)$/u.exec(line);
    if (!match) return [];
    return [
      {
        path: match[1]!,
        line: Number(match[2]),
        ...(match[3] ? { column: Number(match[3]) } : {}),
        text: match[4]!.trim(),
      },
    ];
  });
}

function commandForTool(
  tool: TranscriptToolEntry,
  input: unknown,
): string | undefined {
  const source = record(input);
  const command = stringValue(source?.command ?? source?.cmd);
  if (command) return command;
  const name = tool.name.trim();
  const ran = /^Ran\s+(.+)$/iu.exec(name);
  if (ran?.[1]) return ran[1].trim();
  if (SHELL_TOOLS.has(normalized(name)) && typeof input === "string")
    return input.trim() || undefined;
}

function displayValue(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  let current: unknown = value;
  for (let index = 0; index < 3; index += 1) {
    const parsed = parseJson(current);
    if (parsed === undefined) break;
    current = parsed;
  }
  return current;
}

function outputText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const source = record(value);
  if (!source) return;
  for (const key of ["stdout", "output", "text", "content", "result"]) {
    const text = stringValue(source[key]);
    if (text) return text;
  }
}

function stderrText(value: unknown): string | undefined {
  return stringValue(record(value)?.stderr);
}

function queryFromValue(value: unknown): string | undefined {
  const source = record(value);
  return stringValue(source?.query ?? source?.pattern);
}

function queryFromCommand(command: string): string | undefined {
  const quoted = /['"]([^'"]+)['"]/u.exec(command);
  if (quoted?.[1]) return quoted[1];
  const parts = command
    .trim()
    .split(/\s+/u)
    .filter((part) => !part.startsWith("-"));
  return parts.length > 1 ? parts[1] : undefined;
}

function patchText(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  if (/^diff --git /mu.test(value) || /^@@ /mu.test(value)) return value;
}

function patchStats(patch: string) {
  return {
    additions: (patch.match(/^\+(?!\+\+)/gmu) ?? []).length,
    deletions: (patch.match(/^-(?!--)/gmu) ?? []).length,
  };
}

function textStats(oldText: string, newText: string) {
  const oldLines = countedTextLines(oldText);
  const newLines = countedTextLines(newText);
  return { additions: newLines.length, deletions: oldLines.length };
}

function countedTextLines(text: string) {
  const lines = text.split(/\r?\n/u);
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

function pathFromRecord(value: Record<string, unknown> | undefined) {
  return stringValue(
    value?.path ?? value?.file ?? value?.filePath ?? value?.target,
  );
}

function pathFromPatch(patch: string): string | undefined {
  return (
    /diff --git a\/(.+?) b\//u.exec(patch)?.[1] ??
    /^\+\+\+ b\/(.+)$/mu.exec(patch)?.[1]
  );
}

function arrayFromRecord(value: unknown, key: string): unknown[] | undefined {
  const items = record(value)?.[key];
  return Array.isArray(items) ? items : undefined;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^[{["]/u.test(trimmed)) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalized(value: string): string {
  return value.trim().toLowerCase().split(/[:/]/u).at(-1) ?? "";
}
