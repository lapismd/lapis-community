import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "@lapismd/registry-protocol";
import type {
  JsonObject,
  JsonValue,
  PluginDefinitionContent,
  ReleaseContent,
} from "@lapismd/registry-protocol";
import semver from "semver";
import sharp from "sharp";

const pluginIdPattern = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const themedImageVariants = ["preview", "full", "light", "dark"] as const;

export interface LocalFixtureResource {
  path: string;
  bytes: Uint8Array;
  sha256: string;
}

export interface LocalPluginFixture {
  directory: string;
  plugin: PluginDefinitionContent;
  release: Omit<ReleaseContent, "artifact" | "releasedAt">;
  artifact: {
    path: string;
    bytes: Uint8Array;
    sha256: string;
  };
  resources: LocalFixtureResource[];
}

export interface LocalPluginFixtureOptions {
  limit?: number | undefined;
  publicBaseUrl: URL;
}

function object(value: unknown, label: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${label} must be an array of strings`);
  }
  return [...value];
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function safeRelativePath(value: unknown, label: string): string {
  const relativePath = text(value, label);
  if (
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }
  return relativePath;
}

async function jsonFile(filePath: string): Promise<JsonObject> {
  return object(JSON.parse(await readFile(filePath, "utf8")), filePath);
}

function artifactBytes(input: {
  manifest: JsonObject;
  packageName: string;
  packageVersion: string;
  registry: JsonObject;
}): Uint8Array {
  return new TextEncoder().encode(
    `${canonicalJson({
      schema: "lapis.registry.local-source-fixture/1",
      manifest: input.manifest,
      package: {
        name: input.packageName,
        version: input.packageVersion,
      },
      registry: input.registry,
    })}\n`,
  );
}

export async function loadLocalPluginFixtures(
  lapisPluginsRoot: string,
  options: LocalPluginFixtureOptions,
): Promise<LocalPluginFixture[]> {
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1)
  ) {
    throw new Error("Fixture plugin limit must be a positive integer");
  }
  const packagesRoot = path.join(lapisPluginsRoot, "packages");
  const directories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
  const fixtures: LocalPluginFixture[] = [];

  for (const directory of directories) {
    if (options.limit !== undefined && fixtures.length >= options.limit) break;
    const packageRoot = path.join(packagesRoot, directory);
    let manifest: JsonObject;
    let packageJson: JsonObject;
    let registry: JsonObject;
    try {
      [manifest, packageJson, registry] = await Promise.all([
        jsonFile(path.join(packageRoot, "manifest.json")),
        jsonFile(path.join(packageRoot, "package.json")),
        jsonFile(path.join(packageRoot, "registry.json")),
      ]);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw cause;
    }

    const pluginId = text(manifest.id, `${directory} manifest id`);
    if (!pluginIdPattern.test(pluginId)) {
      throw new Error(`${directory} manifest id is not a registry plugin id`);
    }
    const packageName = text(packageJson.name, `${pluginId} package name`);
    const version = text(packageJson.version, `${directory} package version`);
    if (semver.valid(version) === null || manifest.version !== version) {
      throw new Error(
        `${pluginId} manifest and package versions must match SemVer`,
      );
    }
    const minAppVersion = text(
      manifest.minAppVersion,
      `${pluginId} minimum app version`,
    );
    if (semver.valid(minAppVersion) === null) {
      throw new Error(`${pluginId} minimum app version must be SemVer`);
    }
    const categories = stringArray(
      registry.categories,
      `${pluginId} categories`,
    );
    const highlights = stringArray(
      registry.highlights,
      `${pluginId} highlights`,
    );
    const author = text(manifest.author, `${pluginId} author`);
    const authorUrl = optionalText(manifest.authorUrl);
    const authorAvatarUrl = optionalText(manifest.authorAvatarUrl);
    const repositoryUrl = repository(packageJson.repository);
    const owner = {
      name: author,
      verified: true,
      ...(repositoryUrl === undefined ? {} : { url: repositoryUrl }),
    };
    const platforms =
      manifest.isDesktopOnly === true ? ["electron"] : ["web", "electron"];
    const resources: LocalFixtureResource[] = [];
    const appearance = await resolveAppearance({
      packageRoot,
      pluginId,
      publicBaseUrl: options.publicBaseUrl,
      resources,
      value: registry.appearance,
    });
    const media = await resolveMedia({
      packageRoot,
      pluginId,
      publicBaseUrl: options.publicBaseUrl,
      resources,
      value: registry.media,
    });
    const gallery = await resolveGallery({
      packageRoot,
      pluginId,
      publicBaseUrl: options.publicBaseUrl,
      resources,
      value: registry.gallery,
    });
    const content = await resolveContent({
      packageRoot,
      pluginId,
      publicBaseUrl: options.publicBaseUrl,
      resources,
      value: registry.content,
    });
    const readmeUrl = content.overview?.sourceUrl;
    const links = compact({
      homepage: optionalText(packageJson.homepage),
      repository: repositoryUrl,
      documentation: optionalText(registry.documentationUrl),
      issues:
        optionalText(packageJson.bugs) ??
        (packageJson.bugs === null ||
        Array.isArray(packageJson.bugs) ||
        typeof packageJson.bugs !== "object"
          ? undefined
          : optionalText((packageJson.bugs as JsonObject).url)),
    });
    const contributes =
      manifest.contributes === null ||
      Array.isArray(manifest.contributes) ||
      typeof manifest.contributes !== "object"
        ? {}
        : (manifest.contributes as JsonObject);
    const bytes = artifactBytes({
      manifest,
      packageName,
      packageVersion: version,
      registry,
    });

    fixtures.push({
      directory,
      plugin: {
        schema: "lapis.registry.plugin/1",
        pluginId,
        name: text(manifest.name, `${pluginId} name`),
        description: text(manifest.description, `${pluginId} description`),
        channel: "official",
        status: "active",
        index: {
          schemaVersion: 1,
          author,
          ...(authorUrl === undefined ? {} : { authorUrl }),
          ...(authorAvatarUrl === undefined ? {} : { authorAvatarUrl }),
          ...(readmeUrl === undefined ? {} : { readmeUrl }),
          ...(appearance === undefined ? {} : { appearance }),
          minAppVersion,
          platforms,
          categories,
          highlights,
          badges: ["official", "verified"],
          owner,
          contributes,
          source: "lapis-plugins-local-fixture",
        },
        detail: {
          schemaVersion: 1,
          author,
          ...(authorUrl === undefined ? {} : { authorUrl }),
          ...(authorAvatarUrl === undefined ? {} : { authorAvatarUrl }),
          ...(readmeUrl === undefined ? {} : { readmeUrl }),
          ...(appearance === undefined ? {} : { appearance }),
          ...(media === undefined ? {} : { media }),
          ...(gallery === undefined ? {} : { gallery }),
          owner,
          ...(optionalText(packageJson.license) === undefined
            ? {}
            : { license: optionalText(packageJson.license)! }),
          ...(Object.keys(links).length === 0 ? {} : { links }),
          highlights,
          ...(Object.keys(content).length === 0 ? {} : { content }),
          contributes,
          manifest,
          registry,
          sourceDirectory: `packages/${directory}`,
        },
      },
      release: {
        schema: "lapis.registry.release/1",
        pluginId,
        version,
        minAppVersion,
        platforms,
        metadata: {
          fixture: true,
          packageName,
          sourceDirectory: `packages/${directory}`,
        },
      },
      artifact: {
        path: `artifacts/${pluginId}/${version}/source-fixture.json`,
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      resources,
    });
  }

  if (fixtures.length === 0) {
    throw new Error(`${lapisPluginsRoot} contains no complete plugin metadata`);
  }
  return fixtures;
}

function compact(value: Record<string, string | undefined>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

function repository(value: unknown): string | undefined {
  const raw =
    typeof value === "string"
      ? value
      : value !== null && !Array.isArray(value) && typeof value === "object"
        ? optionalText((value as JsonObject).url)
        : undefined;
  if (raw === undefined) return undefined;
  const slug = raw
    .replace(/^git\+https:\/\/github\.com\//u, "")
    .replace(/^https:\/\/github\.com\//u, "")
    .replace(/^git@github\.com:/u, "")
    .replace(/\.git$/u, "")
    .replace(/\/$/u, "");
  return slug === "" ? undefined : `https://github.com/${slug}`;
}

