import type {
  RegistryCatalogDataSource,
  RegistryCatalogDetail,
  RegistryCatalogEntry,
  RegistryCatalogIndex,
  RegistryImageReference,
  RegistryMarkdownReference,
  RegistryResolvedDetail,
} from "../../registry/index.js";
import { renderRegistryMarkdown } from "../../registry/index.js";

const sha256 = "0".repeat(64);

interface PluginFixture {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: string;
  accent: string;
  channel: "official" | "community";
  status: RegistryCatalogEntry["status"];
  version: string;
  categories: string[];
  platforms: string[];
  releasedAt: string;
  bundleSize: number;
  badges?: string[];
}

const fixtures: PluginFixture[] = [
  {
    id: "ai",
    name: "AI Assistant",
    description: "Draft, revise, and explore ideas without leaving your notes.",
    author: "Lapis Labs",
    icon: "sparkles",
    accent: "#8b5cf6",
    channel: "official",
    status: "active",
    version: "1.4.0",
    categories: ["ai", "productivity"],
    platforms: ["desktop", "web"],
    releasedAt: "2026-08-31T10:00:00.000Z",
    bundleSize: 842_108,
    badges: ["featured"],
  },
  {
    id: "slides",
    name: "Slides",
    description: "Turn Markdown documents into clear, themeable presentations.",
    author: "Lapis Labs",
    icon: "presentation",
    accent: "#ec4899",
    channel: "official",
    status: "active",
    version: "1.2.1",
    categories: ["presentation", "productivity"],
    platforms: ["desktop", "web"],
    releasedAt: "2026-08-29T09:15:00.000Z",
    bundleSize: 624_392,
    badges: ["featured"],
  },
  {
    id: "graph",
    name: "Graph View",
    description:
      "Explore the connections between notes in an interactive graph.",
    author: "Maya Chen",
    icon: "network",
    accent: "#0ea5e9",
    channel: "community",
    status: "active",
    version: "0.9.3",
    categories: ["knowledge", "visualization"],
    platforms: ["desktop"],
    releasedAt: "2026-08-25T14:30:00.000Z",
    bundleSize: 1_340_009,
    badges: ["featured"],
  },
  {
    id: "bases",
    name: "Bases",
    description:
      "Create database-like views over frontmatter and note properties.",
    author: "Lapis Labs",
    icon: "table-2",
    accent: "#14b8a6",
    channel: "official",
    status: "pending",
    version: "0.8.0-beta.2",
    categories: ["data", "productivity"],
    platforms: ["desktop", "web"],
    releasedAt: "2026-08-30T16:45:00.000Z",
    bundleSize: 1_044_020,
  },
  {
    id: "search-plus",
    name: "Search Plus",
    description:
      "Find concepts quickly with saved searches and result previews.",
    author: "Owen Harper",
    icon: "search",
    accent: "#f59e0b",
    channel: "community",
    status: "active",
    version: "2.0.0",
    categories: ["search", "productivity"],
    platforms: ["desktop", "web", "mobile"],
    releasedAt: "2026-08-24T12:00:00.000Z",
    bundleSize: 454_210,
  },
  {
    id: "bookmarks",
    name: "Bookmarks",
    description: "Keep important notes, headings, and searches close at hand.",
    author: "Lapis Labs",
    icon: "bookmark",
    accent: "#22c55e",
    channel: "official",
    status: "active",
    version: "1.1.0",
    categories: ["navigation", "productivity"],
    platforms: ["desktop", "web", "mobile"],
    releasedAt: "2026-08-18T08:00:00.000Z",
    bundleSize: 282_144,
  },
  {
    id: "revision-history",
    name: "Revision History",
    description: "Review and restore earlier versions of a note.",
    author: "Priya Nair",
    icon: "history",
    accent: "#6366f1",
    channel: "community",
    status: "deprecated",
    version: "0.6.4",
    categories: ["history", "backup"],
    platforms: ["desktop"],
    releasedAt: "2026-07-28T11:20:00.000Z",
    bundleSize: 712_512,
  },
  {
    id: "legacy-export",
    name: "Legacy Export",
    description: "Export notebooks for an older interchange format.",
    author: "Community Archive",
    icon: "file-text",
    accent: "#64748b",
    channel: "community",
    status: "revoked",
    version: "0.3.0",
    categories: ["export", "markdown"],
    platforms: ["desktop"],
    releasedAt: "2026-06-12T17:00:00.000Z",
    bundleSize: 198_312,
  },
];

