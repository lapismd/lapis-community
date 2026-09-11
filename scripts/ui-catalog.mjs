import fs from "node:fs";
const catalog = JSON.parse(
  fs.readFileSync(
    new URL("../src/components/ui-catalog.json", import.meta.url),
    "utf8",
  ),
);
const query = process.argv.slice(2).join(" ").toLowerCase();
for (const p of catalog.patterns.filter((p) =>
  JSON.stringify(p).toLowerCase().includes(query),
))
  console.log(
    `${p.name}: ${p.when}\n  Import: ${p.import} (${p.component})\n  Example: ${p.example}\n  Story: /?path=/story/${p.story}\n  Variants: ${p.variants.join(", ")}\n  Contract: ${p.requiredStates.join(", ")}\n  Spec: ${p.requirement}\n`,
  );
