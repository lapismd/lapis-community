import type {
  JsonObject,
  JsonValue,
  MaterializedRegistry,
  V1Projection,
  V1ProjectionOptions,
  V1ProjectionPlugin,
} from "./types.js";

function withoutKeys(
  source: JsonObject,
  keys: ReadonlySet<string>,
): JsonObject {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !keys.has(key)),
  );
}

export function projectV1Records(
  records: readonly V1ProjectionPlugin[],
  options: V1ProjectionOptions,
  provenance: V1Projection["provenance"],
): V1Projection {
  const pluginFiles = new Map<string, JsonObject>();
  const indexPlugins: JsonValue[] = [];

  for (const plugin of records) {
    const latest = plugin.releases.find(
      (release) => release.version === plugin.latestVersion,
    );
    if (latest === undefined) continue;

    const versions = Object.fromEntries(
      plugin.releases.map((release) => [
        release.version,
        {
          ...release.metadata,
          bundle: {
            url: release.artifact.url,
            ...(release.artifact.downloadUrl === undefined
              ? {}
              : { downloadUrl: release.artifact.downloadUrl }),
            sha256: release.artifact.sha256,
            size: release.artifact.size,
          },
          minAppVersion: release.minAppVersion,
          platforms: release.platforms,
          releasedAt: release.releasedAt,
          version: release.version,
        },
      ]),
    );

    const detail = {
      ...withoutKeys(plugin.content.detail, new Set(["versions"])),
      id: plugin.content.pluginId,
      name: plugin.content.name,
      description: plugin.content.description,
      channel: plugin.content.channel,
      status: plugin.content.status,
      latestVersion: plugin.latestVersion,
      versions,
    } as JsonObject;
    pluginFiles.set(plugin.content.pluginId, detail);

    indexPlugins.push({
      ...withoutKeys(
        plugin.content.index,
        new Set(["detail", "latestRelease", "latestVersion"]),
      ),
      id: plugin.content.pluginId,
      name: plugin.content.name,
      description: plugin.content.description,
      channel: plugin.content.channel,
      status: plugin.content.status,
      detail: `plugins/${plugin.content.pluginId}.json`,
      latestVersion: plugin.latestVersion,
      latestRelease: {
        bundleSize: latest.artifact.size,
        releasedAt: latest.releasedAt,
      },
    });
  }

  return {
    index: {
      ...(options.indexBase ?? {}),
      schemaVersion: 1,
      generatedAt: options.generatedAt,
      plugins: indexPlugins,
    },
    plugins: pluginFiles,
    provenance,
  };
}

export function projectV1(
  registry: MaterializedRegistry,
  options: string | V1ProjectionOptions,
): V1Projection {
  return projectV1Records(
    registry.plugins.map((plugin) => ({
      content: plugin.content,
      releases: plugin.releases.map((release) => release.content),
      latestVersion: plugin.latestVersion,
    })),
    typeof options === "string" ? { generatedAt: options } : options,
    {
      backend: "nostr",
      root: registry.root,
      acceptedEventIds: registry.acceptedEventIds,
      exclusionCounts: registry.exclusionCounts,
    },
  );
}
