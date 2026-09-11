<script lang="ts">
  import { ConfirmButton } from "@lapismd/design-core/forms/dialog";
  let removed = $state(false);
  let attempts = $state(0);
</script>

<div class="community-ui">
  <ConfirmButton
    title="Remove record?"
    description="This cannot be undone."
    confirmLabel="Remove"
    destructive
    onConfirm={async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Please retry");
      removed = true;
    }}>Remove record</ConfirmButton
  >
  <p role="status">{removed ? "Record removed" : "Record retained"}</p>
</div>
