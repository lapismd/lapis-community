<script lang="ts">
  import type { ComponentProps } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import CommunityLogin from "../community-login/CommunityLogin.svelte";
  import {
    DEFAULT_COMMUNITY_LOGIN_METHODS,
    type CommunityLoginMethodModel,
  } from "../community-login/model.js";
  import CommunityAuthenticatedApplication from "./CommunityApplication.svelte";
  import type { CommunityApplicationLoginOptions } from "./model.js";

  type AuthenticatedApplicationProps = ComponentProps<
    typeof CommunityAuthenticatedApplication
  >;

  const applicationPropNames = new Set([
    "shellController",
    "initialDestination",
    "displayMode",
    "mobileBreakpoint",
    "desktopMinMainWidth",
    "registry",
    "registryOptions",
    "extensions",
    "linkBuilder",
    "onDestinationChange",
    "onSectionAction",
  ]);

  let {
    controller,
    loginOptions,
    ...authenticatedProps
  }: AuthenticatedApplicationProps & {
    loginOptions?: CommunityApplicationLoginOptions;
  } = $props();

  let pendingLoginMethodId = $state("");
  let loginError = $state("");
  const loginMethods = $derived<readonly CommunityLoginMethodModel[]>(
    loginOptions?.methods ?? DEFAULT_COMMUNITY_LOGIN_METHODS,
  );
  const showLogin = $derived(
    controller.state.authentication.status !== "connected",
  );
  const loginBusy = $derived(
    pendingLoginMethodId !== "" ||
      controller.state.authentication.status === "connecting",
  );
  const loginMessage = $derived(
    loginError || controller.state.authentication.error || "",
  );
  const loginRootProps = $derived(
    filterLoginRootProps(authenticatedProps as Record<string, unknown>),
  );

  function filterLoginRootProps(
    props: Record<string, unknown>,
  ): HTMLAttributes<HTMLElement> {
    return Object.fromEntries(
      Object.entries(props).filter(([key]) => !applicationPropNames.has(key)),
    ) as HTMLAttributes<HTMLElement>;
  }

  async function connectIdentity(methodId: string): Promise<void> {
    pendingLoginMethodId = methodId;
    loginError = "";
    try {
      if (loginOptions?.connect) {
        const identity = await loginOptions.connect(methodId);
        await controller.actions.connectIdentity({
          connect: async () => identity,
        });
        return;
      }
      if (methodId !== "browser-extension") {
        const method = loginMethods.find(
          (candidate) => candidate.id === methodId,
        );
        throw new Error(
          `${method?.label ?? "This login method"} is not configured`,
        );
      }
      await controller.actions.connectIdentity();
    } catch (cause) {
      loginError = cause instanceof Error ? cause.message : "Sign in failed";
    } finally {
      pendingLoginMethodId = "";
    }
  }
</script>

{#if showLogin}
  <CommunityLogin
    {...loginRootProps}
    methods={loginMethods}
    title={loginOptions?.title ?? "Connect to Nostr"}
    description={loginOptions?.description ?? "Choose your login method"}
    footnote={loginOptions?.footnote ??
      "Your identity stays under your control. Lapis only requests signatures for actions you approve."}
    busy={loginBusy}
    pendingMethodId={pendingLoginMethodId}
    error={loginMessage}
    onSelect={connectIdentity}
  />
{:else}
  <CommunityAuthenticatedApplication {controller} {...authenticatedProps} />
{/if}
