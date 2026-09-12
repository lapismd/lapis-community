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
    ).toEqual([
      "github",
      "google",
      "keytr",
      "browser-extension",
      "remote-signer",
    ]);
    expect(resolveCommunityLoginMethods(methods, true)).toEqual(methods);
  });

  it("places Keytr first inside the configured Nostr signer group", () => {
    expect(
      resolveCommunityLoginMethods(
        [
          COMMUNITY_LOGIN_METHODS.remoteSigner,
          COMMUNITY_LOGIN_METHODS.keytr,
          COMMUNITY_LOGIN_METHODS.browserExtension,
        ],
        false,
        ["github", "google"],
      ).map((method) => method.kind),
    ).toEqual([
      "github",
      "google",
      "keytr",
      "remote-signer",
      "browser-extension",
    ]);
  });

  it("orders relay providers before the default Nostr signer methods", () => {
    expect(
      resolveCommunityLoginMethods(undefined, false, ["google", "github"]).map(
        (method) => method.kind,
      ),
    ).toEqual(["github", "google", "browser-extension", "remote-signer"]);
  });
});
