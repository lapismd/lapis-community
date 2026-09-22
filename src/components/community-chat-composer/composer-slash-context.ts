import { getContext, setContext } from "svelte";

import type { ComposerSlashCatalog } from "./composer-slash-catalog.js";

const slashCatalogKey = Symbol("community-composer-slash-catalog");

export function provideCommunityComposerSlashCatalog(
  catalog: () => ComposerSlashCatalog,
): void {
  setContext(slashCatalogKey, catalog);
}

export function useCommunityComposerSlashCatalog():
  | (() => ComposerSlashCatalog)
  | undefined {
  return getContext<(() => ComposerSlashCatalog) | undefined>(slashCatalogKey);
}
