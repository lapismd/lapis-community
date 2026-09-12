import { describe, expect, it } from "vitest";

import type { CommunityAccountSession } from "../../auth/index.js";
import {
  communityAccountSignerDetails,
  communityGitHubActionLabel,
  formatCommunityAccountExpiry,
} from "./model.js";

const account: CommunityAccountSession = {
  account: {
    id: "account-a",
    nostr_pubkey: "a".repeat(64),
    created_at: "2026-09-12T10:00:00Z",
  },
  auth_provider: "google",
  expires_at: "2026-09-19T10:00:00Z",
  identities: [],
  github_status: "unlinked",
  signer_type: "managed",
  signer_status: "active",
  passkey_count: 0,
};

describe("community account settings model", () => {
  it("keeps signer custody labels distinct", () => {
    expect(communityAccountSignerDetails(account).label).toBe(
      "Managed by Lapis",
    );
    expect(
      communityAccountSignerDetails({ ...account, signer_type: "nip46" }).label,
    ).toBe("Remote signer");
    expect(
      communityAccountSignerDetails({ ...account, signer_type: "external" })
        .label,
    ).toBe("Browser/device signer");
    expect(
      communityAccountSignerDetails({
        ...account,
        signer_status: "migration_pending",
      }).label,
    ).toBe("Migration pending");
  });

  it("distinguishes GitHub connection and reconnection actions", () => {
    expect(communityGitHubActionLabel("active")).toBeUndefined();
    expect(communityGitHubActionLabel("unlinked")).toBe("Connect GitHub");
    expect(communityGitHubActionLabel("revoked")).toBe("Reconnect GitHub");
  });

  it("handles invalid session expiry values", () => {
    expect(formatCommunityAccountExpiry("invalid")).toBe("Unavailable");
  });
});
