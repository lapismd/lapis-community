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
    const resolved: RegistryResolvedDetail = {
      entry,
      detail,
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
    const resolved = this.#resolve(snapshot.entry, snapshot.detail);
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

  #resolve(
    entry: RegistryCatalogEntry,
    detail: RegistryResolvedDetail["detail"],
  ): RegistryResolvedDetail {
    return {
      entry,
      detail,
    };
  }
}
