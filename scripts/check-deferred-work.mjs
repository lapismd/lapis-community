import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = process.cwd();
const specificationRoot = path.join(repositoryRoot, "spec", "src");
const ledgerPath = path.join(specificationRoot, "deferred-work.md");
const allowedStates = new Set([
  "Planned",
  "Protocol decision",
  "External dependency",
  "Manual gate",
  "Deliberate exclusion",
]);
const deferredIdPattern = /^DEFER-[A-Z]+-\d{3}$/u;
const requirementIdPattern = /^LC-(?:ARCH|NOSTR|OPS|SPEC|UI)-\d{3}$/u;

const failures = [];
const ledger = await readFile(ledgerPath, "utf8");
const block = ledger.match(
  /<!-- deferred-work:start -->([\s\S]*?)<!-- deferred-work:end -->/u,
);
if (block === null) {
  failures.push(
    "deferred-work.md must contain one bounded deferred-work table",
  );
}

const tableLines = (block?.[1] ?? "")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("|") && line.endsWith("|"));
const parseRow = (line) =>
  line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
const expectedHeaders = [
  "ID",
  "Area",
  "State",
  "Owner",
  "Deferred outcome",
  "Exit condition",
  "Related requirements",
];
const headers = tableLines.length === 0 ? [] : parseRow(tableLines[0]);
if (headers.join("\0") !== expectedHeaders.join("\0")) {
  failures.push(
    `deferred-work.md table headers must be: ${expectedHeaders.join(", ")}`,
  );
}

const entries = new Map();
for (const line of tableLines.slice(2)) {
  const cells = parseRow(line);
  if (cells.length !== expectedHeaders.length) {
    failures.push(`deferred-work.md row has ${cells.length} cells: ${line}`);
    continue;
  }
  const [id, area, state, owner, outcome, exitCondition, requirements] = cells;
  if (!deferredIdPattern.test(id)) {
    failures.push(`invalid deferred-work ID: ${id}`);
    continue;
  }
  if (entries.has(id)) failures.push(`duplicate deferred-work ID: ${id}`);
  if (![area, owner, outcome, exitCondition, requirements].every(Boolean)) {
    failures.push(`deferred-work row ${id} has an empty required field`);
  }
  if (!allowedStates.has(state)) {
    failures.push(`deferred-work row ${id} has unsupported state: ${state}`);
  }
  for (const requirement of requirements
    .split(",")
    .map((value) => value.trim())) {
    if (!requirementIdPattern.test(requirement)) {
      failures.push(
        `deferred-work row ${id} has invalid requirement ID: ${requirement}`,
      );
    }
  }
  entries.set(id, { state });
}
if (entries.size === 0) failures.push("deferred-work.md has no tracked items");

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".md"))
      files.push(entryPath);
  }
  return files;
}

const referencePattern = /\[deferred:\s*(DEFER-[A-Z]+-\d{3})\]/gu;
for (const file of await markdownFiles(specificationRoot)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(referencePattern)) {
    if (!entries.has(match[1])) {
      failures.push(
        `${path.relative(repositoryRoot, file)} references unknown ${match[1]}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`Deferred-work policy failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Deferred-work policy passed: ${entries.size} tracked items.`);
}
