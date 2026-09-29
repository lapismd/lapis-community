import fs from "node:fs";
import { describe, expect, it } from "vitest";

const packageManifest = JSON.parse(fs.readFileSync("package.json", "utf8"));

const expectedSubpaths = {
  "./components/community-message":
    "./dist/components/community-message/index.js",
  "./components/community-chat-composer":
    "./dist/components/community-chat-composer/index.js",
};

describe("focused public component subpaths", () => {
  for (const [subpath, runtimeEntry] of Object.entries(expectedSubpaths)) {
    it(`exports ${subpath} without the aggregate component barrel`, () => {
      expect(packageManifest.exports[subpath]).toEqual({
        types: runtimeEntry.replace(/\.js$/, ".d.ts"),
        svelte: runtimeEntry,
        import: runtimeEntry,
        default: runtimeEntry,
      });
      expect(
        fs.existsSync(
          runtimeEntry.replace("./dist/", "src/").replace(/\.js$/, ".ts"),
        ),
      ).toBe(true);
    });
  }
});
