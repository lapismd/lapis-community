<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Card from "@lapismd/design-core/shadcn/card";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ImageIcon from "@lucide/svelte/icons/image";
  import SmileIcon from "@lucide/svelte/icons/smile";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";

  import type {
    CommunityOperationState,
    CommunityProfileUpdate,
    CommunitySettingsState,
  } from "../../community/index.js";
  import "./CommunitySettings.css";

  type SettingsSection = "profile" | "custom-emoji";

  let {
    model,
    profileOperation,
    emojiOperation,
    initialSection = "profile",
    onClose = () => {},
    onUpdateProfile,
    onAddCustomEmoji,
    onRemoveCustomEmoji,
  }: {
    model: CommunitySettingsState;
    profileOperation?: CommunityOperationState;
    emojiOperation?: CommunityOperationState;
    initialSection?: SettingsSection;
    onClose?: () => void;
    onUpdateProfile: (profile: CommunityProfileUpdate) => Promise<void>;
    onAddCustomEmoji: (shortcode: string, url: string) => Promise<void>;
    onRemoveCustomEmoji: (shortcode: string) => Promise<void>;
  } = $props();

  let section = $state<SettingsSection>("profile");
  let displayName = $state("");
  let username = $state("");
  let about = $state("");
  let picture = $state("");
  let shortcode = $state("");
  let emojiUrl = $state("");
  let localError = $state("");
  let localMessage = $state("");

  const ownedEmojis = $derived(
    model.customEmojis.filter((emoji) => emoji.owned),
  );
  const disabledReason = $derived(
    model.identityConnected
      ? ""
      : "Connect a NIP-07 identity to save personal settings.",
  );

  $effect(() => {
    section = initialSection;
  });

  $effect(() => {
    displayName = model.profile.displayName;
    username = model.profile.username;
    about = model.profile.about;
    picture = model.profile.picture;
  });

  async function saveProfile(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    localMessage = "";
    try {
      await onUpdateProfile({ displayName, username, about, picture });
      localMessage = "Profile saved to the relay.";
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Profile save failed";
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

  function selectSection(value: SettingsSection): void {
    section = value;
    localError = "";
    localMessage = "";
  }
</script>

<div class="community-settings" data-ui-component="community-settings">
  <aside
    class="community-settings__navigation"
    aria-label="Settings navigation"
  >
    <Button variant="ghost" class="community-settings__back" onclick={onClose}>
      <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
      Back to Lapis
    </Button>
    <div class="community-settings__navigation-group">
      <p>Personal</p>
      <Button
        variant="ghost"
        class="community-settings__navigation-item"
        data-active={section === "profile" ? "" : undefined}
        aria-pressed={section === "profile"}
        onclick={() => selectSection("profile")}
      >
        <UserRoundIcon data-icon="inline-start" aria-hidden="true" />
        Profile
      </Button>
      <Button
        variant="ghost"
        class="community-settings__navigation-item"
        data-active={section === "custom-emoji" ? "" : undefined}
        aria-pressed={section === "custom-emoji"}
        onclick={() => selectSection("custom-emoji")}
      >
        <SmileIcon data-icon="inline-start" aria-hidden="true" />
        Custom emoji
      </Button>
    </div>
  </aside>

  <section class="community-settings__content" aria-labelledby="settings-title">
    {#if section === "profile"}
      <header class="community-settings__heading">
        <h1 id="settings-title">Profile</h1>
        <p>Choose how you appear to people across your Nostr communities.</p>
      </header>

      <Card.Root class="community-settings__card">
        <Card.Header>
          <Card.Title>Personal profile</Card.Title>
          <Card.Description>
            These values are published as your signed Nostr profile.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form class="community-settings__form" onsubmit={saveProfile}>
            <div class="community-settings__avatar-row">
              <span class="community-settings__avatar" aria-hidden="true">
                {#if picture}
                  <img src={picture} alt="" />
                {:else}
                  <UserRoundIcon />
                {/if}
              </span>
              <div>
                <strong>{displayName || username || "Your profile"}</strong>
                <small>{model.profile.pubkey || "No identity connected"}</small>
              </div>
            </div>
            <Field.Group>
              <Field.Field>
                <Field.Label for="community-profile-display-name"
                  >Display name</Field.Label
                >
                <Input
                  id="community-profile-display-name"
                  bind:value={displayName}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="community-profile-username"
                  >Username</Field.Label
                >
                <Input id="community-profile-username" bind:value={username} />
                <Field.Description
                  >Used as your short Nostr name.</Field.Description
                >
              </Field.Field>
              <Field.Field>
                <Field.Label for="community-profile-about"
                  >Profile description</Field.Label
                >
                <Textarea
                  id="community-profile-about"
                  bind:value={about}
                  rows={4}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="community-profile-picture"
                  >Avatar URL</Field.Label
                >
                <Input
                  id="community-profile-picture"
                  type="url"
                  bind:value={picture}
                  placeholder="https://…"
                />
              </Field.Field>
            </Field.Group>
            <div class="community-settings__form-footer">
              <p class="community-settings__status" role="status">
                {localError ||
                  profileOperation?.message ||
                  localMessage ||
                  disabledReason}
              </p>
              <Button
                type="submit"
                disabled={!model.identityConnected ||
                  profileOperation?.status === "pending"}
                title={disabledReason || undefined}
              >
                {profileOperation?.status === "pending"
                  ? "Saving…"
                  : "Save changes"}
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card.Root>
    {:else}
      <header class="community-settings__heading">
        <h1 id="settings-title">Custom emoji</h1>
        <p>Add image-backed emoji to your personal NIP-30 emoji set.</p>
      </header>

      <Card.Root class="community-settings__card">
        <Card.Header>
          <Card.Title>Add custom emoji</Card.Title>
          <Card.Description>
            Everyone can use emoji shared by community members. You can edit
            only your own set.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form class="community-settings__emoji-form" onsubmit={addEmoji}>
            <span class="community-settings__emoji-preview" aria-hidden="true">
              {#if emojiUrl}
                <img src={emojiUrl} alt="" />
              {:else}
                <ImageIcon />
              {/if}
            </span>
            <Field.Group>
              <Field.Field>
                <Field.Label for="community-emoji-shortcode">Name</Field.Label>
                <Input
                  id="community-emoji-shortcode"
                  bind:value={shortcode}
                  placeholder="party-lapis"
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="community-emoji-url">Image URL</Field.Label>
                <Input
                  id="community-emoji-url"
                  type="url"
                  bind:value={emojiUrl}
                  placeholder="https://…"
                />
              </Field.Field>
            </Field.Group>
            <div
              class="community-settings__form-footer community-settings__form-footer--wide"
            >
              <p class="community-settings__status" role="status">
                {localError ||
                  emojiOperation?.message ||
                  localMessage ||
                  disabledReason}
              </p>
              <Button
                type="submit"
                disabled={!model.identityConnected ||
                  emojiOperation?.status === "pending"}
                title={disabledReason || undefined}
              >
                Add emoji
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card.Root>

      <section
        class="community-settings__emoji-list"
        aria-label="Your custom emoji"
      >
        <div>
          <h2>Your emoji</h2>
          <p>{ownedEmojis.length} in your signed set</p>
        </div>
        {#if ownedEmojis.length === 0}
          <p class="community-settings__empty">
            You have not added any custom emoji yet.
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
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </section>
</div>
