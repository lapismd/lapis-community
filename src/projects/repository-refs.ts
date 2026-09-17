import type { ProjectForgeRef, ProjectForgeRefsResponse } from "./model.js";

const BRANCH_REFS_PATH = "refs/branches";
const MAX_BRANCH_REF_PAGES = 32;

export interface ProjectForgeRefsPage {
  head?: ProjectForgeRef | null;
  refs?: readonly ProjectForgeRef[];
  more?: boolean;
  continuation?: string;
}

/** Build the gateway path for one authenticated branch-ref page. */
export function projectForgeBranchRefsPath(continuation?: string): string {
  if (!continuation) return BRANCH_REFS_PATH;
  return `${BRANCH_REFS_PATH}?continuation=${encodeURIComponent(continuation)}`;
}

/**
 * Continue only when the provider both says more remains and supplies an
 * opaque cursor. A truncated page without a continuation is terminal.
 */
export function nextProjectForgeBranchRefsPath(
  page: ProjectForgeRefsPage,
): string | undefined {
  if (!page.more || !page.continuation) return undefined;
  return projectForgeBranchRefsPath(page.continuation);
}

/** Merge HEAD with every collected branch page, keeping the first name. */
export function mergeProjectForgeRefPages(
  headPage: ProjectForgeRefsPage,
  pages: readonly ProjectForgeRefsPage[],
): ProjectForgeRefsResponse {
  const refs: ProjectForgeRef[] = [];
  const seen = new Set<string>();
  for (const page of [headPage, ...pages]) {
    for (const ref of page.refs ?? []) {
      if (!ref.name || seen.has(ref.name)) continue;
      seen.add(ref.name);
      refs.push(ref);
    }
  }
  return {
    head: headPage.head ?? pages.find((page) => page.head)?.head ?? null,
    refs,
    more: Boolean(pages.at(-1)?.more && !pages.at(-1)?.continuation),
  };
}

/**
 * Load HEAD plus every `refs/branches` page. Nested names such as
 * `jj-sync/<scope>/<replica>` stay intact for the branch picker.
 */
export async function loadProjectForgeRefs(
  get: (suffix: string) => Promise<ProjectForgeRefsPage>,
): Promise<ProjectForgeRefsResponse> {
  const headPage = await get("refs");
  const pages: ProjectForgeRefsPage[] = [];
  let suffix: string | undefined = BRANCH_REFS_PATH;
  try {
    for (
      let pageCount = 0;
      suffix && pageCount < MAX_BRANCH_REF_PAGES;
      pageCount += 1
    ) {
      const page = await get(suffix);
      pages.push(page);
      suffix = nextProjectForgeBranchRefsPath(page);
    }
  } catch {
    // HEAD remains usable when a provider omits `/refs/branches`.
  }
  return mergeProjectForgeRefPages(headPage, pages);
}
