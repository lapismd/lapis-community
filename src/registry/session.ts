import { renderRegistryMarkdown } from "./markdown.js";
import type {
  RegistryCatalogDataSource,
  RegistryCatalogEntry,
  RegistryLoadOptions,
  RegistryResolvedDetail,
  RegistryVersionSnapshot,
} from "./model.js";

export class RegistryCatalogSession {
  readonly #source: RegistryCatalogDataSource;
  readonly #details = new Map<string, RegistryResolvedDetail>();
  readonly #versions = new Map<string, RegistryResolvedDetail>();

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

  async loadVersionDetail(
    pluginId: string,
    version: string,
    options: RegistryLoadOptions = {},
  ): Promise<{
    resolved: RegistryResolvedDetail;
    snapshot: RegistryVersionSnapshot;
  }> {
    if (this.#source.loadPluginVersionDetail === undefined) {
      throw new Error(
        "This Registry source does not provide historical releases",
      );
    }
    const key = `${pluginId}\u0000${version}`;
    const snapshot = await this.#source.loadPluginVersionDetail(
      pluginId,
      version,
      options,
    );
    const cached = this.#versions.get(key);
    if (cached !== undefined) return { resolved: cached, snapshot };
    const resolved = await this.#resolve(
      snapshot.entry,
      snapshot.detail,
      options,
    );
    this.#versions.set(key, resolved);
    return { resolved, snapshot };
  }

  hasDetail(pluginId: string): boolean {
    return this.#details.has(pluginId);
  }

  clear(): void {
    this.#details.clear();
    this.#versions.clear();
  }

  async #resolve(
    entry: RegistryCatalogEntry,
    detail: RegistryResolvedDetail["detail"],
    options: RegistryLoadOptions,
  ): Promise<RegistryResolvedDetail> {
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
    return {
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
  }
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}
