import { renderRegistryMarkdown } from "./markdown.js";
import type {
  RegistryCatalogDataSource,
  RegistryCatalogEntry,
  RegistryLoadOptions,
  RegistryResolvedDetail,
} from "./model.js";

export class RegistryCatalogSession {
  readonly #source: RegistryCatalogDataSource;
  readonly #details = new Map<string, RegistryResolvedDetail>();

  constructor(source: RegistryCatalogDataSource) {
    this.#source = source;
  }

  async loadDetail(
    entry: RegistryCatalogEntry,
    options: RegistryLoadOptions = {},
  ): Promise<RegistryResolvedDetail> {
    const cached = this.#details.get(entry.id);
    if (cached !== undefined) return cached;

    const detail = await this.#source.loadPluginDetail(entry, options);
    const markdownFailures: string[] = [];
    const [overview, changelog] = await Promise.all([
      detail.content?.overview === undefined
        ? undefined
        : this.#source
            .loadMarkdown(detail.content.overview, options)
            .catch((cause: unknown) => {
              if (isAbortError(cause)) throw cause;
              markdownFailures.push("overview");
              return undefined;
            }),
      detail.content?.changelog === undefined
        ? undefined
        : this.#source
            .loadMarkdown(detail.content.changelog, options)
            .catch((cause: unknown) => {
              if (isAbortError(cause)) throw cause;
              markdownFailures.push("changelog");
              return undefined;
            }),
    ]);
    const resolved: RegistryResolvedDetail = {
      entry,
      detail,
      ...(overview === undefined
        ? {}
        : { overviewHtml: renderRegistryMarkdown(overview) }),
      ...(changelog === undefined
        ? {}
        : { changelogHtml: renderRegistryMarkdown(changelog) }),
      ...(markdownFailures.length === 0
        ? {}
        : {
            contentError: `The ${markdownFailures.join(" and ")} document could not be loaded.`,
          }),
    };
    this.#details.set(entry.id, resolved);
    return resolved;
  }

  hasDetail(pluginId: string): boolean {
    return this.#details.has(pluginId);
  }

  clear(): void {
    this.#details.clear();
  }
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}
