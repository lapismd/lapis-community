import type {
  RegistryCatalogDetail,
  RegistryCatalogEntry,
  RegistryCatalogStatus,
  RegistryDirectoryState,
  RegistryRoute,
} from "./model.js";

export interface RegistryCategorySummary {
  id: string;
  label: string;
  count: number;
}

export interface RegistryLandingSections {
  featured: RegistryCatalogEntry[];
  newlyReleased: RegistryCatalogEntry[];
  recentlyUpdated: RegistryCatalogEntry[];
  categories: RegistryCategorySummary[];
}

const statusLabels: Record<RegistryCatalogStatus, string> = {
  active: "Available",
  pending: "Coming soon",
  deprecated: "Deprecated",
  disabled: "Unavailable",
  revoked: "Revoked",
};

export function registryStatusLabel(status: RegistryCatalogStatus): string {
  return statusLabels[status];
}

export function titleCaseRegistryValue(value: string): string {
  return value
    .split("-")
    .map((part) =>
      part.toLocaleLowerCase() === "ai"
        ? "AI"
        : `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
}

export function formatRegistryBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = size / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units.at(-1)) {
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${size} B`;
}

function compareName(
  left: RegistryCatalogEntry,
  right: RegistryCatalogEntry,
): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function collectRegistryCategories(
  plugins: readonly RegistryCatalogEntry[],
): RegistryCategorySummary[] {
  const counts = new Map<string, number>();
  for (const plugin of plugins) {
    for (const category of plugin.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([id, count]) => ({ id, label: titleCaseRegistryValue(id), count }))
    .toSorted(
      (left, right) =>
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id),
    );
}

export function registryLandingSections(
  plugins: readonly RegistryCatalogEntry[],
): RegistryLandingSections {
  return {
    featured: plugins
      .filter((plugin) => plugin.status === "active")
      .toSorted(compareName),
    newlyReleased: [...plugins]
      .toSorted(
        (left, right) =>
          (right.latestRelease?.releasedAt ?? "").localeCompare(
            left.latestRelease?.releasedAt ?? "",
          ) || compareName(left, right),
      )
      .slice(0, 5),
    recentlyUpdated: [...plugins]
      .toSorted(
        (left, right) =>
          (right.latestRelease?.releasedAt ?? "").localeCompare(
            left.latestRelease?.releasedAt ?? "",
          ) || compareName(left, right),
      )
      .slice(0, 5),
    categories: collectRegistryCategories(plugins).slice(0, 8),
  };
}

export function filterRegistryEntries(
  plugins: readonly RegistryCatalogEntry[],
  state: RegistryDirectoryState,
): RegistryCatalogEntry[] {
  const query = state.query.trim().toLocaleLowerCase();
  const categories = new Set(state.categories);
  const platforms = new Set(state.platforms);
  const statuses = new Set(state.statuses);
  return plugins
    .filter((plugin) => {
      const searchText = [
        plugin.id,
        plugin.name,
        plugin.description,
        plugin.author,
        ...plugin.categories,
        ...plugin.platforms,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (query === "" || searchText.includes(query)) &&
        (categories.size === 0 ||
          plugin.categories.some((value) => categories.has(value))) &&
        (platforms.size === 0 ||
          plugin.platforms.some((value) => platforms.has(value))) &&
        (statuses.size === 0 || statuses.has(plugin.status)) &&
        (!state.officialOnly || plugin.channel === "official")
      );
    })
    .toSorted((left, right) => {
      if (state.sort === "new" || state.sort === "updated") {
        return (
          (right.latestRelease?.releasedAt ?? "").localeCompare(
            left.latestRelease?.releasedAt ?? "",
          ) || compareName(left, right)
        );
      }
      if (state.sort === "status") {
        return (
          registryStatusLabel(left.status).localeCompare(
            registryStatusLabel(right.status),
          ) || compareName(left, right)
        );
      }
      return compareName(left, right);
    });
}

export function relatedRegistryPlugins(
  selected: RegistryCatalogDetail,
  plugins: readonly RegistryCatalogEntry[],
  limit = 6,
): RegistryCatalogEntry[] {
  const categories = new Set(
    plugins.find((plugin) => plugin.id === selected.id)?.categories ?? [],
  );
  return plugins
    .filter((plugin) => plugin.id !== selected.id)
    .map((plugin) => ({
      plugin,
      score: plugin.categories.filter((category) => categories.has(category))
        .length,
    }))
    .filter(({ score }) => score > 0)
    .toSorted(
      (left, right) =>
        right.score - left.score || compareName(left.plugin, right.plugin),
    )
    .slice(0, limit)
    .map(({ plugin }) => plugin);
}

export function registryRouteToDestination(route: RegistryRoute): string {
  if (route.page === "landing") return "registry";
  if (route.page === "directory") return "registry:plugins";
  const version =
    route.version === undefined
      ? ""
      : `:version:${encodeURIComponent(route.version)}`;
  const view = route.view === "reviews" ? ":reviews" : "";
  const post = route.postId === undefined ? "" : `:post:${route.postId}`;
  return `registry:plugin:${route.pluginId}${version}${view}${post}`;
}

export function registryRouteFromDestination(
  destination: string,
): RegistryRoute | null {
  if (destination === "registry") return { page: "landing" };
  if (destination === "registry:plugins") return { page: "directory" };
  const prefix = "registry:plugin:";
  if (!destination.startsWith(prefix)) return null;
  const pluginDestination = destination.slice(prefix.length);
  const match =
    /^(?<pluginId>[a-z0-9][a-z0-9-]{0,127})(?::version:(?<version>[^:]+))?(?::(?<reviews>reviews))?(?::post:(?<postId>[0-9a-f]{64}))?$/u.exec(
      pluginDestination,
    );
  if (match?.groups === undefined) return null;
  const { pluginId, version: encodedVersion, reviews, postId } = match.groups;
  if (pluginId === undefined) return null;
  let version: string | undefined;
  try {
    version =
      encodedVersion === undefined
        ? undefined
        : decodeURIComponent(encodedVersion);
  } catch {
    return null;
  }
  return /^[a-z0-9][a-z0-9-]{0,127}$/u.test(pluginId)
    ? {
        page: "plugin",
        pluginId,
        ...(version === undefined ? {} : { version }),
        ...(reviews === undefined ? {} : { view: "reviews" as const }),
        ...(postId === undefined ? {} : { postId }),
      }
    : null;
}

export function registryRouteToHash(route: RegistryRoute): string {
  if (route.page === "landing") return "#/registry";
  if (route.page === "directory") return "#/registry/plugins";
  const base = `#/registry/plugins/${encodeURIComponent(route.pluginId)}`;
  const version =
    route.version === undefined
      ? ""
      : `/versions/${encodeURIComponent(route.version)}`;
  const view = route.view === "reviews" ? "/reviews" : "";
  const post = route.postId === undefined ? "" : `/posts/${route.postId}`;
  return `${base}${version}${view}${post}`;
}

export function registryRouteFromHash(hash: string): RegistryRoute | null {
  if (hash === "#/registry") return { page: "landing" };
  if (hash === "#/registry/plugins") return { page: "directory" };
  const match =
    /^#\/registry\/plugins\/(?<pluginId>[^/]+)(?:\/versions\/(?<version>[^/]+))?(?:\/(?<reviews>reviews))?(?:\/posts\/(?<postId>[0-9a-f]{64}))?$/u.exec(
      hash,
    );
  if (match?.groups === undefined) return null;
  try {
    const pluginId = decodeURIComponent(match.groups.pluginId!);
    if (!/^[a-z0-9][a-z0-9-]{0,127}$/u.test(pluginId)) return null;
    const version =
      match.groups.version === undefined
        ? undefined
        : decodeURIComponent(match.groups.version);
    return {
      page: "plugin",
      pluginId,
      ...(version === undefined ? {} : { version }),
      ...(match.groups.reviews === undefined
        ? {}
        : { view: "reviews" as const }),
      ...(match.groups.postId === undefined
        ? {}
        : { postId: match.groups.postId }),
    };
  } catch {
    return null;
  }
}
