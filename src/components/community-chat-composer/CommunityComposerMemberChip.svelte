<script lang="ts">
  import { contentMentionLabel } from "../../community/content-mentions.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityComposerMemberReference from "./CommunityComposerMemberReference.svelte";
  import CommunityComposerRemovableChip from "./CommunityComposerRemovableChip.svelte";
  import type { CommunityComposerExtensionOptions } from "./composer-extension.js";

  let {
    member,
    token,
    options,
    onRemove,
  }: {
    member: CommunityMemberModel;
    token: string;
    options: CommunityComposerExtensionOptions;
    onRemove: () => void;
  } = $props();

  const label = $derived(
    contentMentionLabel(member.id, token, [member]).replace(/^@+/u, ""),
  );
</script>

<CommunityComposerRemovableChip {label} {onRemove}>
  <CommunityComposerMemberReference {member} label={token} {options} />
</CommunityComposerRemovableChip>