interface ResourceOptions {
  packageRoot: string;
  pluginId: string;
  publicBaseUrl: URL;
  resources: LocalFixtureResource[];
  value: unknown;
}

async function resolveContent(
  options: ResourceOptions,
): Promise<Record<string, JsonObject>> {
  if (
    options.value === undefined ||
    options.value === null ||
    Array.isArray(options.value) ||
    typeof options.value !== "object"
  ) {
    return {};
  }
  return Object.fromEntries(
    await Promise.all(
      Object.entries(options.value).map(async ([kind, value]) => {
        const relativePath = safeRelativePath(
          value,
          `${options.pluginId} ${kind} content`,
        );
        if (!relativePath.endsWith(".md")) {
          throw new Error(
            `${options.pluginId} ${kind} content must be Markdown`,
          );
        }
        const bytes = await readFile(
          path.join(options.packageRoot, relativePath),
        );
        const resourcePath = `registry/content/${options.pluginId}/${kind}.md`;
        const resource = addResource(options.resources, resourcePath, bytes);
        return [
          kind,
          {
            url: `/${resourcePath}`,
            sourceUrl: new URL(resourcePath, options.publicBaseUrl).toString(),
            sha256: resource.sha256,
            size: bytes.byteLength,
            mediaType: "text/markdown",
          },
        ];
      }),
    ),
  );
}

