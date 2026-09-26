<script lang="ts">
  import { AppShell } from "@lapismd/design-core/shell";

  import { createCommunityAssetManagement } from "../../community/asset-management.js";
  import { readCommunityControllerIdentity } from "../../community/controller-identity-context.js";
  import type { CommunityController } from "../../community/index.js";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
  import type { CommunitySettingsSection } from "../community-settings/model.js";
  import { runCommunityAuthenticatedResult } from "./authenticated-result.js";
  import { useCommunityApplicationAuthentication } from "./authentication-context.js";

  type AuthenticatedAction = () => void | Promise<void>;

  let {
    controller,
    relayUrl,
    section,
    onAuthenticationRequired,
    onCopyPublicKey,
  }: {
    controller: CommunityController;
    relayUrl?: string | undefined;
    section?: CommunitySettingsSection;
    onAuthenticationRequired?:
      | ((action: AuthenticatedAction) => Promise<void>)
      | undefined;
    onCopyPublicKey?: ((pubkey: string) => void | Promise<void>) | undefined;
  } = $props();

  const authentication = useCommunityApplicationAuthentication();
  const identity = $derived(
    authentication?.identity() ?? readCommunityControllerIdentity(controller),
  );
  const assetManagement = $derived.by(() =>
    relayUrl && identity
      ? createCommunityAssetManagement({
          relayUrl,
          identity: {
            getPublicKey: () => identity.getPublicKey(),
            signEvent: (template) =>
              runCommunityAuthenticatedResult(
                runAuthenticated,
                () => identity.signEvent(template),
                "Asset request was cancelled",
              ),
          },
        })
      : undefined,
  );

  async function runAuthenticated(action: AuthenticatedAction): Promise<void> {
    if (onAuthenticationRequired) {
      await onAuthenticationRequired(action);
      return;
    }
    if (authentication) {
      await authentication.requestAuthentication(action);
      return;
    }
    await action();
  }

  async function signOut(): Promise<void> {
    if (authentication?.signOut) await authentication.signOut();
    else await controller.actions.disconnectIdentity();
  }
</script>

<AppShell.Body layout="regions" label="Personal settings">
  <AppShell.Body.Content>
    <CommunitySettings
      model={controller.state.settings}
      {section}
      account={authentication?.account?.()}
      accountConfig={authentication?.config?.()}
      accountActions={authentication?.accountActions?.()}
      accountResumeAction={authentication?.resumeAccountAction?.()}
      accountAuthenticationState={authentication?.status?.()}
      accountActiveExternalSigner={authentication?.activeExternalSigner?.()}
      accountBusy={authentication?.status?.() === "restoring" ||
        authentication?.status?.() === "redirecting"}
      accountMessage={authentication?.status?.() === "reconnect-required"
        ? "Reconnect the Nostr signer before an action needs a signature."
        : ""}
      {onCopyPublicKey}
      onConnectGitHub={authentication?.connectGitHub === undefined
        ? undefined
        : () => authentication.connectGitHub?.()}
      onSignOut={signOut}
      profileOperation={controller.state.operations["settings:profile"]}
      emojiOperation={controller.state.operations["settings:emoji"]}
      onUpdateProfile={(profile) =>
        runAuthenticated(() => controller.actions.updateProfile(profile))}
      onUploadProfileImage={(file) =>
        runCommunityAuthenticatedResult(
          runAuthenticated,
          () => controller.actions.uploadSettingsImage(file, "profile"),
          "Profile image upload was cancelled",
        )}
      onUploadCustomEmojiImage={(file) =>
        runCommunityAuthenticatedResult(
          runAuthenticated,
          () => controller.actions.uploadSettingsImage(file, "emoji"),
          "Emoji image upload was cancelled",
        )}
      onAddCustomEmoji={(shortcode, url) =>
        runAuthenticated(() =>
          controller.actions.setCustomEmoji(shortcode, url),
        )}
      onRemoveCustomEmoji={(shortcode) =>
        runAuthenticated(() => controller.actions.removeCustomEmoji(shortcode))}
      {assetManagement}
    />
  </AppShell.Body.Content>
</AppShell.Body>
