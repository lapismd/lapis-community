<script lang="ts">
  import CommunityAvatarPicker from "../community-avatar-picker/CommunityAvatarPicker.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import PencilIcon from "@lucide/svelte/icons/pencil";

  import type {
    CommunityAccountSession,
    CommunityRelayAuthConfig,
  } from "../../auth/index.js";
  import type {
    CommunityOperationState,
    CommunityProfileUpdate,
    CommunitySettingsState,
  } from "../../community/index.js";
  import type { CommunityAssetManagement } from "../../community/asset-management.js";
  import CommunityAccountSettings from "../community-account-settings/CommunityAccountSettings.svelte";
  import type {
    CommunityAccountAuthenticationState,
    CommunityAccountManagementActions,
    CommunityAccountResumeAction,
  } from "../community-account-settings/model.js";
  import CommunityAssetSettings from "../community-asset-settings/CommunityAssetSettings.svelte";
  import CommunityCustomEmojiSettings from "../community-custom-emoji-settings/CommunityCustomEmojiSettings.svelte";
  import type { CommunitySettingsSection } from "./model.js";
  import "./CommunitySettings.css";

  let {
    model,
    profileOperation,
    emojiOperation,
    section = "profile",
    onUpdateProfile,
    onUploadProfileImage,
    onUploadCustomEmojiImage,
    onAddCustomEmoji,
    onRemoveCustomEmoji,
    assetManagement,
    account,
    accountBusy = false,
    accountMessage = "",
    accountConfig,
    accountActions,
    accountResumeAction,
    accountAuthenticationState,
    accountActiveExternalSigner,
    onCopyPublicKey,
    onConnectGitHub,
    onSignOut,
  }: {
    model: CommunitySettingsState;
    profileOperation?: CommunityOperationState | undefined;
    emojiOperation?: CommunityOperationState | undefined;
    section?: CommunitySettingsSection | undefined;
    onUpdateProfile: (profile: CommunityProfileUpdate) => Promise<void>;
    onUploadProfileImage?: ((file: File) => Promise<string>) | undefined;
    onUploadCustomEmojiImage?: ((file: File) => Promise<string>) | undefined;
    onAddCustomEmoji: (shortcode: string, url: string) => Promise<void>;
    onRemoveCustomEmoji: (shortcode: string) => Promise<void>;
    assetManagement?: CommunityAssetManagement | undefined;
    account?: CommunityAccountSession | undefined;
    accountBusy?: boolean;
    accountMessage?: string;
    accountConfig?: CommunityRelayAuthConfig | undefined;
    accountActions?: CommunityAccountManagementActions | undefined;
    accountResumeAction?: CommunityAccountResumeAction | undefined;
    accountAuthenticationState?:
      | CommunityAccountAuthenticationState
      | undefined;
    accountActiveExternalSigner?: "keytr" | undefined;
    onCopyPublicKey?: ((pubkey: string) => void | Promise<void>) | undefined;
    onConnectGitHub?: (() => void | Promise<void>) | undefined;
    onSignOut?: (() => void | Promise<void>) | undefined;
  } = $props();

  let displayName = $state("");
  let username = $state("");
  let about = $state("");
  let picture = $state("");
  let localError = $state(""),
    message = $state("");
  let editingProfile = $state(false);
  let avatarEditorOpen = $state(false);
  let rootElement = $state<HTMLElement>();

  const disabledReason = $derived(
    model.identityConnected
      ? ""
      : "Connect a NIP-07 identity to save personal settings.",
  );

  $effect(() => {
    displayName = model.profile.displayName;
    username = model.profile.username;
    about = model.profile.about;
    picture = model.profile.picture;
  });

  $effect(() => {
    section;
    const element = rootElement;
    avatarEditorOpen = false;
    editingProfile = false;
    localError = "";
    message = "";
    if (!element) return;
    requestAnimationFrame(() => {
      element
        .closest('[data-ui-part="body-content"]')
        ?.querySelector<HTMLElement>('[data-ui-part="scroll-area-viewport"]')
        ?.scrollTo({ top: 0 });
    });
  });

  function profilePayload(): CommunityProfileUpdate {
    return { displayName, username, about, picture };
  }

  async function persistProfile(successMessage: string): Promise<boolean> {
    localError = "";
    message = "";
    try {
      await onUpdateProfile(profilePayload());
      message = successMessage;
      return true;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Profile save failed";
      return false;
    }
  }

  async function saveProfile(event?: SubmitEvent): Promise<void> {
    event?.preventDefault();
    if (await persistProfile("Profile saved to the relay.")) {
      editingProfile = false;
    }
  }

  async function saveAvatar(): Promise<void> {
    if (await persistProfile("Profile photo saved to the relay.")) {
      avatarEditorOpen = false;
    }
  }
