<script lang="ts">
  import { CommunityChatComposer } from "@lapismd/lapis-community/components";
  let value = $state("");
  let saved = $state("");
</script>

<div class="community-ui">
  <form
    onsubmit={(event) => {
      event.preventDefault();
      saved = value;
    }}
  >
    <CommunityChatComposer
      mode="form"
      bind:value
      ariaLabel="Description"
    /><button type="submit">Save description</button>
  </form>
  <output>{saved}</output>
</div>
