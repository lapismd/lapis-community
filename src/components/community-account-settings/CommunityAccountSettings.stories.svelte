<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    RelayCustodyTransferHandoff,
    type CommunityAccountSession,
    type CommunityRelayAuthConfig,
  } from "../../auth/index.js";
  import CommunityAccountSettings from "./CommunityAccountSettings.svelte";

  const config: CommunityRelayAuthConfig = {
    providers: ["github", "google"],
    capabilities: {
      github_linking: true,
      managed_signing: true,
      nip44: true,
      nip46: true,
      nostr_login: true,
      passkey_registration: true,
      github_disconnect: true,
      nip46_management: true,
      custody_transfer: true,
    },
  };

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
    passkey_count: 1,
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
  name="Managed account controls"
  args={{
    account: managed,
    config,
    authenticationState: "connected",
    actions: {
      copyPublicKey: fn(),
      disconnectGitHub: fn(),
      beginCustodyTransfer: fn(async () =>
        RelayCustodyTransferHandoff.create(
          "2026-09-19T10:05:00Z",
          "transfer-1",
          "custody-challenge-value",
          new Uint8Array(32).fill(7),
        ),
      ),
      completeCustodyTransfer: fn(),
      signOut: fn(),
    },
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByRole("heading", { name: "Account" }),
    ).toBeVisible();
    await expect(canvas.getByText("Managed by Lapis")).toBeVisible();
    await expect(canvas.getAllByText("@stevejuma")).toHaveLength(2);
    await expect(
      canvas.getByRole("button", { name: "Disconnect GitHub access" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: "Move signing to a remote signer",
      }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy public key" }),
    );
    await expect(args.actions?.copyPublicKey).toHaveBeenCalledWith(
      managed.account.nostr_pubkey,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
    await expect(args.actions?.signOut).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="External signer reconnect"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile1", isRotated: false },
  }}
  args={{
    account: external,
    config,
    authenticationState: "reconnect-required",
    message: "Reconnect the Nostr signer before an action needs a signature.",
    actions: {
      copyPublicKey: fn(),
      connectGitHub: fn(),
      registerPasskey: fn(),
      reconnectSigner: fn(),
      connectRemoteSigner: fn(),
      signOut: fn(),
    },
  }}
  play={async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByText("Browser/device signer")).toBeVisible();
    await expect(canvas.getByText("pending")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Reconnect GitHub" }),
    );
    await expect(args.actions?.connectGitHub).toHaveBeenCalledOnce();
    await userEvent.click(
      canvas.getByRole("button", { name: "Use remote signer" }),
    );
    const documentCanvas = within(canvasElement.ownerDocument.body);
    await expect(
      documentCanvas.getByRole("heading", { name: "Connect a remote signer" }),
    ).toBeVisible();
    await userEvent.click(
      documentCanvas.getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() =>
      expect(
        documentCanvas.queryByRole("heading", {
          name: "Connect a remote signer",
        }),
      ).not.toBeInTheDocument(),
    );
  }}
/>

<Story
  name="Active remote signer"
  args={{
    account: {
      ...managed,
      signer_type: "nip46",
      identities: managed.identities.slice(0, 1),
      github_status: "disconnected",
    },
    config,
    authenticationState: "connected",
    actions: {
      connectGitHub: fn(),
      switchRemoteSignerRelays: fn(async () => ["wss://signer.example"]),
      disconnectRemoteSigner: fn(),
      signOut: fn(),
    },
  }}
  play={async ({ canvas, args }) => {
    await expect(canvas.getByText("Remote signer")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Check signer relays" }),
    );
    await expect(args.actions?.switchRemoteSignerRelays).toHaveBeenCalledOnce();
    await expect(
      canvas.getByText(/Remote signer relays refreshed/u),
    ).toBeVisible();
  }}
/>

<Story
  name="Passkey resumption"
  args={{
    account: { ...external, github_status: "unlinked" },
    config,
    authenticationState: "reconnect-required",
    resumeAction: "register-passkey",
    actions: {
      registerPasskey: fn(),
      clearResumeAction: fn(),
      reconnectSigner: fn(),
      connectGitHub: fn(),
      signOut: fn(),
    },
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByText("Continue adding your passkey"),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }));
    await expect(args.actions?.registerPasskey).toHaveBeenCalledOnce();
    await expect(args.actions?.clearResumeAction).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Migration pending"
  args={{
    account: {
      ...managed,
      signer_status: "migration_pending",
      github_status: "unlinked",
    },
    config,
    authenticationState: "reconnect-required",
    actions: {
      connectGitHub: fn(),
      beginCustodyTransfer: fn(async () =>
        RelayCustodyTransferHandoff.create(
          "2026-09-19T10:05:00Z",
          "transfer-2",
          "custody-challenge-value",
          new Uint8Array(32).fill(11),
        ),
      ),
      completeCustodyTransfer: fn(),
      signOut: fn(),
    },
  }}
  play={async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByText("Migration pending")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Resume signing-key transfer" }),
    );
    const documentCanvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      documentCanvas.getByRole("button", { name: "Restart transfer" }),
    );
    await expect(args.actions?.beginCustodyTransfer).toHaveBeenCalledOnce();
    await expect(
      documentCanvas.getByLabelText("Nostr private key"),
    ).toBeVisible();
  }}
/>
