<script lang="ts">
  import CommunityAvatarPicker from "../community-avatar-picker/CommunityAvatarPicker.svelte";
  import {
    COMMUNITY_AVATAR_IMAGE_ACCEPT,
    resolveCommunityAvatarImage,
  } from "../community-avatar-picker/image-files.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import ImageIcon from "@lucide/svelte/icons/image";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  import type {
    CommunityAccountSession,
    CommunityRelayAuthConfig,
  } from "../../auth/index.js";
  import type {
    CommunityOperationState,
    CommunityProfileUpdate,
    CommunitySettingsState,
  } from "../../community/index.js";
  import CommunityAccountSettings from "../community-account-settings/CommunityAccountSettings.svelte";
  import type {
    CommunityAccountAuthenticationState,
    CommunityAccountManagementActions,
    CommunityAccountResumeAction,
  } from "../community-account-settings/model.js";
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
    section?: CommunitySettingsSection;
    onUpdateProfile: (profile: CommunityProfileUpdate) => Promise<void>;
    onUploadProfileImage?: ((file: File) => Promise<string>) | undefined;
    onUploadCustomEmojiImage?: ((file: File) => Promise<string>) | undefined;
    onAddCustomEmoji: (shortcode: string, url: string) => Promise<void>;
    onRemoveCustomEmoji: (shortcode: string) => Promise<void>;
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
  let shortcode = $state("");
  let emojiUrl = $state("");
  let localError = $state(""),
    message = $state("");
  let editingProfile = $state(false);
  let avatarEditorOpen = $state(false);
  let emojiFileName = $state(""),
    uploading = $state(false);
  let rootElement = $state<HTMLElement>();

  const ownedEmojis = $derived(
    model.customEmojis.filter((emoji) => emoji.owned),
  );
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

  async function addEmoji(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    message = "";
    try {
      await onAddCustomEmoji(shortcode, emojiUrl);
      shortcode = "";
      emojiUrl = "";
      emojiFileName = "";
      message = "Custom emoji saved to the relay.";
    } catch (cause) {
      localError = cause instanceof Error ? cause.message : "Emoji save failed";
    }
  }

  async function removeEmoji(value: string): Promise<void> {
    localError = "";
    message = "";
    try {
      await onRemoveCustomEmoji(value);
      message = `:${value}: removed from your emoji set.`;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Emoji removal failed";
    }
  }

  async function uploadEmojiImage(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file || uploading) return;
    localError = "";
    message = "";
    uploading = true;
    try {
      emojiUrl = await resolveCommunityAvatarImage(file, {
        upload: onUploadCustomEmojiImage,
      });
      emojiFileName = file.name;
      shortcode ||= file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      message = "Emoji image uploaded. Save emoji to publish it.";
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "The image could not be read.";
    } finally {
      uploading = false;
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
  {:else}
    <header class="community-settings__heading">
      <h1 id="settings-title">Custom emoji</h1>
      <p>
        Add your own custom emoji for everyone on this relay to use. Type
        <code>:name:</code> in messages and reactions.
      </p>
    </header>

    <form class="community-settings__custom-emoji" onsubmit={addEmoji}>
      <section class="community-settings__option-section">
        <header><h2>Add emoji</h2></header>
        <div class="community-settings__emoji-builder">
          <div
            class="community-settings__emoji-row"
            data-ui-part="custom-emoji-row"
          >
            <div class="community-settings__emoji-copy">
              <h3>Upload an image</h3>
              <p>
                Square images work best. GIF, PNG, JPEG, and WebP files are
                supported.
              </p>
            </div>
            <label class="community-settings__emoji-upload">
              <span
                class="community-settings__emoji-preview"
                aria-hidden="true"
              >
                {#if emojiUrl}
                  <img src={emojiUrl} alt="" />
                {:else}
                  <ImageIcon />
                {/if}
              </span>
              <span
                >{uploading
                  ? "Uploading…"
                  : emojiFileName || "Upload image"}</span
              >
              <input
                type="file"
                accept={COMMUNITY_AVATAR_IMAGE_ACCEPT}
                aria-label="Upload custom emoji image"
                disabled={uploading}
                onchange={(event) => void uploadEmojiImage(event)}
              />
            </label>
          </div>
          <div
            class="community-settings__emoji-row"
            data-ui-part="custom-emoji-row"
          >
            <div class="community-settings__emoji-copy">
              <h3>Give it a name</h3>
              <p>
                This is what you’ll type to add this emoji to messages and
                reactions.
              </p>
            </div>
            <Field.Group class="community-settings__emoji-name">
              <Field.Field>
                <Field.Label for="community-emoji-shortcode">Name</Field.Label>
                <div class="community-settings__emoji-name-input">
                  <span aria-hidden="true">:</span>
                  <Input
                    id="community-emoji-shortcode"
                    bind:value={shortcode}
                    placeholder="party-parrot"
                    autocapitalize="none"
                    autocomplete="off"
                    spellcheck={false}
                  />
                  <span aria-hidden="true">:</span>
                </div>
                <Field.Description>
                  Choose an image first; Lapis will suggest a name from the
                  filename.
                </Field.Description>
              </Field.Field>
            </Field.Group>
          </div>
          <div class="community-settings__emoji-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={!emojiUrl && !shortcode}
              onclick={() => {
                emojiUrl = "";
                shortcode = "";
                emojiFileName = "";
              }}>Clear</Button
            >
            <Button
              type="submit"
              disabled={!model.identityConnected ||
                !emojiUrl ||
                !shortcode ||
                uploading ||
                emojiOperation?.status === "pending"}
              title={disabledReason || undefined}>Save emoji</Button
            >
          </div>
        </div>
      </section>

      <section
        class="community-settings__option-section community-settings__emoji-list"
        aria-label="Your custom emoji"
      >
        <header>
          <h2>My emoji</h2>
          <p>{ownedEmojis.length} in your signed set</p>
        </header>
        {#if ownedEmojis.length === 0}
          <p class="community-settings__empty">
            You haven't added any emoji yet. Add one above.
          </p>
        {:else}
          <ul>
            {#each ownedEmojis as emoji (emoji.shortcode)}
              <li>
                <img src={emoji.url} alt="" />
                <span>
                  <strong>:{emoji.shortcode}:</strong>
                  <small>{emoji.url}</small>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove :${emoji.shortcode}:`}
                  title={`Remove :${emoji.shortcode}:`}
                  disabled={!model.identityConnected}
                  onclick={() => void removeEmoji(emoji.shortcode)}
                  ><Trash2Icon aria-hidden="true" /></Button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <p class="community-settings__status" role="status">
        {localError || emojiOperation?.message || message || disabledReason}
      </p>
    </form>
  {/if}
</section>
