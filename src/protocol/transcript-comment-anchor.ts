export type TranscriptCommentPart =
  | "text"
  | "input"
  | "output"
  | "error"
  | `plan:${number}`;
export interface TranscriptSelection {
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
}
export interface TranscriptCommentAnchor {
  checkpointEventId: string;
  recordId: string;
  part?: TranscriptCommentPart;
  selection?: TranscriptSelection;
}
const splitsPair = (text: string, offset: number) =>
  /[\uD800-\uDBFF]/u.test(text[offset - 1] ?? "") &&
  /[\uDC00-\uDFFF]/u.test(text[offset] ?? "");
export function makeTranscriptSelection(
  text: string,
  start: number,
  end: number,
): TranscriptSelection | undefined {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > text.length ||
    end - start > 4096 ||
    splitsPair(text, start) ||
    splitsPair(text, end)
  )
    return;
  return {
    start,
    end,
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - 64), start),
    suffix: text.slice(end, end + 64),
  };
}
export function validTranscriptSelection(
  text: string,
  value: unknown,
): value is TranscriptSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { start, end, exact, prefix, suffix } = value as TranscriptSelection;
  const selection = makeTranscriptSelection(text, start, end);
  return (
    !!selection &&
    exact === selection.exact &&
    typeof prefix === "string" &&
    prefix.length <= 64 &&
    typeof suffix === "string" &&
    suffix.length <= 64 &&
    text.slice(Math.max(0, start - prefix.length), start) === prefix &&
    text.slice(end, end + suffix.length) === suffix
  );
}
