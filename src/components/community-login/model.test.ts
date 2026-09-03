import { describe, expect, it } from "vitest";

import {
  COMMUNITY_LOGIN_METHODS,
  DEFAULT_COMMUNITY_LOGIN_METHODS,
  resolveCommunityLoginMethods,
} from "./model.js";

describe("resolveCommunityLoginMethods", () => {
  it("offers extension and remote-signer methods by default", () => {
    expect(resolveCommunityLoginMethods()).toEqual(
      DEFAULT_COMMUNITY_LOGIN_METHODS,
    );
    expect(resolveCommunityLoginMethods().map((method) => method.kind)).toEqual(
      ["browser-extension", "remote-signer"],
    );
  });

  it("adds local-key methods only when explicitly enabled", () => {
    expect(
      resolveCommunityLoginMethods(undefined, true).map(
        (method) => method.kind,
      ),
    ).toEqual([
      "browser-extension",
      "remote-signer",
      "create-account",
      "private-key",
    ]);
  });

  it("filters local-key methods from a custom list unless enabled", () => {
    const methods = Object.values(COMMUNITY_LOGIN_METHODS);
    expect(
      resolveCommunityLoginMethods(methods).map((method) => method.kind),
    ).toEqual(["browser-extension", "remote-signer"]);
    expect(resolveCommunityLoginMethods(methods, true)).toEqual(methods);
  });
});
