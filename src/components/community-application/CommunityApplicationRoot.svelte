<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import XIcon from "@lucide/svelte/icons/x";
  import { tick, type ComponentProps } from "svelte";

  import { readCommunityControllerIdentity } from "../../community/controller-identity-context.js";
  import type { CommunityIdentity } from "../../community/index.js";
  import CommunityLogin from "../community-login/CommunityLogin.svelte";
  import {
    resolveCommunityLoginMethods,
    type CommunityLoginCredentials,
    type CommunityLoginMethodModel,
  } from "../community-login/model.js";
  import CommunityAuthenticatedApplication from "./CommunityApplication.svelte";
  import { provideCommunityApplicationAuthentication } from "./authentication-context.js";
  import type { CommunityApplicationLoginOptions } from "./model.js";

  type AuthenticatedApplicationProps = ComponentProps<
    typeof CommunityAuthenticatedApplication
  >;
  type AuthenticatedAction = () => void | Promise<void>;
  type PendingAction = {
    run: () => Promise<void>;
    resolve: () => void;
    reject: (cause: unknown) => void;
  };

  let {
    controller,
    loginOptions,
    ...authenticatedProps
  }: AuthenticatedApplicationProps & {
    loginOptions?: CommunityApplicationLoginOptions;
  } = $props();

  let loginOpen = $state(false);
  let pendingLoginMethodId = $state("");
  let loginError = $state("");
  let pendingAction = $state<PendingAction>();
  let connectedIdentity = $state<CommunityIdentity>();
  const loginMethods = $derived<readonly CommunityLoginMethodModel[]>(
    resolveCommunityLoginMethods(
      loginOptions?.methods,
      loginOptions?.allowLocalKeyMethods ?? false,
    ),
  );
  const loginBusy = $derived(
    pendingLoginMethodId !== "" ||
      controller.state.authentication.status === "connecting",
  );
  const loginMessage = $derived(
    loginError || controller.state.authentication.error || "",
  );

  provideCommunityApplicationAuthentication({
    requestAuthentication,
    identity: () => {
      controller.state.authentication.status;
      return (
        connectedIdentity ??
        readCommunityControllerIdentity(controller) ??
        authenticatedProps.registryOptions?.discussionIdentity
      );
    },
  });

  $effect(() => {
    if (controller.state.authentication.status !== "connected") {
      connectedIdentity = undefined;
    }
  });

  function requestAuthentication(action: AuthenticatedAction): Promise<void> {
    if (controller.state.authentication.status === "connected")
      return Promise.resolve(action()).then(() => undefined);
    loginError = "";
    loginOpen = true;
    return new Promise((resolve, reject) => {
      pendingAction?.resolve();
      pendingAction = {
        run: async () => void (await action()),
        resolve,
        reject,
      };
    });
  }

  function handleLoginOpenChange(next: boolean): void {
    loginOpen = next;
    if (next || pendingAction === undefined) return;
    const cancelled = pendingAction;
    pendingAction = undefined;
    cancelled.resolve();
  }

  async function connectIdentity(
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ): Promise<void> {
    pendingLoginMethodId = methodId;
    loginError = "";
    try {
      if (loginOptions?.connect) {
        const identity = await loginOptions.connect(methodId, credentials);
        await controller.actions.connectIdentity({
          connect: async () => identity,
        });
        connectedIdentity = identity;
      } else {
        if (methodId !== "browser-extension") {
          const method = loginMethods.find(
            (candidate) => candidate.id === methodId,
          );
          throw new Error(
            `${method?.label ?? "This login method"} is not configured`,
          );
        }
        await controller.actions.connectIdentity();
        connectedIdentity = readCommunityControllerIdentity(controller);
      }

      const resumed = pendingAction;
      pendingAction = undefined;
      loginOpen = false;
      if (resumed !== undefined) {
        try {
          await tick();
          await resumed.run();
          resumed.resolve();
        } catch (cause) {
          resumed.reject(cause);
        }
      }
    } catch (cause) {
      loginError = cause instanceof Error ? cause.message : "Sign in failed";
      throw cause;
    } finally {
      pendingLoginMethodId = "";
    }
  }
</script>

<CommunityAuthenticatedApplication
  {controller}
  {...authenticatedProps}
  onAuthenticationRequired={requestAuthentication}
/>

<Dialog.Root bind:open={loginOpen} onOpenChange={handleLoginOpenChange}>
  <DialogFrame size="form">
    {#snippet title()}{loginOptions?.title ?? "Connect to Nostr"}{/snippet}

    <CommunityLogin
      methods={loginMethods}
      footnote={loginOptions?.footnote ??
        "Your identity stays under your control. Lapis only requests signatures for actions you approve."}
      busy={loginBusy}
      pendingMethodId={pendingLoginMethodId}
      error={loginMessage}
      presentation="dialog"
      onSelect={connectIdentity}
    />
  </DialogFrame>
</Dialog.Root>

<style>
  :global(.community-application-login-dialog__close) {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }
</style>
