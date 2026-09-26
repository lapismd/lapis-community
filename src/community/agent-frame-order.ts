export interface FrameOrder {
  cursorSeq: number;
  recordSeq: number;
}

export function rejectsFrameOrder(
  previous: FrameOrder,
  next: FrameOrder,
  snapshot: boolean,
): boolean {
  return (
    next.cursorSeq < previous.cursorSeq ||
    (next.cursorSeq === previous.cursorSeq &&
      (next.recordSeq < previous.recordSeq ||
        (next.recordSeq === previous.recordSeq && !snapshot)))
  );
}
