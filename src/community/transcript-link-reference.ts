import type { TranscriptCommentPart } from "../protocol/transcript-comment-anchor.js";
import { normalizeHex, validId } from "./community-link-ids.js";
export interface TranscriptLinkReference {
  checkpoint?: string;
  record?: string;
  part?: TranscriptCommentPart;
}
export function transcriptLinkReference(
  params: URLSearchParams,
): TranscriptLinkReference | undefined {
  if (!["checkpoint", "record", "part"].some((key) => params.has(key)))
    return {};
  if (
    ["checkpoint", "record", "part"].some(
      (key) => params.getAll(key).length > 1,
    )
  )
    return;
  const checkpoint = normalizeHex(params.get("checkpoint"));
  const record = params.get("record"),
    part = params.get("part");
  if (
    !checkpoint ||
    !record ||
    !validId(record) ||
    (part !== null && !/^(?:text|input|output|error|plan:\d+)$/u.test(part))
  )
    return;
  return {
    checkpoint,
    record,
    ...(part ? { part: part as TranscriptCommentPart } : {}),
  };
}
export function appendTranscriptReference(
  params: URLSearchParams,
  reference: TranscriptLinkReference,
) {
  for (const key of ["checkpoint", "record", "part"] as const)
    if (reference[key] !== undefined) params.set(key, reference[key]);
  if (!transcriptLinkReference(params))
    throw new Error("Invalid transcript item reference");
}