async function resolveAppearance(
  options: ResourceOptions,
): Promise<JsonObject | undefined> {
  if (options.value === undefined) return undefined;
  const appearance = object(options.value, `${options.pluginId} appearance`);
  const icon = text(appearance.icon, `${options.pluginId} appearance icon`);
  const accent = text(
    appearance.accent,
    `${options.pluginId} appearance accent`,
  ).toUpperCase();
  if (appearance.logo === undefined) return { icon, accent };
  const logo = object(appearance.logo, `${options.pluginId} appearance logo`);
  return {
    icon,
    accent,
    logo: {
      ...(await resolveImage(options, logo, "logo")),
      alt: text(logo.alt, `${options.pluginId} logo alt`),
    },
  };
}

async function resolveMedia(
  options: ResourceOptions,
): Promise<JsonObject | undefined> {
  if (options.value === undefined) return undefined;
  const media = object(options.value, `${options.pluginId} media`);
  return Object.fromEntries(
    await Promise.all(
      Object.entries(media).map(async ([role, value]) => {
        const item = object(value, `${options.pluginId} ${role} media`);
        return [
          role,
          {
            alt: text(item.alt, `${options.pluginId} ${role} alt`),
            images: await resolveThemedImages(options, item.images, role),
          },
        ];
      }),
    ),
  );
}

async function resolveGallery(
  options: ResourceOptions,
): Promise<JsonValue[] | undefined> {
  if (options.value === undefined) return undefined;
  if (!Array.isArray(options.value)) {
    throw new Error(`${options.pluginId} gallery must be an array`);
  }
  return await Promise.all(
    options.value.map(async (value, index) => {
      const item = object(value, `${options.pluginId} gallery ${index}`);
      const id = text(item.id, `${options.pluginId} gallery id`);
      return {
        id,
        alt: text(item.alt, `${options.pluginId} ${id} alt`),
        images: await resolveThemedImages(
          options,
          item.images,
          `gallery/${id}`,
        ),
      };
    }),
  );
}

async function resolveThemedImages(
  options: ResourceOptions,
  value: unknown,
  role: string,
): Promise<JsonObject> {
  const images = object(value, `${options.pluginId} ${role} images`);
  return Object.fromEntries(
    await Promise.all(
      themedImageVariants.map(async (variant) => [
        variant,
        await resolveImage(
          options,
          object(
            images[variant],
            `${options.pluginId} ${role} ${variant} image`,
          ),
          `${role}-${variant}`,
        ),
      ]),
    ),
  );
}

async function resolveImage(
  options: ResourceOptions,
  source: JsonObject,
  role: string,
): Promise<JsonObject> {
  const relativePath = safeRelativePath(
    source.path,
    `${options.pluginId} ${role} image path`,
  );
  const bytes = await readFile(path.join(options.packageRoot, relativePath));
  const metadata = await sharp(bytes, {
    failOn: "warning",
    limitInputPixels: 20_000_000,
  }).metadata();
  if (
    metadata.format === undefined ||
    !Number.isInteger(metadata.width) ||
    !Number.isInteger(metadata.height)
  ) {
    throw new Error(`${options.pluginId} ${role} image metadata is incomplete`);
  }
  const extension = metadata.format === "svg" ? "svg" : metadata.format;
  const digest = createHash("sha256").update(bytes).digest("hex");
  const resourcePath = `registry/assets/${options.pluginId}/${digest}.${extension}`;
  addResource(options.resources, resourcePath, bytes, digest);
  return {
    url: `/${resourcePath}`,
    sourceUrl: new URL(resourcePath, options.publicBaseUrl).toString(),
    sha256: digest,
    size: bytes.byteLength,
    mediaType:
      metadata.format === "svg" ? "image/svg+xml" : `image/${metadata.format}`,
    width: metadata.width!,
    height: metadata.height!,
  };
}

function addResource(
  resources: LocalFixtureResource[],
  resourcePath: string,
  bytes: Uint8Array,
  digest = createHash("sha256").update(bytes).digest("hex"),
): LocalFixtureResource {
  const resource = { path: resourcePath, bytes, sha256: digest };
  if (!resources.some((candidate) => candidate.path === resourcePath)) {
    resources.push(resource);
  }
  return resource;
}
