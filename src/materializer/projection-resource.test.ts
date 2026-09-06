import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  projectionResourceSourceConfiguration,
  resolveProjectionResourceSource,
  resolveProjectionSourceUrl,
  verifyProjectionResourceBytes,
  type ProjectionResource,
} from "./projection-resource.js";

const bytes = new TextEncoder().encode("verified image");
const image: ProjectionResource = {
  url: "/registry/assets/ai/image.webp",
  sourceUrl: "https://signed.example/assets/ai/image.webp?token=signed",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  size: bytes.byteLength,
  mediaType: "image/webp",
};

describe("projection resource source resolution", () => {
  it("loads every resource from BLOSSOM_URL by its verified content hash", () => {
    const configuration = projectionResourceSourceConfiguration({
      BLOSSOM_URL: "https://blossom.example/blobs",
      REGISTRY_ASSET_FETCH_ORIGIN: "https://legacy.example/files/",
    });
    expect(
      resolveProjectionResourceSource(image, configuration).toString(),
    ).toBe(`https://blossom.example/blobs/${image.sha256}`);

    const markdown = { ...image, mediaType: "text/markdown" };
    expect(
      resolveProjectionResourceSource(markdown, configuration).toString(),
    ).toBe(`https://blossom.example/blobs/${image.sha256}`);
  });

  it("uses the legacy override for images when Blossom is absent", () => {
    const configuration = projectionResourceSourceConfiguration({
      REGISTRY_ASSET_FETCH_ORIGIN: "https://legacy.example/files",
    });
    expect(
      resolveProjectionResourceSource(image, configuration).toString(),
    ).toBe("https://legacy.example/files/assets/ai/image.webp");
  });

  it("retains legacy non-image behavior only when Blossom is absent", () => {
    const markdown = { ...image, mediaType: "text/markdown" };
    const blossomOnly = projectionResourceSourceConfiguration({
      BLOSSOM_URL: "https://blossom.example/",
    });
    expect(
      resolveProjectionResourceSource(markdown, blossomOnly).toString(),
    ).toBe(`https://blossom.example/${image.sha256}`);

    const withLegacy = projectionResourceSourceConfiguration({
      BLOSSOM_URL: "https://blossom.example/",
      REGISTRY_ASSET_FETCH_ORIGIN: "https://legacy.example/",
    });
    expect(
      resolveProjectionResourceSource(markdown, withLegacy).toString(),
    ).toBe(`https://blossom.example/${image.sha256}`);
  });

  it.each([
    ["relative/path"],
    ["ftp://blossom.example/"],
    ["https://user:secret@blossom.example/"],
  ])("rejects invalid or credentialed BLOSSOM_URL values", (value) => {
    expect(() =>
      projectionResourceSourceConfiguration({ BLOSSOM_URL: value }),
    ).toThrow("absolute HTTP(S) URL without credentials");
  });

  it("validates the legacy origin override with the same transport rules", () => {
    expect(() =>
      projectionResourceSourceConfiguration({
        REGISTRY_ASSET_FETCH_ORIGIN: "https://user@legacy.example/",
      }),
    ).toThrow("REGISTRY_ASSET_FETCH_ORIGIN must be an absolute HTTP(S) URL");
  });

  it("uses the signed source URL when no override is configured", () => {
    expect(resolveProjectionResourceSource(image).toString()).toBe(
      image.sourceUrl,
    );
  });

  it("rebases manifest URLs onto the internal fixture origin", () => {
    expect(
      resolveProjectionSourceUrl(
        "http://127.0.0.1:8090/manifest-hash.json",
        new URL("http://registry-fixture:8090/"),
      ).toString(),
    ).toBe("http://registry-fixture:8090/manifest-hash.json");
  });
});

describe("projection resource verification", () => {
  it("accepts only the declared size and SHA-256", () => {
    expect(() => verifyProjectionResourceBytes(image, bytes)).not.toThrow();
    expect(() =>
      verifyProjectionResourceBytes({ ...image, size: image.size + 1 }, bytes),
    ).toThrow("size mismatch");
    expect(() =>
      verifyProjectionResourceBytes(
        { ...image, sha256: "0".repeat(64) },
        bytes,
      ),
    ).toThrow("hash mismatch");
  });
});
