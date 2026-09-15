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
  import { connectDirectApplicationIdentity } from "./connect-direct-identity.js";
  import { shouldUseDirectApplicationLogin } from "./login-routing.js";
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
  let signOutPending = $state(false);
  let activeExternalSigner = $state<"keytr">();
  let authenticationGeneration = 0;
  let activeIdentityConnection: Promise<void> | undefined;
  let signOutOperation: Promise<void> | undefined;
  const reconnectRequired = $derived(relayAuthStatus === "reconnect-required");
  const configuredLoginMethods = $derived<readonly CommunityLoginMethodModel[]>(
    resolveCommunityLoginMethods(
      loginOptions?.methods,
      loginOptions?.allowLocalKeyMethods ?? false,
      authConfig?.providers ?? [],
    ),
  );
  const loginMethods = $derived(
    reconnectRequired
      ? configuredLoginMethods
          .filter(
            (method) =>
              !["github", "google", "create-account"].includes(method.kind),
          )
          .map((method) =>
            method.kind === "keytr" && method.keytr
              ? { ...method, keytr: { ...method.keytr, allowSetup: false } }
              : method,
          )
      : configuredLoginMethods,
  );
  const loginBusy = $derived(
    pendingLoginMethodId !== "" ||
      signOutPending ||
      relayAuthStatus === "restoring" ||
      relayAuthStatus === "redirecting" ||
      controller.state.authentication.status === "connecting",
  );
  const loginFootnote = $derived(
    reconnectRequired
      ? "Your account is remembered, but its Nostr key is held by your device or signer. Reconnect the same key to send messages and perform actions. GitHub access does not unlock it."
      : (loginOptions?.footnote ??
          (loginOptions?.auth
            ? loginMethods.some((method) => method.kind === "keytr")
              ? "Google and GitHub use an encrypted Nostr identity managed by Lapis. Keytr decrypts its signing key only in this browser tab and clears it when you disconnect. Browser extensions and remote signers keep their existing custody."
              : "Google and GitHub use an encrypted Nostr identity managed by Lapis. Browser extensions and remote signers keep their existing custody."
            : undefined)),
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
    signingOut: () => signOutPending,
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
    const generation = ++authenticationGeneration;
    relayAuthStatus = "restoring";
    try {
      const result = await auth.restore();
      if (generation !== authenticationGeneration) return;
      await applyAuthResult(result, generation);
      if (generation !== authenticationGeneration) return;
      restorePendingAccountAction();
    } catch (cause) {
      if (generation !== authenticationGeneration) return;
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
    generation = authenticationGeneration,
  ): Promise<void> {
    if (generation !== authenticationGeneration) return;
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
    const connection = controller.actions.connectIdentity({
      connect: async () => result.identity,
    });
    activeIdentityConnection = connection;
    try {
      await connection;
    } finally {
      if (activeIdentityConnection === connection) {
        activeIdentityConnection = undefined;
      }
    }
    if (generation !== authenticationGeneration) return;
    connectedIdentity = result.identity;
    relayAuthStatus = "connected";
  }

  function handleSessionExpired(): void {
    authenticationGeneration += 1;
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

  async function applyAccountAction(
    action: () => Promise<RelayAuthRestoreResult>,
  ): Promise<void> {
    const generation = authenticationGeneration;
    const result = await action();
    if (generation !== authenticationGeneration) return;
    // An account-cookie refresh cannot recover an external signer. Keep the
    // already unlocked signer only while custody, account and key still match.
    const identity = connectedIdentity;
    if (
      result.status === "reconnect-required" &&
      result.session.signer_type === "external" &&
      result.session.signer_status === "active" &&
      result.session.account.id === accountSession?.account.id &&
      accountSession.signer_type === "external" &&
      relayAuthStatus === "connected" &&
      controller.state.authentication.status === "connected" &&
      identity !== undefined &&
      (await identity.getPublicKey()) === result.session.account.nostr_pubkey
    ) {
      if (
        generation !== authenticationGeneration ||
        identity !== connectedIdentity
      )
        return;
      accountSession = result.session;
      authConfig = result.config;
      return;
    }
    await applyAuthResult(result, generation);
  }

  async function registerPasskey(): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth?.registerPasskey === undefined) {
      throw new Error("Passkey registration is not configured");
    }
    try {
      await applyAccountAction(() => auth.registerPasskey!());
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
    const auth = loginOptions?.auth;
    if (auth?.disconnectGitHub === undefined) {
      throw new Error("GitHub disconnection is not configured");
    }
    await applyAccountAction(() => auth.disconnectGitHub!());
  }

  async function connectRemoteSigner(bunkerUrl: string): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth?.connectRemoteSigner === undefined) {
      throw new Error("Remote signer management is not configured");
    }
    await applyAccountAction(() => auth.connectRemoteSigner!(bunkerUrl));
  }

  async function switchRemoteSignerRelays(): Promise<readonly string[]> {
    const auth = loginOptions?.auth;
    if (auth?.switchRemoteSignerRelays === undefined) {
      throw new Error("Remote signer management is not configured");
    }
    return await auth.switchRemoteSignerRelays();
  }

  async function disconnectRemoteSigner(): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth?.disconnectRemoteSigner === undefined) {
      throw new Error("Remote signer management is not configured");
    }
    await applyAccountAction(() => auth.disconnectRemoteSigner!());
  }

  async function reconnectSigner(): Promise<void> {
    await queueAuthentication(async () => {});
  }

  async function beginCustodyTransfer(): Promise<RelayCustodyTransferHandoff> {
    const auth = loginOptions?.auth;
    if (auth?.beginCustodyTransfer === undefined) {
      throw new Error("Signing-key transfer is not configured");
    }
    const generation = authenticationGeneration;
    const handoff = await auth.beginCustodyTransfer();
    await applyAuthResult(await auth.restore(), generation);
    return handoff;
  }

  async function completeCustodyTransfer(
    handoff: RelayCustodyTransferHandoff,
    bunkerUrl: string,
  ): Promise<void> {
    const auth = loginOptions?.auth;
    if (auth?.completeCustodyTransfer === undefined) {
      throw new Error("Signing-key transfer is not configured");
    }
    await applyAccountAction(() =>
      auth.completeCustodyTransfer!(handoff, bunkerUrl),
    );
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
    const generation = ++authenticationGeneration;
    pendingLoginMethodId = methodId;
    loginError = "";
    let acceptedAccount = false;
    try {
      if (
        loginOptions?.auth &&
        !shouldUseDirectApplicationLogin(
          methodId,
          loginMethods,
          loginOptions.connect !== undefined,
        )
      ) {
        const result = await loginOptions.auth.connect(methodId, credentials);
        if (result.status === "connected") {
          acceptedAccount = true;
          pendingLoginMethodId = "";
          loginOpen = false;
          await tick();
        }
        await applyAuthResult(result, generation);
        if (generation !== authenticationGeneration) return;
        if (relayAuthStatus === "redirecting") return;
        if (relayAuthStatus === "reconnect-required") {
          throw new Error("Reconnect the Nostr signer for this account");
        }
        activeExternalSigner = methodId === "keytr" ? "keytr" : undefined;
      } else if (loginOptions?.connect) {
        connectedIdentity = await connectDirectApplicationIdentity(
          controller,
          loginOptions.connect,
          methodId,
          credentials,
        );
        accountSession = undefined;
        relayAuthStatus = loginOptions?.auth ? "anonymous" : "idle";
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
      if (acceptedAccount) loginOpen = true;
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
    const previousStatus = relayAuthStatus;
    const generation = authenticationGeneration;
    relayAuthStatus = "redirecting";
    try {
      await auth.connectGitHub();
    } catch (cause) {
      if (generation === authenticationGeneration)
        relayAuthStatus = previousStatus;
      throw cause;
    }
  }

  async function signOut(): Promise<void> {
    if (signOutOperation !== undefined) return await signOutOperation;
    const operation = completeSignOut();
    signOutOperation = operation;
    signOutPending = true;
    try {
      await operation;
    } finally {
      if (signOutOperation === operation) {
        signOutOperation = undefined;
        signOutPending = false;
      }
    }
  }

  async function completeSignOut(): Promise<void> {
    clearResumeAction();
    if (loginOptions?.auth && accountSession !== undefined)
      await loginOptions.auth.signOut();
    authenticationGeneration += 1;
    // Invalidate the controller's pending signer lookup instead of waiting for
    // its relay synchronization to finish before signing out.
    activeIdentityConnection = undefined;
    // Anonymous relay synchronization must not retain the signed-out account.
    connectedIdentity = undefined;
    accountSession = undefined;
    activeExternalSigner = undefined;
    relayAuthStatus = loginOptions?.auth ? "anonymous" : "idle";
    await controller.actions.disconnectIdentity();
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
