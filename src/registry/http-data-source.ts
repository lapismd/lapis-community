import {
  registryCatalogDetailSchema,
  registryCatalogIndexSchema,
  registryRuntimeSchema,
  type RegistryCatalogDataSource,
  type RegistryCatalogEntry,
  type RegistryLoadOptions,
  type RegistryMarkdownReference,
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
      return registryCatalogIndexSchema.parse(
        await readJson("index.json", loadOptions),
      );
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
      return registryRuntimeSchema.parse(await response.json());
    },
    async loadPluginDetail(
      entry: RegistryCatalogEntry,
      loadOptions?: RegistryLoadOptions,
    ) {
      const detail = registryCatalogDetailSchema.parse(
        await readJson(entry.detail, loadOptions),
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
