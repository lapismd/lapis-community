import type {
  JsonObject,
  JsonValue,
  MaterializedRegistry,
  V1Projection,
} from "./types.js";

function withoutKeys(
  source: JsonObject,
  keys: ReadonlySet<string>,
): JsonObject {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !keys.has(key)),
  );
}

export function projectV1(
  registry: MaterializedRegistry,
  generatedAt: string,
): V1Projection {
  const pluginFiles = new Map<string, JsonObject>();
  const indexPlugins: JsonValue[] = [];

  for (const plugin of registry.plugins) {
    const latest = plugin.releases.find(
      (release) => release.content.version === plugin.latestVersion,
    );
    if (latest === undefined) continue;

    const versions = Object.fromEntries(
      plugin.releases.map((release) => [
        release.content.version,
        {
          ...release.content.metadata,
          bundle: {
            url: release.content.artifact.url,
            ...(release.content.artifact.downloadUrl === undefined
              ? {}
              : { downloadUrl: release.content.artifact.downloadUrl }),
            sha256: release.content.artifact.sha256,
            size: release.content.artifact.size,
          },
          minAppVersion: release.content.minAppVersion,
          platforms: release.content.platforms,
          releasedAt: release.content.releasedAt,
          version: release.content.version,
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
        bundleSize: latest.content.artifact.size,
        releasedAt: latest.content.releasedAt,
      },
    });
  }

  return {
    index: {
      schemaVersion: 1,
      generatedAt,
      plugins: indexPlugins,
    },
    plugins: pluginFiles,
    provenance: {
      backend: "nostr",
      root: registry.root,
      acceptedEventIds: registry.acceptedEventIds,
      exclusionCounts: registry.exclusionCounts,
    },
  };
}
