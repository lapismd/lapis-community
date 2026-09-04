<script lang="ts">
  let {
    shortcode,
    src,
    ref = $bindable(null),
  }: {
    shortcode: string;
    src: string;
    ref?: HTMLImageElement | null;
  } = $props();
</script>

<img
  bind:this={ref}
  class="community-emoji-reference"
  {src}
  alt={`:${shortcode}:`}
  title={`:${shortcode}:`}
/>

<style>
  .community-emoji-reference {
    display: inline-block;
    width: 1.15em;
    height: 1.15em;
    margin-inline: 0.04em;
    object-fit: contain;
    vertical-align: -0.2em;
  }
</style>
