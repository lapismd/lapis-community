import type {
  JsonObject,
  JsonValue,
  RegistryProjection,
  RegistryProjectionOptions,
  RegistryProjectionPlugin,
  RegistryProjectionRelease,
  ReleaseContent,
} from "./types.js";

const detailFields = [
  "author",
  "authorUrl",
  "authorAvatarUrl",
  "appearance",
  "media",
  "gallery",
  "owner",
  "license",
  "links",
  "highlights",
  "contributes",
] as const;

const indexFields = [
  "author",
  "authorUrl",
  "authorAvatarUrl",
  "appearance",
  "categories",
  "badges",
  "owner",
  "contributes",
] as const;

function picked(source: JsonObject, keys: readonly string[]): JsonObject {
  return Object.fromEntries(
    keys.flatMap((key) =>
      source[key] === undefined ? [] : [[key, source[key]]],
    ),
  );
}

function objectField(source: JsonObject, key: string): JsonObject | undefined {
  const value = source[key];
  return value === null || Array.isArray(value) || typeof value !== "object"
    ? undefined
    : (value as JsonObject);
}

function stringField(source: JsonObject, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function stringArrayField(source: JsonObject, key: string): string[] {
  const value = source[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function projectionRelease(
  release: ReleaseContent | RegistryProjectionRelease,
): RegistryProjectionRelease {
  return "content" in release ? release : { content: release };
}

function projectedChangelog(release: ReleaseContent): JsonObject | undefined {
  if (release.changelog === undefined) return undefined;
  return {
    title: release.changelog.title,
    ...(release.changelog.description === undefined
      ? {}
      : { description: release.changelog.description }),
    ...(release.changelog.tags === undefined
      ? {}
      : { tags: [...release.changelog.tags] }),
  };
}

export function projectRegistry(
  records: readonly RegistryProjectionPlugin[],
  options: RegistryProjectionOptions,
  provenance: RegistryProjection["provenance"],
): RegistryProjection {
  const pluginFiles = new Map<string, JsonObject>();
  const indexPlugins: JsonValue[] = [];

  for (const plugin of records) {
    const releases = plugin.releases.map(projectionRelease);
    const latest = releases.find(
      (release) => release.content.version === plugin.latestVersion,
    );
    if (latest === undefined) continue;
    const latestContent = latest.content;
    const detail = plugin.content.detail;
    const index = plugin.content.index;
    const detailOwner = objectField(detail, "owner");
    const indexOwner = objectField(index, "owner");
    const author =
      stringField(detail, "author") ??
      stringField(index, "author") ??
      stringField(detailOwner ?? {}, "name") ??
      stringField(indexOwner ?? {}, "name") ??
      plugin.content.name;
    const authorUrl =
      stringField(detail, "authorUrl") ?? stringField(index, "authorUrl");
    const authorAvatarUrl =
      stringField(detail, "authorAvatarUrl") ??
      stringField(index, "authorAvatarUrl");
    const appearance =
      objectField(detail, "appearance") ?? objectField(index, "appearance");
    const contributes =
      objectField(detail, "contributes") ?? objectField(index, "contributes");
    const owner =
      detailOwner ??
      indexOwner ??
      ({
        name: author,
        verified: plugin.content.channel === "official",
      } satisfies JsonObject);
    const categories = stringArrayField(index, "categories");
    const badges = stringArrayField(index, "badges");
    const platforms =
      stringArrayField(index, "platforms").length > 0
        ? stringArrayField(index, "platforms")
        : latestContent.platforms;

    const versions: JsonObject = Object.fromEntries(
      releases.map((release): [string, JsonObject] => {
        const changelog = projectedChangelog(release.content);
        return [
          release.content.version,
          {
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
            ...(changelog === undefined ? {} : { changelog }),
            ...(release.releasePost === undefined
              ? {}
              : { releasePost: release.releasePost }),
          },
        ];
      }),
    );

    pluginFiles.set(plugin.content.pluginId, {
      schemaVersion: 1,
      ...picked(detail, detailFields),
      id: plugin.content.pluginId,
      name: plugin.content.name,
      description: plugin.content.description,
      author,
      ...(authorUrl === undefined ? {} : { authorUrl }),
      ...(authorAvatarUrl === undefined ? {} : { authorAvatarUrl }),
      ...(appearance === undefined ? {} : { appearance }),
      channel: plugin.content.channel,
      status: plugin.content.status,
      owner,
      latestVersion: plugin.latestVersion,
      ...(contributes === undefined ? {} : { contributes }),
      versions,
    });

    indexPlugins.push({
      ...picked(index, indexFields),
      id: plugin.content.pluginId,
      name: plugin.content.name,
      description: plugin.content.description,
      author,
      channel: plugin.content.channel,
      status: plugin.content.status,
      detail: `plugins/${plugin.content.pluginId}.json`,
      latestVersion: plugin.latestVersion,
      minAppVersion: latestContent.minAppVersion,
      platforms,
      categories,
      badges,
      owner,
      latestRelease: {
        bundleSize: latestContent.artifact.size,
        releasedAt: latestContent.releasedAt,
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
