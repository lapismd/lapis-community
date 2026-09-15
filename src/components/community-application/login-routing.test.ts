import { describe, expect, it } from "vitest";

import type { CommunityLoginMethodModel } from "../community-login/model.js";
import { shouldUseDirectApplicationLogin } from "./login-routing.js";

const methods: readonly CommunityLoginMethodModel[] = [
  {
    id: "github",
    kind: "github",
    label: "Continue with GitHub",
    description: "Use GitHub",
  },
  {
    id: "google",
    kind: "google",
    label: "Continue with Google",
    description: "Use Google",
  },
  {
    id: "private-key",
    kind: "private-key",
    label: "Import a private key",
    description: "Store a key in the host keychain",
  },
  {
    id: "account-1",
    kind: "other",
    label: "Saved account",
    description: "Stored by the host",
  },
];

describe("Community application login routing", () => {
  it("keeps provider login on the relay auth adapter", () => {
    expect(shouldUseDirectApplicationLogin("github", methods, true)).toBe(
      false,
    );
    expect(shouldUseDirectApplicationLogin("google", methods, true)).toBe(
      false,
    );
  });

  it("uses host direct login for local key creation and import", () => {
    expect(shouldUseDirectApplicationLogin("private-key", methods, true)).toBe(
      true,
    );
  });

  it("keeps saved signers on relay auth for remembered account reconnect", () => {
    expect(shouldUseDirectApplicationLogin("account-1", methods, true)).toBe(
      false,
    );
  });

  it("requires a configured direct login callback", () => {
    expect(shouldUseDirectApplicationLogin("private-key", methods, false)).toBe(
      false,
    );
    expect(shouldUseDirectApplicationLogin("missing", methods, true)).toBe(
      false,
    );
  });
});