</script>

<section
  bind:this={rootElement}
  class="community-settings"
  data-ui-component="community-settings"
  aria-labelledby={section === "account"
    ? "community-account-title"
    : "settings-title"}
>
  {#if section === "account"}
    <CommunityAccountSettings
      {account}
      busy={accountBusy}
      message={accountMessage}
      config={accountConfig}
      actions={accountActions}
      resumeAction={accountResumeAction}
      authenticationState={accountAuthenticationState}
      activeExternalSigner={accountActiveExternalSigner}
      {onCopyPublicKey}
      {onConnectGitHub}
      {onSignOut}
    />
  {:else if section === "profile"}
    <header class="community-settings__heading">
      <h1 id="settings-title">Profile</h1>
      <p>Update how your name, avatar, and bio appear across Lapis.</p>
    </header>

    <form class="community-settings__profile" onsubmit={saveProfile}>
      <div class="community-settings__avatar-editor">
        <CommunityAvatarPicker
          bind:value={picture}
          bind:open={avatarEditorOpen}
          label="Edit profile photo"
          size="medium"
          shape="circle"
          disabled={!model.identityConnected}
          communityEmojis={model.customEmojis}
          onUploadImage={onUploadProfileImage}
        />
        {#if picture !== model.profile.picture}
          <div class="community-settings__avatar-actions">
            <Button
              type="button"
              variant="outline"
              onclick={() => {
                picture = model.profile.picture;
                avatarEditorOpen = false;
              }}>Cancel</Button
            >
            <Button
              type="button"
              disabled={profileOperation?.status === "pending"}
              onclick={() => void saveAvatar()}
              >{profileOperation?.status === "pending"
                ? "Saving…"
                : "Done"}</Button
            >
          </div>
        {/if}
      </div>

      {#if !avatarEditorOpen}
        <section class="community-settings__option-section">
          <header>
            <h2>Profile info</h2>
            <Button
              type="button"
              size="sm"
              variant={editingProfile ? "default" : "secondary"}
              disabled={!model.identityConnected ||
                profileOperation?.status === "pending"}
              onclick={() => {
                if (editingProfile) void saveProfile();
                else editingProfile = true;
              }}
            >
              {#if editingProfile}
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
                Done
              {:else}
                <PencilIcon data-icon="inline-start" aria-hidden="true" />
                Edit
              {/if}
            </Button>
          </header>
          <Field.Group class="community-settings__option-group">
            <Field.Field class="community-settings__option-row">
              <Field.Label for="community-profile-display-name"
                >Display name</Field.Label
              >
              {#if editingProfile}
                <Input
                  id="community-profile-display-name"
                  bind:value={displayName}
                />
              {:else}
                <p>{displayName || "Not set"}</p>
              {/if}
            </Field.Field>
            <Field.Field class="community-settings__option-row">
              <Field.Label for="community-profile-username"
                >Username</Field.Label
              >
              {#if editingProfile}
                <Input id="community-profile-username" bind:value={username} />
              {:else}
                <p>{username || "Not set"}</p>
              {/if}
            </Field.Field>
            <Field.Field class="community-settings__option-row">
              <Field.Label>Profile description</Field.Label>
              {#if editingProfile}
                <CommunityChatComposer
                  mode="form"
                  bind:value={about}
                  ariaLabel="Profile description"
                />
              {:else}
                <p>{about || "Not set"}</p>
              {/if}
            </Field.Field>
          </Field.Group>
        </section>

        <section class="community-settings__option-section">
          <header><h2>Identity</h2></header>
          <details class="community-settings__identity">
            <summary>
              <span>
                <strong>Identity details</strong>
                <small
                  >Your Nostr public key is fixed by the connected signer.</small
                >
              </span>
              <ChevronRightIcon
                class="community-settings__identity-chevron"
                aria-hidden="true"
              />
            </summary>
            <p>{model.profile.pubkey || "No identity connected"}</p>
          </details>
        </section>
      {/if}

      <p class="community-settings__status" role="status">
        {localError || profileOperation?.message || message || disabledReason}
      </p>
    </form>
  {:else if section === "custom-emoji"}
    <CommunityCustomEmojiSettings
      {model}
      operation={emojiOperation}
      onUploadImage={onUploadCustomEmojiImage}
      onAdd={onAddCustomEmoji}
      onRemove={onRemoveCustomEmoji}
    />
  {:else}
    <CommunityAssetSettings {model} management={assetManagement} />
  {/if}
</section>
