import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_ORIGIN, writeFixtureBundle } from "./bundle.js";
import { loadLocalPluginFixtures } from "./source.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const source = process.argv[2] ?? path.resolve(root, "../lapis-plugins");
const output = path.resolve(root, "deploy/fixture-v1.json.gz");
const fixtures = await loadLocalPluginFixtures(source, {
  publicBaseUrl: new URL(FIXTURE_ORIGIN),
});
await writeFixtureBundle(output, fixtures);
console.log(`Frozen ${fixtures.length} plugins into deploy/fixture-v1.json.gz`);
