import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import { detectRichTranscriptToolDetail } from "./transcript-tool-rich-detail.js";

export type TranscriptToolEntry = Extract<
  CommunityAgentTranscriptEntry,
  { type: "tool" }
>;

export type RichFileEdit = {
  path: string;
  patch?: string;
  oldText?: string | null;
  newText?: string | null;
  additions: number;
  deletions: number;
};

export type RichSearchMatch = {
  path: string;
  line?: number;
  column?: number;
  text: string;
};

export type RichTranscriptToolDetail =
  | { kind: "file-edit"; files: readonly RichFileEdit[] }
  | {
      kind: "shell";
      command: string;
      output?: string;
      error?: string;
    }
  | {
      kind: "search";
      command?: string;
      query?: string;
      matches: readonly RichSearchMatch[];
      output?: string;
    };

const READ_NAME = /(?:read|open|load|cat|view).*(?:file|source|skill)?/iu;
const LOAD_TOOL_NAME =
  /(?:load|read).*skill|(?:skill|tool).*loaded|loaded.*(?:skill|tool)/iu;

export const richTranscriptToolDetail = detectRichTranscriptToolDetail;

export function richTranscriptToolLabel(
  tool: TranscriptToolEntry,
): string | undefined {
  const rich = richTranscriptToolDetail(tool);
  if (rich?.kind === "file-edit") return "Edited file";
  if (rich?.kind === "shell") return `Ran ${truncate(rich.command, 72)}`;
  if (rich?.kind === "search") {
    const target = rich.query || rich.command;
    return target ? `Searched for ${truncate(target, 72)}` : "Searched";
  }
}

export function transcriptToolGroupLabel(
  tools: readonly TranscriptToolEntry[],
): string | undefined {
  if (tools.length < 2) return;
  const labels = new Set<string>();
  for (const tool of tools) {
    const rich = richTranscriptToolDetail(tool);
    if (rich?.kind === "file-edit") labels.add("edited files");
    else if (rich?.kind === "search") labels.add("searched");
    else if (rich?.kind === "shell") labels.add("ran commands");
    else if (LOAD_TOOL_NAME.test(tool.name)) labels.add("loaded a tool");
    else if (READ_NAME.test(tool.name)) labels.add("read files");
  }
  const ordered = [
    "loaded a tool",
    "read files",
    "searched",
    "ran commands",
    "edited files",
  ].filter((label) => labels.has(label));
  if (ordered.length < 2) return;
  return `${ordered[0]![0]!.toUpperCase()}${ordered[0]!.slice(1)}, ${ordered.slice(1).join(", ")}`;
}

export function fileEditStats(
  detail: RichTranscriptToolDetail | undefined,
): { additions: number; deletions: number } | undefined {
  if (detail?.kind !== "file-edit") return;
  return detail.files.reduce(
    (total, file) => ({
      additions: total.additions + file.additions,
      deletions: total.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}
