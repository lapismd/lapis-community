<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import ImagesIcon from "@lucide/svelte/icons/images";
  import SmileIcon from "@lucide/svelte/icons/smile";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";

  import type { CommunitySettingsSection } from "../community-settings/model.js";
  import "./CommunitySettingsNavigation.css";

  let {
    section,
    onSelect,
    onClose,
  }: {
    section: CommunitySettingsSection;
    onSelect: (section: CommunitySettingsSection) => void;
    onClose: () => void;
  } = $props();
</script>

<nav class="community-settings-navigation" aria-label="Settings navigation">
  <Button
    variant="ghost"
    class="community-settings-navigation__back"
    onclick={onClose}
  >
    <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
    Back to Lapis
  </Button>
  <section>
    <h2>Personal</h2>
    <Button
      variant="ghost"
      class="community-settings-navigation__item"
      data-active={section === "account" ? "" : undefined}
      aria-pressed={section === "account"}
      onclick={() => onSelect("account")}
    >
      <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
      Account
    </Button>
    <Button
      variant="ghost"
      class="community-settings-navigation__item"
      data-active={section === "profile" ? "" : undefined}
      aria-pressed={section === "profile"}
      onclick={() => onSelect("profile")}
    >
      <UserRoundIcon data-icon="inline-start" aria-hidden="true" />
      Profile
    </Button>
    <Button
      variant="ghost"
      class="community-settings-navigation__item"
      data-active={section === "custom-emoji" ? "" : undefined}
      aria-pressed={section === "custom-emoji"}
      onclick={() => onSelect("custom-emoji")}
    >
      <SmileIcon data-icon="inline-start" aria-hidden="true" />
      Custom emoji
    </Button>
    <Button
      variant="ghost"
      class="community-settings-navigation__item"
      data-active={section === "media" ? "" : undefined}
      aria-pressed={section === "media"}
      onclick={() => onSelect("media")}
    >
      <ImagesIcon data-icon="inline-start" aria-hidden="true" />
      Media
    </Button>
  </section>
</nav>
