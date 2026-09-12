<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import XIcon from "@lucide/svelte/icons/x";
  import { onMount, tick, untrack, type ComponentProps } from "svelte";

  import {
    isRelayAuthSessionExpiredError,
    RelayAuthError,
    type CommunityAccountSession,
    type CommunityRelayAuthConfig,
    type RelayAuthConnectResult,
    type RelayAuthRestoreResult,
    type RelayCustodyTransferHandoff,
  } from "../../auth/index.js";
  import { readCommunityControllerIdentity } from "../../community/controller-identity-context.js";
  import type { CommunityIdentity } from "../../community/index.js";
  import CommunityLogin from "../community-login/CommunityLogin.svelte";
  import type {
    CommunityAccountManagementActions,
    CommunityAccountResumeAction,
  } from "../community-account-settings/model.js";
  import {
    resolveCommunityLoginMethods,
    type CommunityLoginCredentials,
    type CommunityLoginMethodModel,
  } from "../community-login/model.js";
  import CommunityAuthenticatedApplication from "./CommunityApplication.svelte";
  import { provideCommunityApplicationAuthentication } from "./authentication-context.js";
  import type {
    CommunityApplicationAuthenticationStatus,
    CommunityApplicationLoginOptions,
  } from "./model.js";

  type AuthenticatedApplicationProps = ComponentProps<
    typeof CommunityAuthenticatedApplication
  >;
  type AuthenticatedAction = () => void | Promise<void>;
  type PendingAction = {
    run: () => Promise<void>;
    resolve: () => void;
    reject: (cause: unknown) => void;
  };
  const pendingAccountActionKey = "lapis-community:account-action:v1";

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
  let accountSession = $state<CommunityAccountSession>();
  let authConfig = $state<CommunityRelayAuthConfig>();
  let accountResumeAction = $state<CommunityAccountResumeAction>();
  let relayAuthStatus = $state<CommunityApplicationAuthenticationStatus>(
    untrack(() => (loginOptions?.auth ? "restoring" : "idle")),
  );
  let activeExternalSigner = $state<"keytr">();
  const loginMethods = $derived<readonly CommunityLoginMethodModel[]>(
    resolveCommunityLoginMethods(
      loginOptions?.methods,
      loginOptions?.allowLocalKeyMethods ?? false,
      authConfig?.providers ?? [],
    ),
  );
  const loginBusy = $derived(
    pendingLoginMethodId !== "" ||
      relayAuthStatus === "restoring" ||
      relayAuthStatus === "redirecting" ||
      controller.state.authentication.status === "connecting",
  );
  const loginFootnote = $derived(
    loginOptions?.footnote ??
      (loginOptions?.auth
        ? loginMethods.some((method) => method.kind === "keytr")
          ? "Google and GitHub use an encrypted Nostr identity managed by Lapis. Keytr decrypts its signing key only in this browser tab and clears it when you disconnect. Browser extensions and remote signers keep their existing custody."
          : "Google and GitHub use an encrypted Nostr identity managed by Lapis. Browser extensions and remote signers keep their existing custody."
        : undefined),
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
    account: () => accountSession,
    config: () => authConfig,
    accountActions,
    resumeAccountAction: () => accountResumeAction,
    status: () => relayAuthStatus,
    activeExternalSigner: () => activeExternalSigner,
    connectGitHub,
    signOut,
  });

  onMount(() => {
    const auth = loginOptions?.auth;
    if (auth === undefined) return;
    const unsubscribe = auth.onSessionExpired?.(handleSessionExpired);
    void restoreAuthentication();
    return unsubscribe;
  });

  $effect(() => {
    if (controller.state.authentication.status !== "connected") {
      connectedIdentity = undefined;
    }
  });

  async function restoreAuthentication(): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth === undefined) return;
    relayAuthStatus = "restoring";
    try {
      await applyAuthResult(await auth.restore());
      restorePendingAccountAction();
    } catch (cause) {
      accountSession = undefined;
      relayAuthStatus = "anonymous";
      loginError =
        cause instanceof Error
          ? cause.message
          : "Account restoration could not be completed";
      if (cause instanceof RelayAuthError && cause.status === 400) {
        loginOpen = true;
      }
    }
  }

  async function applyAuthResult(
    result: RelayAuthRestoreResult | RelayAuthConnectResult,
  ): Promise<void> {
    authConfig = result.config;
    if (result.status === "redirecting") {
      relayAuthStatus = "redirecting";
      return;
    }
    if (result.status === "anonymous") {
      accountSession = undefined;
      connectedIdentity = undefined;
      relayAuthStatus = "anonymous";
      activeExternalSigner = undefined;
      return;
    }
    accountSession = result.session;
    if (result.status === "reconnect-required") {
      connectedIdentity = undefined;
      relayAuthStatus = "reconnect-required";
      activeExternalSigner = undefined;
      if (controller.state.authentication.status === "connected") {
        await controller.actions.disconnectIdentity();
      }
      return;
    }
    await controller.actions.connectIdentity({
      connect: async () => result.identity,
    });
    connectedIdentity = result.identity;
    relayAuthStatus = "connected";
  }

  function handleSessionExpired(): void {
    accountSession = undefined;
    connectedIdentity = undefined;
    relayAuthStatus = "anonymous";
    activeExternalSigner = undefined;
    loginError = "Your session has expired. Sign in again.";
    loginOpen = true;
    if (controller.state.authentication.status === "connected") {
      void controller.actions.disconnectIdentity();
    }
  }

  function accountActions(): CommunityAccountManagementActions | undefined {
    if (loginOptions?.auth === undefined) return undefined;
    return {
      connectGitHub,
      disconnectGitHub,
      registerPasskey,
      connectRemoteSigner,
      switchRemoteSignerRelays,
      disconnectRemoteSigner,
      reconnectSigner,
      beginCustodyTransfer,
      completeCustodyTransfer,
      signOut,
      clearResumeAction,
    };
  }

  async function applyAccountResult(
    result: RelayAuthRestoreResult,
  ): Promise<void> {
    await applyAuthResult(result);
  }

  async function registerPasskey(): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth?.registerPasskey === undefined) {
      throw new Error("Passkey registration is not configured");
    }
    try {
      await applyAccountResult(await auth.registerPasskey());
      clearResumeAction();
    } catch (cause) {
      if (
        cause instanceof RelayAuthError &&
        cause.code === "recent_authentication_required"
      ) {
        await reauthenticateForAccountAction("register-passkey");
        return;
      }
      throw cause;
    }
  }

  async function disconnectGitHub(): Promise<void> {
    const action = loginOptions?.auth?.disconnectGitHub;
    if (action === undefined) {
      throw new Error("GitHub disconnection is not configured");
    }
    await applyAccountResult(await action());
  }

  async function connectRemoteSigner(bunkerUrl: string): Promise<void> {
    const action = loginOptions?.auth?.connectRemoteSigner;
    if (action === undefined) {
      throw new Error("Remote signer management is not configured");
    }
    await applyAccountResult(await action(bunkerUrl));
  }

  async function switchRemoteSignerRelays(): Promise<readonly string[]> {
    const action = loginOptions?.auth?.switchRemoteSignerRelays;
    if (action === undefined) {
      throw new Error("Remote signer management is not configured");
    }
    return await action();
  }

  async function disconnectRemoteSigner(): Promise<void> {
    const action = loginOptions?.auth?.disconnectRemoteSigner;
    if (action === undefined) {
      throw new Error("Remote signer management is not configured");
    }
    await applyAccountResult(await action());
  }

  async function reconnectSigner(): Promise<void> {
    await queueAuthentication(async () => {});
  }

  async function beginCustodyTransfer(): Promise<RelayCustodyTransferHandoff> {
    const auth = loginOptions?.auth;
    if (auth?.beginCustodyTransfer === undefined) {
      throw new Error("Signing-key transfer is not configured");
    }
    const handoff = await auth.beginCustodyTransfer();
    await applyAuthResult(await auth.restore());
    return handoff;
  }

  async function completeCustodyTransfer(
    handoff: RelayCustodyTransferHandoff,
    bunkerUrl: string,
  ): Promise<void> {
    const action = loginOptions?.auth?.completeCustodyTransfer;
    if (action === undefined) {
      throw new Error("Signing-key transfer is not configured");
    }
    await applyAccountResult(await action(handoff, bunkerUrl));
  }

  async function reauthenticateForAccountAction(
    action: CommunityAccountResumeAction,
  ): Promise<void> {
    const auth = loginOptions?.auth;
    const provider = accountSession?.auth_provider;
    if (auth === undefined) return;
    if (provider === "github" || provider === "google") {
      rememberPendingAccountAction(action);
      relayAuthStatus = "redirecting";
      await auth.connect(provider);
      return;
    }
    await queueAuthentication(async () => {
      await registerPasskey();
    });
  }

  function rememberPendingAccountAction(
    action: CommunityAccountResumeAction,
  ): void {
    if (accountSession === undefined) return;
    try {
      sessionStorage.setItem(
        pendingAccountActionKey,
        JSON.stringify({
          accountId: accountSession.account.id,
          action,
          expiresAt: Date.now() + 15 * 60 * 1_000,
        }),
      );
    } catch {
      // Account action resumption remains best-effort when storage is disabled.
    }
  }

  function restorePendingAccountAction(): void {
    if (accountSession === undefined) return;
    try {
      const raw = sessionStorage.getItem(pendingAccountActionKey);
      if (raw === null) return;
      sessionStorage.removeItem(pendingAccountActionKey);
      const value = JSON.parse(raw) as {
        accountId?: unknown;
        action?: unknown;
        expiresAt?: unknown;
      };
      if (
        value.accountId === accountSession.account.id &&
        value.action === "register-passkey" &&
        typeof value.expiresAt === "number" &&
        value.expiresAt > Date.now()
      ) {
        accountResumeAction = value.action;
      }
    } catch {
      // Ignore invalid or unavailable session storage.
    }
  }

  function clearResumeAction(): void {
    accountResumeAction = undefined;
    try {
      sessionStorage.removeItem(pendingAccountActionKey);
    } catch {
      // Ignore unavailable session storage.
    }
  }

  function queueAuthentication(
    action: AuthenticatedAction,
    clearError = true,
  ): Promise<void> {
    if (clearError) loginError = "";
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

  async function requestAuthentication(
    action: AuthenticatedAction,
  ): Promise<void> {
    if (controller.state.authentication.status !== "connected") {
      return await queueAuthentication(action);
    }
    try {
      await action();
    } catch (cause) {
      if (isRelayAuthSessionExpiredError(cause)) {
        handleSessionExpired();
        return await queueAuthentication(action, false);
      }
      throw cause;
    }
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
      if (loginOptions?.auth) {
        await applyAuthResult(
          await loginOptions.auth.connect(methodId, credentials),
        );
        if (relayAuthStatus === "redirecting") return;
        if (relayAuthStatus === "reconnect-required") {
          throw new Error("Reconnect the Nostr signer for this account");
        }
        activeExternalSigner = methodId === "keytr" ? "keytr" : undefined;
      } else if (loginOptions?.connect) {
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

  async function connectGitHub(): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth === undefined) {
      throw new Error("GitHub account linking is not configured");
    }
    relayAuthStatus = "redirecting";
    try {
      await auth.connectGitHub();
    } catch (cause) {
      relayAuthStatus = accountSession ? "connected" : "anonymous";
      throw cause;
    }
  }

  async function signOut(): Promise<void> {
    clearResumeAction();
    if (loginOptions?.auth) await loginOptions.auth.signOut();
    await controller.actions.disconnectIdentity();
    connectedIdentity = undefined;
    accountSession = undefined;
    activeExternalSigner = undefined;
    relayAuthStatus = loginOptions?.auth ? "anonymous" : "idle";
  }
</script>

<CommunityAuthenticatedApplication
  {controller}
  {...authenticatedProps}
  onAuthenticationRequired={requestAuthentication}
/>

<Dialog.Root bind:open={loginOpen} onOpenChange={handleLoginOpenChange}>
  <DialogFrame size="form">
    {#snippet title()}
      {loginOptions?.title ??
        (loginOptions?.auth ? "Sign in to Community" : "Connect to Nostr")}
    {/snippet}

    <CommunityLogin
      methods={loginMethods}
      {...loginFootnote === undefined ? {} : { footnote: loginFootnote }}
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