export const registryStoryEntries: RegistryCatalogEntry[] = fixtures.map(
  (plugin) => ({
    schemaVersion: 1,
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    author: plugin.author,
    appearance: { icon: plugin.icon, accent: plugin.accent },
    channel: plugin.channel,
    status: plugin.status,
    latestVersion: plugin.version,
    minAppVersion: "1.0.0",
    platforms: plugin.platforms,
    categories: plugin.categories,
    badges: plugin.badges ?? [],
    owner: {
      name: plugin.author,
      verified: plugin.channel === "official",
      url: `https://example.com/authors/${plugin.id}`,
    },
    latestRelease: {
      releasedAt: plugin.releasedAt,
      bundleSize: plugin.bundleSize,
    },
    detail: `plugins/${plugin.id}/index.json`,
  }),
);

export const registryStoryIndex: RegistryCatalogIndex = {
  schemaVersion: 1,
  generatedAt: "2026-09-01T09:00:00.000Z",
  plugins: registryStoryEntries,
};

const overviewReference: RegistryMarkdownReference = {
  url: "content/overview.md",
  sourceUrl: "https://example.com/overview.md",
  sha256,
  size: 0,
  mediaType: "text/markdown",
};

const changelogReference: RegistryMarkdownReference = {
  url: "content/changelog.md",
  sourceUrl: "https://example.com/changelog.md",
  sha256,
  size: 0,
  mediaType: "text/markdown",
};

function imageReference(
  label: string,
  accent: string,
  width = 960,
  height = 640,
  mode: "split" | "light" | "dark" = "split",
): RegistryImageReference {
  const background = mode === "light" ? "#e2e8f0" : "#111827";
  const panel = mode === "dark" ? "#27272a" : "#f8fafc";
  const text = mode === "dark" ? "#f8fafc" : "#334155";
  const divider =
    mode === "split"
      ? `<rect x="${width / 2}" width="${width / 2}" height="${height}" fill="#e2e8f0" opacity=".16"/>`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${divider}<circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.28)}" r="${Math.round(height * 0.34)}" fill="${accent}" opacity=".75"/><rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.15)}" width="${Math.round(width * 0.56)}" height="${Math.round(height * 0.7)}" rx="24" fill="${panel}"/><rect x="${Math.round(width * 0.13)}" y="${Math.round(height * 0.27)}" width="${Math.round(width * 0.38)}" height="18" rx="9" fill="${accent}"/><rect x="${Math.round(width * 0.13)}" y="${Math.round(height * 0.38)}" width="${Math.round(width * 0.44)}" height="12" rx="6" fill="#94a3b8"/><rect x="${Math.round(width * 0.13)}" y="${Math.round(height * 0.46)}" width="${Math.round(width * 0.34)}" height="12" rx="6" fill="#94a3b8"/><text x="${Math.round(width * 0.13)}" y="${Math.round(height * 0.68)}" fill="${text}" font-family="system-ui" font-size="32" font-weight="700">${label} · ${mode}</text></svg>`;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    sourceUrl: "https://example.com/registry-preview.svg",
    sha256,
    size: svg.length,
    mediaType: "image/svg+xml",
    width,
    height,
  };
}

function imageVariants(label: string, accent: string) {
  return {
    preview: imageReference(`${label} preview`, accent),
    full: imageReference(label, accent, 1440, 960, "split"),
    light: imageReference(label, accent, 1440, 960, "light"),
    dark: imageReference(label, accent, 1440, 960, "dark"),
  };
}

export function registryStoryDetail(
  entry = registryStoryEntries[0]!,
): RegistryCatalogDetail {
  const accent = entry.appearance?.accent ?? "#8b5cf6";
  const firstImages = imageVariants(`${entry.name} workspace`, accent);
  const secondImages = imageVariants(`${entry.name} settings`, "#0ea5e9");
  const overviewImages = imageVariants(`${entry.name} overview`, "#14b8a6");
  return {
    schemaVersion: 1,
    id: entry.id,
    name: entry.name,
    description: entry.description,
    author: entry.author,
    authorUrl: entry.owner.url,
    appearance: {
      icon: entry.appearance?.icon ?? "package",
      accent,
      logo: {
        ...imageReference(entry.name, accent, 160, 160, "light"),
        alt: `${entry.name} logo`,
      },
    },
    media: {
      banner: {
        alt: `${entry.name} running inside Lapis Notes`,
        images: firstImages,
      },
      overview: {
        alt: `${entry.name} overview`,
        images: overviewImages,
      },
    },
    gallery: [
      {
        id: "workspace",
        alt: `${entry.name} workspace`,
        images: firstImages,
      },
      {
        id: "settings",
        alt: `${entry.name} settings`,
        images: secondImages,
      },
    ],
    channel: entry.channel,
    status: entry.status,
    owner: entry.owner,
    latestVersion: entry.latestVersion,
    license: "MIT",
    links: {
      homepage: `https://example.com/plugins/${entry.id}`,
      repository: `https://example.com/source/${entry.id}`,
      documentation: `https://example.com/docs/${entry.id}`,
      issues: `https://example.com/issues/${entry.id}`,
    },
    highlights: [
      "Works directly in the editor",
      "Uses your current Lapis theme",
      "Designed for keyboard and screen reader access",
    ],
    content: {
      overview: overviewReference,
      changelog: changelogReference,
    },
    contributes: {
      editorViews: [
        {
          id: `${entry.id}-view`,
          label: entry.name,
          filenamePatterns: ["*.md"],
        },
      ],
    },
    versions: {
      [entry.latestVersion]: {
        version: entry.latestVersion,
        minAppVersion: entry.minAppVersion,
        releasedAt:
          entry.latestRelease?.releasedAt ?? "2026-08-01T00:00:00.000Z",
        platforms: entry.platforms,
        bundle: {
          url: `bundles/${entry.id}-${entry.latestVersion}.lapis-plugin`,
          downloadUrl: `https://example.com/download/${entry.id}/${entry.latestVersion}`,
          sha256,
          size: entry.latestRelease?.bundleSize ?? 500_000,
          ...(entry.status === "pending" ? { pending: true } : {}),
        },
      },
      "0.9.0": {
        version: "0.9.0",
        minAppVersion: "1.0.0",
        releasedAt: "2026-07-14T12:00:00.000Z",
        platforms: entry.platforms,
        bundle: {
          url: `bundles/${entry.id}-0.9.0.lapis-plugin`,
          sha256,
          size: 420_000,
        },
      },
    },
  };
}

