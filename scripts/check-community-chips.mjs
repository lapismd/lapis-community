import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DESIGN_CORE_BADGE_IMPORT =
  /from\s+["']@lapismd\/design-core\/shadcn\/badge["']/u;
const BADGE_COMPONENT = /<Badge\b/u;
const COMMUNITY_CHIP_SOURCE =
  "src/components/community-chip/CommunityChip.svelte";
const NATIVE_CLASS =
  /<(a|button|div|span|strong)\b[^>]*\bclass\s*=\s*["']([^"']+)["'][^>]*>/gu;
const SPOOFED_BADGE =
  /<(a|button|div|span|strong)\b[^>]*\bdata-ui-component\s*=\s*["']badge["'][^>]*>/gu;
const CHIP_CLASS =
  /(?:^|[-_])(?:badge|chip|pill|tab-count)(?:--[a-z0-9_-]+)?$/iu;
const CHIP_STYLE_SELECTOR =
  /\.[A-Za-z0-9_-]*(?:badge|chip|pill|tab-count)(?![A-Za-z0-9_-])|\[data-ui-part\s*=\s*["']community-chip["']\]/iu;
const CHIP_STYLE_PROPERTY =
  /\b(?:background(?:-color)?|border(?:-color|-radius)?|color|font-size|font-weight|height|line-height|min-height|padding(?:-[a-z-]+)?)\s*:/iu;

function lineFor(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

export function inspectCommunityChipUsage(source, file = "component.svelte") {
  const findings = [];
  const normalizedFile = file.replaceAll("\\", "/");
  const isCommunityChipSource = normalizedFile.endsWith(COMMUNITY_CHIP_SOURCE);

  if (
    !isCommunityChipSource &&
    (DESIGN_CORE_BADGE_IMPORT.test(source) || BADGE_COMPONENT.test(source))
  ) {
    const importOffset = source.search(DESIGN_CORE_BADGE_IMPORT);
    const badgeOffset = source.search(BADGE_COMPONENT);
    findings.push({
      file,
      line: lineFor(source, importOffset >= 0 ? importOffset : badgeOffset),
      message:
        "Chip presentations must use the shared CommunityChip component; only CommunityChip may compose Design Core Badge directly.",
    });
  }

  for (const match of source.matchAll(NATIVE_CLASS)) {
    const classNames = match[2].split(/\s+/u);
    if (!classNames.some((className) => CHIP_CLASS.test(className))) continue;
    findings.push({
      file,
      line: lineFor(source, match.index),
      message:
        "Chip-like native markup must use the shared CommunityChip component.",
    });
  }

  for (const match of source.matchAll(SPOOFED_BADGE)) {
    findings.push({
      file,
      line: lineFor(source, match.index),
      message: 'Do not spoof data-ui-component="badge"; render CommunityChip.',
    });
  }

  if (isCommunityChipSource) return findings;

  const stylesheets = file.endsWith(".css")
    ? [{ stylesheet: source, offset: 0 }]
    : [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gu)].map(
        (styleMatch) => ({
          stylesheet: styleMatch[1],
          offset: styleMatch.index + styleMatch[0].indexOf(styleMatch[1]),
        }),
      );
  for (const { stylesheet, offset } of stylesheets) {
    for (const block of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      const selector = block[1].trim();
      const declarations = block[2];
      if (
        !CHIP_STYLE_SELECTOR.test(selector) ||
        !CHIP_STYLE_PROPERTY.test(declarations)
      )
        continue;
      findings.push({
        file,
        line: lineFor(source, offset + block.index),
        message:
          "Chip appearance must come from CommunityChip variants, not consumer CSS.",
      });
    }
  }

  return findings;
}

export function collectUiFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectUiFiles(path);
    return [".css", ".svelte"].includes(extname(entry.name)) ? [path] : [];
  });
}

export function inspectRepository(root = process.cwd()) {
  const sourceRoot = join(root, "src");
  return collectUiFiles(sourceRoot).flatMap((path) =>
    inspectCommunityChipUsage(readFileSync(path, "utf8"), relative(root, path)),
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const findings = inspectRepository();
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line}: ${finding.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Community chip policy passed.");
  }
}
