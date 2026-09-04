<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ImageIcon from "@lucide/svelte/icons/image";
  import LinkIcon from "@lucide/svelte/icons/link-2";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";

  import type {
    CommunityOperationState,
    CommunityProfileUpdate,
    CommunitySettingsState,
  } from "../../community/index.js";
  import type { CommunitySettingsSection } from "./model.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import "./CommunitySettings.css";

  const avatarEmojis = [
    "😀",
    "😎",
    "🤓",
    "🥳",
    "🤖",
    "👻",
    "🐝",
    "🦊",
    "🐙",
    "🌈",
    "🔥",
    "✨",
    "🚀",
    "💎",
    "🎨",
    "💡",
  ] as const;
  const avatarColors = [
    "#f5d90a",
    "#ff8a4c",
    "#e5484d",
    "#ab4aba",
    "#6e56cf",
    "#0091ff",
    "#30a46c",
    "#687076",
  ] as const;

  let {
    model,
    profileOperation,
    emojiOperation,
    section = "profile",
    onUpdateProfile,
    onAddCustomEmoji,
    onRemoveCustomEmoji,
  }: {
    model: CommunitySettingsState;
    profileOperation?: CommunityOperationState;
    emojiOperation?: CommunityOperationState;
    section?: CommunitySettingsSection;
    onUpdateProfile: (profile: CommunityProfileUpdate) => Promise<void>;
    onAddCustomEmoji: (shortcode: string, url: string) => Promise<void>;
    onRemoveCustomEmoji: (shortcode: string) => Promise<void>;
  } = $props();

  let displayName = $state("");
  let username = $state("");
  let about = $state("");
  let picture = $state("");
  let shortcode = $state("");
  let emojiUrl = $state("");
  let localError = $state("");
  let localMessage = $state("");
  let editingProfile = $state(false);
  let avatarEditorOpen = $state(false);
  let avatarMode = $state("image");
  let avatarColor = $state<(typeof avatarColors)[number]>(avatarColors[4]);
  let avatarFileName = $state("");
  let emojiFileName = $state("");
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
    avatarFileName = "";
    localError = "";
    localMessage = "";
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
    localMessage = "";
    try {
      await onUpdateProfile(profilePayload());
      localMessage = successMessage;
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
      avatarFileName = "";
    }
  }

  async function addEmoji(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    localMessage = "";
    try {
      await onAddCustomEmoji(shortcode, emojiUrl);
      shortcode = "";
      emojiUrl = "";
      emojiFileName = "";
      localMessage = "Custom emoji saved to the relay.";
    } catch (cause) {
      localError = cause instanceof Error ? cause.message : "Emoji save failed";
    }
  }

  async function removeEmoji(value: string): Promise<void> {
    localError = "";
    localMessage = "";
    try {
      await onRemoveCustomEmoji(value);
      localMessage = `:${value}: removed from your emoji set.`;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Emoji removal failed";
    }
  }

  function readImage(
    event: Event,
    assign: (value: string, fileName: string) => void,
  ): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      localError = "Choose an image file.";
      return;
    }
    if (file.size > 1024 * 1024) {
      localError = "Choose an image smaller than 1 MB.";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        assign(reader.result, file.name);
        localError = "";
      }
    });
    reader.addEventListener("error", () => {
      localError = "The image could not be read.";
    });
    reader.readAsDataURL(file);
  }

  function emojiAvatar(emoji: string): void {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="128" fill="${avatarColor}"/><text x="128" y="166" font-size="128" text-anchor="middle">${emoji}</text></svg>`;
    picture = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
</script>

<section
  bind:this={rootElement}
  class="community-settings"
  data-ui-component="community-settings"
  aria-labelledby="settings-title"
>
  {#if section === "profile"}
    <header class="community-settings__heading">
      <h1 id="settings-title">Profile</h1>
      <p>Update how your name, avatar, and bio appear across Lapis.</p>
    </header>

    <form class="community-settings__profile" onsubmit={saveProfile}>
      <div class="community-settings__avatar-editor">
        {#if avatarEditorOpen}
          <Tabs.Root
            bind:value={avatarMode}
            class="community-settings__avatar-tabs"
          >
            <Tabs.List aria-label="Avatar type">
              <Tabs.Trigger value="image">Image</Tabs.Trigger>
              <Tabs.Trigger value="emoji">Emoji</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="image">
              <label class="community-settings__image-drop">
                <UploadCloudIcon aria-hidden="true" />
                <span>{avatarFileName || "Drop or browse for an image"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  aria-label="Upload profile image"
                  onchange={(event) =>
                    readImage(event, (value, fileName) => {
                      picture = value;
                      avatarFileName = fileName;
                    })}
                />
              </label>
              <div class="community-settings__url-input">
                <LinkIcon aria-hidden="true" />
                <Input
                  type="url"
                  bind:value={picture}
                  aria-label="Profile image URL"
                  placeholder="Paste an image URL"
                />
              </div>
            </Tabs.Content>
            <Tabs.Content value="emoji">
              <div
                class="community-settings__avatar-colors"
                aria-label="Avatar background"
              >
                {#each avatarColors as color (color)}
                  <button
                    type="button"
                    aria-label={`Use ${color} background`}
                    aria-pressed={avatarColor === color}
                    style={`--avatar-color: ${color}`}
                    onclick={() => (avatarColor = color)}
                  ></button>
                {/each}
              </div>
              <div
                class="community-settings__avatar-emojis"
                aria-label="Choose an emoji"
              >
                {#each avatarEmojis as emoji (emoji)}
                  <button
                    type="button"
                    aria-label={`Use ${emoji} as profile photo`}
                    onclick={() => emojiAvatar(emoji)}>{emoji}</button
                  >
                {/each}
              </div>
              <div class="community-settings__avatar-picker">
                <CommunityEmojiPicker
                  label="Browse all emoji"
                  communityEmojis={model.customEmojis}
                  onSelect={(emoji, custom) => {
                    if (custom) picture = custom.url;
                    else emojiAvatar(emoji);
                  }}
                />
                <span>Browse all emoji</span>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        {/if}

        <div class="community-settings__avatar-frame">
          <span
            class="community-settings__avatar"
            aria-label="Profile photo"
            role="img"
          >
            {#if picture}
              <img src={picture} alt="" />
            {:else}
              <UserRoundIcon aria-hidden="true" />
            {/if}
          </span>
          {#if !avatarEditorOpen}
            <Button
              type="button"
              size="icon"
              class="community-settings__avatar-edit"
              aria-label="Edit profile photo"
              title="Edit profile photo"
              disabled={!model.identityConnected}
              onclick={() => (avatarEditorOpen = true)}
            >
              <PencilIcon aria-hidden="true" />
            </Button>
          {/if}
        </div>

        {#if avatarEditorOpen}
          <div class="community-settings__avatar-actions">
            <Button
              type="button"
              variant="ghost"
              onclick={() => {
                picture = model.profile.picture;
                avatarEditorOpen = false;
              }}>Cancel</Button
            >
            <Button
              type="button"
              disabled={profileOperation?.status === "pending"}
              onclick={() => void saveAvatar()}
            >
              {profileOperation?.status === "pending" ? "Saving…" : "Done"}
            </Button>
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
              <Field.Label for="community-profile-about"
                >Profile description</Field.Label
              >
              {#if editingProfile}
                <Textarea
                  id="community-profile-about"
                  bind:value={about}
                  rows={3}
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
        {localError ||
          profileOperation?.message ||
          localMessage ||
          disabledReason}
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
              <span>{emojiFileName || "Upload image"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                aria-label="Upload custom emoji image"
                onchange={(event) =>
                  readImage(event, (value, fileName) => {
                    emojiUrl = value;
                    emojiFileName = fileName;
                    if (!shortcode) {
                      shortcode = fileName
                        .replace(/\.[^.]+$/, "")
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]+/g, "-")
                        .replace(/^-+|-+$/g, "");
                    }
                  })}
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
        {localError ||
          emojiOperation?.message ||
          localMessage ||
          disabledReason}
      </p>
    </form>
  {/if}
</section>
