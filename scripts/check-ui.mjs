import fs from "node:fs";
import path from "node:path";
import { inspectSource, validateCatalog } from "./ui-policy.mjs";
const root = process.cwd(),
  catalog = JSON.parse(
    fs.readFileSync("src/components/ui-catalog.json", "utf8"),
  );
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
const diagnostics = validateCatalog(catalog, root);
for (const file of files("src/components"))
  if (
    /\.(svelte|css|ts|js|mjs)$/.test(file) &&
    !/\.(stories|test)\./.test(file) &&
    !/(?:Harness|Fixture)\.svelte$/.test(file)
  )
    diagnostics.push(
      ...inspectSource(fs.readFileSync(file, "utf8"), file, catalog.exceptions),
    );
for (const d of diagnostics)
  console.error(
    `${d.file}:${d.line} [UI-${d.rule}] ${d.detail}. Use ${d.replacement}. Example: ${d.example}`,
  );
if (diagnostics.length) process.exitCode = 1;
else
  console.log(
    `UI policy passed: ${catalog.patterns.length} catalog patterns; no governed-pattern violations.`,
  );