export function registryStoryResolvedDetail(
  entry = registryStoryEntries[0]!,
): RegistryResolvedDetail {
  return {
    entry,
    detail: registryStoryDetail(entry),
    overviewHtml: renderRegistryMarkdown(
      `# ${entry.name}\n\n${entry.description}\n\n## Built for your notes\n\n- Stay in context while you work\n- Keep host controls explicit\n- Browse community discussion below`,
    ),
    changelogHtml: renderRegistryMarkdown(
      "# Changelog\n\n## 1.4.0\n\nImproved editor integration and accessibility.\n\n## 1.3.0\n\nAdded configurable shortcuts.",
    ),
  };
}

export function createRegistryStoryDataSource(
  releaseEventIds: readonly string[] = [],
): RegistryCatalogDataSource & {
  detailLoads: ReadonlyMap<string, number>;
  inspectionLoads: ReadonlyMap<string, number>;
} {
  const detailLoads = new Map<string, number>();
  const inspectionLoads = new Map<string, number>();
  const recognizedReleaseEventIds = new Set(releaseEventIds);
  return {
    detailLoads,
    inspectionLoads,
    async loadIndex() {
      return registryStoryIndex;
    },
    async loadRuntime() {
      return null;
    },
    async loadPluginDetail(entry) {
      detailLoads.set(entry.id, (detailLoads.get(entry.id) ?? 0) + 1);
      return registryStoryDetail(entry);
    },
    async loadMarkdown(reference) {
      return reference.url.includes("changelog")
        ? "# Changelog\n\n## 1.4.0\n\nImproved editor integration and accessibility."
        : "# Work with your notes\n\nKeep your ideas flowing with a plugin designed for the Lapis workspace.\n\n- Fast, focused commands\n- Theme-aware presentation\n- Community support";
    },
    async loadReleaseInspection(eventId) {
      if (!recognizedReleaseEventIds.has(eventId)) return undefined;
      inspectionLoads.set(eventId, (inspectionLoads.get(eventId) ?? 0) + 1);
      const resolved = registryStoryResolvedDetail();
      return {
        eventId,
        pluginId: resolved.entry.id,
        version: resolved.entry.latestVersion,
        manifestSha256: sha256,
        state: "approved",
        preview: { entry: resolved.entry, detail: resolved.detail },
        diagnostics: [],
      };
    },
  };
}
