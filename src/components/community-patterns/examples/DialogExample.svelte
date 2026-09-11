<script lang="ts">
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  let open = $state(false);
</script>

<div class="community-ui">
  <Button onclick={() => (open = true)}>Edit record</Button>
  <Dialog.Root bind:open
    ><DialogFrame title="Edit record" size="form">
      <form
        id="pattern-record"
        onsubmit={(event) => {
          event.preventDefault();
          open = false;
        }}
      >
        {#each Array(18) as _, i}<label class="pattern-field"
            >Field {i + 1}<Input aria-label={`Field ${i + 1}`} /></label
          >{/each}
      </form>
      {#snippet footer()}<Button
          variant="outline"
          onclick={() => (open = false)}>Cancel</Button
        ><Button type="submit" form="pattern-record">Save</Button>{/snippet}
    </DialogFrame></Dialog.Root
  >
</div>

<style>
  .pattern-field {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
</style>
