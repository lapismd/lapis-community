import path from "node:path";

import { createFixtureFiles } from "./keys.js";

const outputIndex = process.argv.indexOf("--output");
const output =
  outputIndex === -1
    ? ".local/registry-fixture"
    : process.argv[outputIndex + 1];
if (output === undefined) {
  throw new Error("usage: registry-local-fixture init [--output <directory>]");
}

const files = await createFixtureFiles(path.resolve(output));
console.log(
  `Prepared ignored local fixture material in ${path.dirname(files.secretsFile)}.`,
);
