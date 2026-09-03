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
  name="Error on mobile"
  globals={{ colorMode: "dark" }}
  parameters={{ viewport: { defaultViewport: "mobile1" } }}
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
