import type {
  JsonObject,
  JsonValue,
  RegistryProjection,
  RegistryProjectionOptions,
  RegistryProjectionPlugin,
} from "./types.js";

function withoutKeys(
  source: JsonObject,
  keys: ReadonlySet<string>,
): JsonObject {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !keys.has(key)),
  );
}

export function projectRegistry(
  records: readonly RegistryProjectionPlugin[],
  options: RegistryProjectionOptions,
  provenance: RegistryProjection["provenance"],
): RegistryProjection {
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

    pluginFiles.set(plugin.content.pluginId, {
      ...withoutKeys(plugin.content.detail, new Set(["versions"])),
      id: plugin.content.pluginId,
      name: plugin.content.name,
      description: plugin.content.description,
      channel: plugin.content.channel,
      status: plugin.content.status,
      latestVersion: plugin.latestVersion,
      versions,
    });

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
