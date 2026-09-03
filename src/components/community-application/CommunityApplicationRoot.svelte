<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import XIcon from "@lucide/svelte/icons/x";
  import { tick, type ComponentProps } from "svelte";

  import CommunityLogin from "../community-login/CommunityLogin.svelte";
  import {
    resolveCommunityLoginMethods,
    type CommunityLoginCredentials,
    type CommunityLoginMethodModel,
  } from "../community-login/model.js";
  import CommunityAuthenticatedApplication from "./CommunityApplication.svelte";
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
  <Dialog.Content
    class="community-application-login-dialog"
    showCloseButton={false}
  >
    <Dialog.Header class="sr-only">
      <Dialog.Title>{loginOptions?.title ?? "Connect to Nostr"}</Dialog.Title>
      <Dialog.Description>
        {loginOptions?.description ?? "Choose your login method"}
      </Dialog.Description>
    </Dialog.Header>
    <CommunityLogin
      methods={loginMethods}
      title={loginOptions?.title ?? "Connect to Nostr"}
      description={loginOptions?.description ?? "Choose your login method"}
      footnote={loginOptions?.footnote ??
        "Your identity stays under your control. Lapis only requests signatures for actions you approve."}
      busy={loginBusy}
      pendingMethodId={pendingLoginMethodId}
      error={loginMessage}
      presentation="dialog"
      onSelect={connectIdentity}
    />
    <Dialog.Close>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="ghost"
          size="icon-sm"
          class="community-application-login-dialog__close"
          aria-label="Close"
          title="Close"
        >
          <XIcon aria-hidden="true" />
        </Button>
      {/snippet}
    </Dialog.Close>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-application-login-dialog) {
    width: min(calc(100vw - 2rem), 30rem);
  }

  :global(.community-application-login-dialog__close) {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }
</style>
