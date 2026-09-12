import { expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadFixtureBundle, FIXTURE_ORIGIN } from "./bundle.js";

it("loads all 13 pinned plugins without a source checkout and resolves public resource URLs", async () => {
  const file = fileURLToPath(
    new URL("../../deploy/fixture-v1.json.gz", import.meta.url),
  );
  const fixtures = await loadFixtureBundle(
    file,
    new URL("https://relay.example/"),
  );
  expect(fixtures).toHaveLength(13);
  expect(fixtures.some((fixture) => fixture.plugin.pluginId === "ai")).toBe(
    true,
  );
  expect(JSON.stringify(fixtures.map(({ plugin }) => plugin))).not.toContain(
    FIXTURE_ORIGIN,
  );
  expect(
    fixtures.flatMap((fixture) => fixture.resources).length,
  ).toBeGreaterThan(13);
  const again = await loadFixtureBundle(
    file,
    new URL("https://relay.example/"),
  );
  expect(
    again.map(({ plugin, artifact, resources }) => ({
      plugin,
      artifact: artifact.sha256,
      resources: resources.map(({ sha256 }) => sha256),
    })),
  ).toEqual(
    fixtures.map(({ plugin, artifact, resources }) => ({
      plugin,
      artifact: artifact.sha256,
      resources: resources.map(({ sha256 }) => sha256),
    })),
  );
});
