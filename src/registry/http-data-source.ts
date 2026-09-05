import {
  registryCatalogDetailSchema,
  registryCatalogIndexSchema,
  registryRuntimeSchema,
  type RegistryCatalogDataSource,
  type RegistryCatalogDetail,
  type RegistryCatalogEntry,
  type RegistryAppearance,
  type RegistryGalleryItem,
  type RegistryImageReference,
  type RegistryLoadOptions,
  type RegistryMarkdownReference,
  type RegistryMediaItem,
} from "./model.js";

export interface HttpRegistryCatalogDataSourceOptions {
  baseUrl: string | URL;
  fetch?: typeof fetch;
}

export function createHttpRegistryCatalogDataSource(
  options: HttpRegistryCatalogDataSourceOptions,
): RegistryCatalogDataSource {
  const baseUrl = ensureDirectoryUrl(options.baseUrl);
  const request = options.fetch ?? globalThis.fetch;

  async function readJson(
    relativePath: string,
    loadOptions: RegistryLoadOptions = {},
  ): Promise<unknown> {
    const response = await request(
      resolveRegistryUrl(baseUrl, relativePath),
      requestInit("application/json", loadOptions.signal),
    );
    if (!response.ok) {
      throw new Error(`Registry request failed with ${response.status}`);
    }
    return response.json();
  }

  return {
    async loadIndex(loadOptions) {
      const index = registryCatalogIndexSchema.parse(
        await readJson("index.json", loadOptions),
      );
      return {
        ...index,
        plugins: index.plugins.map((plugin) =>
          resolveEntryMedia(baseUrl, plugin),
        ),
      };
    },
    async loadRuntime(loadOptions) {
      const response = await request(
        resolveRegistryUrl(baseUrl, "runtime.json"),
        requestInit("application/json", loadOptions?.signal),
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(
          `Registry runtime request failed with ${response.status}`,
        );
      }
      const contentType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();
      if (
        contentType === "text/html" ||
        contentType === "application/xhtml+xml"
      ) {
        return null;
      }
      if (
        contentType !== undefined &&
        contentType !== "application/json" &&
        !contentType.endsWith("+json")
      ) {
        throw new Error("Registry runtime response was not JSON");
      }
      return registryRuntimeSchema.parse(await response.json());
    },
    async loadPluginDetail(entry, loadOptions) {
      const detail = resolveDetailMedia(
        baseUrl,
        registryCatalogDetailSchema.parse(
          await readJson(`plugins/${entry.id}.json`, loadOptions),
        ),
      );
      if (detail.id !== entry.id) {
        throw new Error(
          `${entry.id}: registry detail does not match the index`,
        );
      }
      return detail;
    },
    async loadMarkdown(
      reference: RegistryMarkdownReference,
      loadOptions?: RegistryLoadOptions,
    ) {
      const response = await request(
        resolveRegistryUrl(baseUrl, reference.url),
        requestInit("text/markdown", loadOptions?.signal),
      );
      if (!response.ok) {
        throw new Error(
          `Registry content request failed with ${response.status}`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== reference.size) {
        throw new Error("Registry content size does not match signed metadata");
      }
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const actual = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      if (actual !== reference.sha256) {
        throw new Error("Registry content hash does not match signed metadata");
      }
      return new TextDecoder().decode(bytes);
    },
  };
}

function resolveEntryMedia(
  baseUrl: URL,
  entry: RegistryCatalogEntry,
): RegistryCatalogEntry {
  if (entry.appearance?.logo === undefined) return entry;
  return {
    ...entry,
    appearance: resolveAppearanceMedia(baseUrl, entry.appearance),
  };
}

function resolveDetailMedia(
  baseUrl: URL,
  detail: RegistryCatalogDetail,
): RegistryCatalogDetail {
  return {
    ...detail,
    ...(detail.appearance === undefined
      ? {}
      : { appearance: resolveAppearanceMedia(baseUrl, detail.appearance) }),
    ...(detail.media === undefined
      ? {}
      : {
          media: {
            ...(detail.media.banner === undefined
              ? {}
              : { banner: resolveMediaItem(baseUrl, detail.media.banner) }),
            ...(detail.media.overview === undefined
              ? {}
              : {
                  overview: resolveMediaItem(baseUrl, detail.media.overview),
                }),
          },
        }),
    ...(detail.gallery === undefined
      ? {}
      : {
          gallery: detail.gallery.map((item) =>
            resolveGalleryItem(baseUrl, item),
          ),
        }),
  };
}

function resolveAppearanceMedia(
  baseUrl: URL,
  appearance: RegistryAppearance,
): RegistryAppearance {
  if (appearance.logo === undefined) return appearance;
  return {
    ...appearance,
    logo: {
      ...appearance.logo,
      url: resolveRegistryUrl(baseUrl, appearance.logo.url).toString(),
    },
  };
}

function resolveMediaItem(
  baseUrl: URL,
  item: RegistryMediaItem,
): RegistryMediaItem {
  return { ...item, images: resolveImageVariants(baseUrl, item.images) };
}

function resolveGalleryItem(
  baseUrl: URL,
  item: RegistryGalleryItem,
): RegistryGalleryItem {
  return { ...item, images: resolveImageVariants(baseUrl, item.images) };
}

function resolveImageVariants(
  baseUrl: URL,
  images: RegistryGalleryItem["images"],
): RegistryGalleryItem["images"] {
  return {
    preview: resolveImageReference(baseUrl, images.preview),
    full: resolveImageReference(baseUrl, images.full),
    light: resolveImageReference(baseUrl, images.light),
    dark: resolveImageReference(baseUrl, images.dark),
  };
}

function resolveImageReference(
  baseUrl: URL,
  reference: RegistryImageReference,
): RegistryImageReference {
  return {
    ...reference,
    url: resolveRegistryUrl(baseUrl, reference.url).toString(),
  };
}

function requestInit(accept: string, signal?: AbortSignal): RequestInit {
  return {
    headers: { accept },
    ...(signal === undefined ? {} : { signal }),
  };
}

function ensureDirectoryUrl(value: string | URL): URL {
  const fallback =
    typeof globalThis.location === "undefined"
      ? "http://registry.local/"
      : globalThis.location.href;
  const url = new URL(value, fallback);
  return new URL(url.pathname.endsWith("/") ? url.toString() : `${url}/`);
}

function resolveRegistryUrl(baseUrl: URL, value: string): URL {
  const candidate = new URL(value, baseUrl);
  if (
    candidate.origin !== baseUrl.origin ||
    !candidate.pathname.startsWith(baseUrl.pathname)
  ) {
    throw new Error(`Registry resource must stay under ${baseUrl.toString()}`);
  }
  return candidate;
}
