<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityLogin from "./CommunityLogin.svelte";
  import { COMMUNITY_LOGIN_METHODS } from "./model.js";

  const methods = Object.values(COMMUNITY_LOGIN_METHODS);
  const consumerSource = `<script lang="ts">
  import {
    CommunityLogin,
    COMMUNITY_LOGIN_METHODS,
  } from "@lapismd/lapis-community/components";

  const methods = Object.values(COMMUNITY_LOGIN_METHODS);
<\/script>

<CommunityLogin {methods} onSelect={(methodId) => beginLogin(methodId)} />`;

  const { Story } = defineMeta({
    title: "Community/Navigation/Login",
    component: CommunityLogin,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: { source: { language: "svelte", code: consumerSource } },
    },
  });
</script>

<Story
  name="Available methods"
  args={{ methods, onSelect: fn() }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByRole("heading", { name: "Connect to Nostr" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Continue with GitHub/u }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Continue with Google/u }),
    ).toBeVisible();
    await expect(canvas.getByText("Or use a Nostr signer")).toBeVisible();
    const methodButtons = canvas.getAllByRole("button");
    await expect(methodButtons[0]).toHaveAccessibleName(
      /Continue with GitHub/u,
    );
    await expect(methodButtons[1]).toHaveAccessibleName(
      /Continue with Google/u,
    );
    await expect(
      methodButtons[0]?.querySelector(
        '[data-community-provider-logo="github"]',
      ),
    ).toBeVisible();
    await expect(
      methodButtons[1]?.querySelector(
        '[data-community-provider-logo="google"]',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Browser extension/u }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Remote signer/u }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /Create a new account/u }),
    );
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledWith("create-account");
  }}
/>

<Story
  name="Dialog content"
  args={{
    methods,
    presentation: "dialog",
    title: "Sign in to the live community",
    description: "Choose a development identity provider",
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByText("Sign in to the live community"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Choose a development identity provider"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /Browser extension/u }),
    ).toBeVisible();
  }}
/>

<Story
  name="Remote signer input"
  args={{ methods, onSelect: fn() }}
  play={async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Remote signer/u }),
    );
    const input = canvas.getByLabelText("Bunker URL");
    await expect(input).toHaveAttribute("type", "password");
    await userEvent.click(
      canvas.getByRole("button", { name: "Connect remote signer" }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Paste a bunker URL before signing in",
    );
    await expect(args.onSelect).not.toHaveBeenCalled();
    await userEvent.type(input, "bunker://remote-signer.example");
    await userEvent.click(
      canvas.getByRole("button", { name: "Connect remote signer" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("remote-signer", {
      remoteSignerUrl: "bunker://remote-signer.example",
    });
  }}
/>

<Story
  name="Connecting"
  args={{
    methods,
    busy: true,
    pendingMethodId: "remote-signer",
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("main", { name: "Nostr sign in" }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      canvas.getByRole("status", { name: "Connecting with Remote signer" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Private key input"
  args={{ methods, onSelect: fn() }}
  play={async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Paste a private key/u }),
    );
    const input = canvas.getByLabelText("Private key");
    await expect(input).toHaveAttribute("type", "password");
    await expect(canvas.queryByText("Private key")).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Sign in with private key" }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Paste a private key before signing in",
    );
    await expect(args.onSelect).not.toHaveBeenCalled();
    await userEvent.type(input, "nsec1storybookexample");
    await userEvent.click(
      canvas.getByRole("button", { name: "Sign in with private key" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("private-key", {
      privateKey: "nsec1storybookexample",
    });
  }}
/>

<Story
  name="Private key retry"
  args={{
    methods,
    error: "The relay could not complete sign in. Try again.",
    onSelect: fn(async () => {
      throw new Error("The relay could not complete sign in. Try again.");
    }),
  }}
  play={async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Paste a private key/u }),
    );
    const input = canvas.getByLabelText("Private key");
    await userEvent.type(input, "nsec1retryableexample");
    await userEvent.click(
      canvas.getByRole("button", { name: "Sign in with private key" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("private-key", {
      privateKey: "nsec1retryableexample",
    });
    await expect(input).toHaveValue("nsec1retryableexample");
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "The relay could not complete sign in. Try again.",
    );
  }}
/>

<Story
  name="Error on mobile"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile1", isRotated: false },
  }}
  args={{
    methods,
    error: "The selected signer did not approve this connection.",
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "The selected signer did not approve this connection.",
    );
  }}
/>
