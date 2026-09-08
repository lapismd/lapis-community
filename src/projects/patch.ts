import type { ProjectForgeDiffFile } from "./model.js";

/** Splits a multi-file Git patch while preserving each file's complete patch text. */
export function splitProjectForgePatch(patch: string): ProjectForgeDiffFile[] {
  const starts = [...patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gmu)];
  return starts.map((match, index) => {
    const oldPath = match[1]!;
    const path = match[2]!;
    const start = match.index;
    const end = starts[index + 1]?.index ?? patch.length;
    const filePatch = patch.slice(start, end).trimEnd();
    const additions = (filePatch.match(/^\+(?!\+\+)/gmu) ?? []).length;
    const deletions = (filePatch.match(/^-(?!--)/gmu) ?? []).length;
    const status = filePatch.includes("new file mode")
      ? "added"
      : filePatch.includes("deleted file mode")
        ? "deleted"
        : oldPath !== path
          ? "renamed"
          : "modified";
    return {
      path,
      ...(oldPath === path ? {} : { old_path: oldPath }),
      status,
      additions,
      deletions,
      binary: /^(?:Binary files|GIT binary patch)/mu.test(filePatch),
      patch: filePatch,
    };
  });
}
