import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import type { LocalPluginFixture } from "./source.js";

export const FIXTURE_ORIGIN = "https://fixture.invalid/";
type EncodedFixture = Omit<LocalPluginFixture, "artifact" | "resources"> & {
  artifact: Omit<LocalPluginFixture["artifact"], "bytes"> & { base64: string };
  resources: (Omit<LocalPluginFixture["resources"][number], "bytes"> & {
    base64: string;
  })[];
};

export async function writeFixtureBundle(
  file: string,
  fixtures: LocalPluginFixture[],
): Promise<void> {
  const encoded: EncodedFixture[] = fixtures.map(
    ({ artifact, resources, ...fixture }) => ({
      ...fixture,
      artifact: {
        path: artifact.path,
        sha256: artifact.sha256,
        base64: Buffer.from(artifact.bytes).toString("base64"),
      },
      resources: resources.map(({ bytes, ...resource }) => ({
        ...resource,
        base64: Buffer.from(bytes).toString("base64"),
      })),
    }),
  );
  await writeFile(
    file,
    gzipSync(
      JSON.stringify({
        schema: "lapis.community.fixture/1",
        fixtures: encoded,
      }),
      { level: 9 },
    ),
  );
}

export async function loadFixtureBundle(
  file: string,
  publicBaseUrl: URL,
): Promise<LocalPluginFixture[]> {
  const bundle = JSON.parse(
    gunzipSync(await readFile(file)).toString("utf8"),
  ) as { schema: string; fixtures: EncodedFixture[] };
  if (
    bundle.schema !== "lapis.community.fixture/1" ||
    !Array.isArray(bundle.fixtures) ||
    bundle.fixtures.length === 0
  ) {
    throw new Error("Invalid static fixture bundle");
  }
  const decode = <T extends { base64: string; sha256: string }>(
    resource: T,
  ) => {
    const { base64, ...metadata } = resource;
    const bytes = Buffer.from(base64, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== resource.sha256)
      throw new Error("Static fixture resource hash mismatch");
    return { ...metadata, bytes };
  };
  return bundle.fixtures.map(({ artifact, resources, ...fixture }) => ({
    ...JSON.parse(
      JSON.stringify(fixture).replaceAll(FIXTURE_ORIGIN, publicBaseUrl.href),
    ),
    artifact: decode(artifact),
    resources: resources.map(decode),
  }));
}
