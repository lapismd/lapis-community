<script lang="ts">
  import { CommunityEmojiPicker } from "@lapismd/lapis-community/components";
  let selected = $state("");
</script>

<div class="community-ui">
  <CommunityEmojiPicker
    label="Choose emoji"
    onSelect={(emoji) => {
      selected = emoji;
    }}
  /><output>{selected}</output>
</div>
