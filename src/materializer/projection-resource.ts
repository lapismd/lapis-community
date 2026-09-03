import { createHash } from "node:crypto";

export interface ProjectionResource {
  url: string;
  sourceUrl: string;
  sha256: string;
  size: number;
  mediaType?: string;
}

export interface ProjectionResourceSourceConfiguration {
  blossomUrl: URL | undefined;
  legacyOrigin: URL | undefined;
}

export function projectionResourceSourceConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): ProjectionResourceSourceConfiguration {
  return {
    blossomUrl: configuredHttpOrigin("BLOSSOM_URL", environment.BLOSSOM_URL),
    legacyOrigin: configuredHttpOrigin(
      "REGISTRY_ASSET_FETCH_ORIGIN",
      environment.REGISTRY_ASSET_FETCH_ORIGIN,
    ),
  };
}

export function resolveProjectionResourceSource(
  resource: ProjectionResource,
  configuration: ProjectionResourceSourceConfiguration = {
    blossomUrl: undefined,
    legacyOrigin: undefined,
  },
): URL {
  const source = new URL(resource.sourceUrl);
  const override = resource.mediaType?.startsWith("image/")
    ? (configuration.blossomUrl ?? configuration.legacyOrigin)
    : configuration.legacyOrigin;
  if (override === undefined) return source;
  return new URL(source.pathname.replace(/^\/+/, ""), override);
}

export function verifyProjectionResourceBytes(
  resource: ProjectionResource,
  bytes: Uint8Array,
): void {
  if (bytes.byteLength !== resource.size) {
    throw new Error(`${resource.url} size mismatch`);
  }
  if (createHash("sha256").update(bytes).digest("hex") !== resource.sha256) {
    throw new Error(`${resource.url} hash mismatch`);
  }
}

function configuredHttpOrigin(
  name: string,
  value: string | undefined,
): URL | undefined {
  const configured = value?.trim();
  if (!configured) return undefined;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(
      `${name} must be an absolute HTTP(S) URL without credentials`,
    );
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error(
      `${name} must be an absolute HTTP(S) URL without credentials`,
    );
  }
  url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return url;
}
