<script lang="ts">
  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type { RegistryReleaseEditDraft } from "./model.js";
  import "./RegistryReleasePublisherIdentityField.css";

  type Props = RegisteredFormRendererProps<
    "registry-publisher-identity",
    RegistryReleaseEditDraft
  >;

  let { value }: Props = $props();

  const displayName = $derived(value.trim() || "Unknown publisher");
  const publisher = $derived({
    id: displayName,
    name: displayName,
    handle: displayName,
    initials: initials(displayName),
  } satisfies CommunityMemberModel);

  function initials(value: string): string {
    return value
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase();
  }
</script>

<div class="registry-release-publisher-identity">
  <CommunityMemberAvatar member={publisher} size="xsmall" />
  <span>{displayName}</span>
</div>
