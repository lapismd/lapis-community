/** Feature layers, composition-root globs, and the LC-ARCH-028 import matrix. */

export const LIMIT_KEYS = {
  production: "newProductionCountedLines",
  test: "newTestCountedLines",
  story: "newStoryCountedLines",
  script: "newScriptCountedLines",
};

export const DEFAULT_LIMITS = {
  newProductionCountedLines: 300,
  newTestCountedLines: 500,
  newStoryCountedLines: 400,
  newScriptCountedLines: 300,
};

const COMPOSITION_FILES = new Set([
  "src/components/community-application/CommunityApplicationRoot.svelte",
  "src/components/community-application/CommunityApplication.svelte",
  "src/components/register.ts",
  "src/index.ts",
]);

const PACKAGE_EXPORTS = {
  "": "src/index.ts",
  auth: "src/auth/index.ts",
  nostr: "src/nostr/index.ts",
  protocol: "src/protocol/index.ts",
  projects: "src/projects/index.ts",
  components: "src/components/index.ts",
  community: "src/community/index.ts",
  registry: "src/registry/index.ts",
  "registry/nip29": "src/registry/nip29-data-source.ts",
  testing: "src/testing/index.ts",
};

export const PACKAGE_PREFIX = "@lapismd/lapis-community";

export const ALLOWED_DYNAMIC = new Set(["@tursodatabase/database-wasm/bundle"]);

const R = "R";
const T = "T";
const X = "X";

/**
 * Rows import columns. T = type-only. Pending type edges
 * (community/auth → components) are counted until P1 inversion.
 */
export const MATRIX = {
  protocol: {
    protocol: R,
    nostr: X,
    auth: X,
    community: X,
    projects: X,
    registry: X,
    components: X,
    testing: X,
    scripts: X,
    support: X,
  },
  nostr: {
    protocol: R,
    nostr: R,
    auth: R,
    community: X,
    projects: X,
    registry: X,
    components: X,
    testing: X,
    scripts: X,
    support: X,
  },
  auth: {
    protocol: R,
    nostr: R,
    auth: R,
    community: X,
    projects: X,
    registry: X,
    components: X,
    testing: X,
    scripts: X,
    support: X,
  },
  community: {
    protocol: R,
    nostr: R,
    auth: R,
    community: R,
    projects: X,
    registry: X,
    components: X,
    testing: X,
    scripts: X,
    support: X,
  },
  projects: {
    protocol: R,
    nostr: R,
    auth: R,
    community: X,
    projects: R,
    registry: X,
    components: X,
    testing: X,
    scripts: X,
    support: X,
  },
  registry: {
    protocol: R,
    nostr: R,
    auth: R,
    community: X,
    projects: X,
    registry: R,
    components: X,
    testing: X,
    scripts: X,
    support: X,
  },
  components: {
    protocol: T,
    nostr: T,
    auth: R,
    community: R,
    projects: R,
    registry: R,
    components: R,
    testing: X,
    scripts: X,
    support: X,
  },
  testing: {
    protocol: R,
    nostr: R,
    auth: R,
    community: R,
    projects: R,
    registry: R,
    components: R,
    testing: R,
    scripts: X,
    support: R,
  },
  support: {
    protocol: R,
    nostr: R,
    auth: R,
    community: R,
    projects: R,
    registry: R,
    components: X,
    testing: X,
    scripts: X,
    support: R,
  },
};

const PENDING_TYPE = new Set();

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|svelte)$/u;

export function isSourceFile(name) {
  return SOURCE_EXT.test(name);
}

export function toPosix(relativePath) {
  return relativePath.split("\\").join("/");
}

export function isCompositionRoot(posixPath) {
  if (COMPOSITION_FILES.has(posixPath)) return true;
  if (posixPath.startsWith("dev/")) return true;
  if (posixPath.startsWith(".storybook/")) return true;
  if (posixPath.startsWith("src/testing/")) return true;
  return /(?:^|\/)[^/]*(?:Harness|Fixture)\.svelte$/u.test(posixPath);
}

export function fileKind(posixPath) {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(posixPath)) return "test";
  if (/\.stories\.(?:svelte|[cm]?[jt]sx?)$/u.test(posixPath)) return "story";
  if (
    posixPath.startsWith("scripts/") ||
    posixPath.startsWith("dev/") ||
    posixPath.startsWith(".storybook/")
  )
    return "script";
  return "production";
}

export function layerOf(posixPath) {
  const match = posixPath.match(/^src\/([^/]+)\//u);
  if (!match) return posixPath.startsWith("src/") ? "other" : "scripts";
  const dir = match[1];
  if (dir === "fixture" || dir === "materializer") return "support";
  if (
    [
      "protocol",
      "nostr",
      "auth",
      "community",
      "projects",
      "registry",
      "components",
      "testing",
    ].includes(dir)
  )
    return dir;
  return "other";
}

export function isTestLike(posixPath) {
  const kind = fileKind(posixPath);
  return kind === "test" || kind === "story";
}

export function isTestingPath(posixPath) {
  return (
    posixPath.startsWith("src/testing/") ||
    isTestLike(posixPath) ||
    /(?:^|\/)[^/]*(?:Harness|Fixture)\.svelte$/u.test(posixPath)
  );
}

export function packageExportPath(specifier) {
  if (specifier === PACKAGE_PREFIX) return PACKAGE_EXPORTS[""];
  if (!specifier.startsWith(`${PACKAGE_PREFIX}/`)) return null;
  const rest = specifier.slice(PACKAGE_PREFIX.length + 1);
  return PACKAGE_EXPORTS[rest] ?? `src/${rest}`;
}

export function matrixCell(fromLayer, toLayer) {
  if (fromLayer === "other" || fromLayer === "scripts") return R;
  if (toLayer === "other") return R;
  return MATRIX[fromLayer]?.[toLayer] ?? X;
}

export function isPendingTypeEdge(fromLayer, toLayer) {
  return PENDING_TYPE.has(`${fromLayer}>${toLayer}`);
}

export function featureBarrel(posixPath) {
  const match = posixPath.match(/^(src\/[^/]+)\/index\.[cm]?[jt]sx?$/u);
  return match?.[1] ?? null;
}

export function isSelfBarrelImport(importer, imported) {
  const parent = importer.match(/^(src\/community)\//u)?.[1];
  if (!parent) return false;
  if (importer === `${parent}/index.ts` || importer === `${parent}/index.js`)
    return false;
  return (
    imported === `${parent}/index.ts` ||
    imported === `${parent}/index.js` ||
    imported === `${parent}/index.svelte.ts`
  );
}

export const HOTSPOT_JUSTIFICATIONS = {
  "src/community/community-controller.svelte.ts":
    "Svelte 5 controller factory; history, Pulse, and operations extracted",
  "src/components/community-application/CommunityApplication.svelte":
    "Application composition root; extract destination hosts before adding behaviour",
  "src/components/community-projects/CommunityProjects.svelte":
    "Projects composition root; extract named surfaces before adding behaviour",
};
