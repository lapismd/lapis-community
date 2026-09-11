<script lang="ts">
  import { CommunityAvatarPicker } from "@lapismd/lapis-community/components";
  let value = $state("");
</script>

<div class="community-ui">
  <CommunityAvatarPicker bind:value label="Choose avatar" /><output
    >{value ? "Avatar selected" : "No avatar selected"}</output
  >
</div>
