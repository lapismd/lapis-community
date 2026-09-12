<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import type { CommunityAccountSession } from "../../auth/index.js";
  import CommunityAccountSettings from "./CommunityAccountSettings.svelte";

  const managed: CommunityAccountSession = {
    account: {
      id: "account-managed",
      nostr_pubkey:
        "25b326777503bb9ddcc89d23cf9cdf5ce5a05a71f55cda57f9b32f4e9c9fdc6a",
      created_at: "2026-09-01T09:00:00Z",
    },
    auth_provider: "google",
    expires_at: "2026-09-19T10:00:00Z",
    identities: [
      {
        provider: "google",
        login: "steve@example.com",
        display_name: "Steve Juma",
      },
      {
        provider: "github",
        login: "stevejuma",
        display_name: "Steve Juma",
      },
    ],
    github_status: "active",
    signer_type: "managed",
    signer_status: "active",
    passkey_count: 2,
  };

  const external: CommunityAccountSession = {
    ...managed,
    account: { ...managed.account, id: "account-external" },
    auth_provider: "nostr",
    identities: [],
    github_status: "revoked",
    signer_type: "external",
    passkey_count: 0,
  };

  const { Story } = defineMeta({
    title: "Community/Navigation/Account settings",
    component: CommunityAccountSettings,
    tags: ["visual-pending"],
    parameters: { layout: "fullscreen" },
  });
</script>

<Story
  name="Managed account"
  args={{
    account: managed,
    onCopyPublicKey: fn(),
    onConnectGitHub: fn(),
    onSignOut: fn(),
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByRole("heading", { name: "Account" }),
    ).toBeVisible();
    await expect(canvas.getByText("Managed by Lapis")).toBeVisible();
    await expect(canvas.getAllByText("@stevejuma")).toHaveLength(2);
    await expect(
      canvas.queryByRole("button", { name: "Connect GitHub" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy public key" }),
    );
    await expect(args.onCopyPublicKey).toHaveBeenCalledWith(
      managed.account.nostr_pubkey,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="External signer needs GitHub reconnect"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile1", isRotated: false },
  }}
  args={{
    account: external,
    message: "Reconnect the Nostr signer before an action needs a signature.",
    onCopyPublicKey: fn(),
    onConnectGitHub: fn(),
    onSignOut: fn(),
  }}
  play={async ({ canvas, args }) => {
    await expect(canvas.getByText("Browser/device signer")).toBeVisible();
    await expect(canvas.getByText("revoked")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Reconnect GitHub" }),
    );
    await expect(args.onConnectGitHub).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Migration pending"
  args={{
    account: {
      ...managed,
      signer_type: "external",
      signer_status: "migration_pending",
      github_status: "unlinked",
    },
    onConnectGitHub: fn(),
    onSignOut: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Migration pending")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Connect GitHub" }),
    ).toBeVisible();
  }}
/>
