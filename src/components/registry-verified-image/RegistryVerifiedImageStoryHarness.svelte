<script lang="ts">
  import type { RegistryImageReference } from "../../registry/index.js";
  import RegistryVerifiedImage from "./RegistryVerifiedImage.svelte";
  import { provideRegistryImageLoader } from "./context.js";

  const first: RegistryImageReference = {
    url: "/registry/assets/first.webp",
    sourceUrl: "https://assets.example/first.webp",
    sha256: "a".repeat(64),
    size: 5,
    mediaType: "image/webp",
    width: 240,
    height: 160,
  };
  const second: RegistryImageReference = {
    ...first,
    sourceUrl: "https://assets.example/second.webp",
    sha256: "b".repeat(64),
  };

  provideRegistryImageLoader(
    async (reference) =>
      new Blob(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" fill="${reference.sha256 === first.sha256 ? "#a855f7" : "#2563eb"}"/></svg>`,
        ],
        { type: "image/svg+xml" },
      ),
  );

  let visible = $state(false);
  let reference = $state(first);
</script>

<div class="registry-verified-image-story">
  <div class="registry-verified-image-story__actions">
    <button type="button" onclick={() => (visible = true)}>Show image</button>
    <button type="button" onclick={() => (reference = second)}>
      Replace image
    </button>
    <button type="button" onclick={() => (visible = false)}>Hide image</button>
  </div>
  {#if visible}
    <RegistryVerifiedImage {reference} alt="Verified plugin preview" />
  {/if}
</div>

<style>
  .registry-verified-image-story {
    display: grid;
    width: min(30rem, 100%);
    gap: 1rem;
  }

  .registry-verified-image-story__actions {
    display: flex;
    gap: 0.5rem;
  }

  .registry-verified-image-story__actions button {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.75rem;
    background: var(--background);
    color: var(--foreground);
  }

  :global(.registry-verified-image-story img) {
    width: 15rem;
    border-radius: var(--radius);
  }
</style>
