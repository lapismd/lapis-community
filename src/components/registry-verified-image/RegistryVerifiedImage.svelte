<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLImgAttributes } from "svelte/elements";

  import type { RegistryImageReference } from "../../registry/index.js";
  import { registryImageLoader } from "./context.js";

  let {
    reference,
    alt,
    fallback,
    width,
    height,
    loading,
    class: className,
  }: {
    reference: RegistryImageReference;
    alt: string;
    fallback?: Snippet;
    width?: HTMLImgAttributes["width"];
    height?: HTMLImgAttributes["height"];
    loading?: HTMLImgAttributes["loading"];
    class?: HTMLImgAttributes["class"];
  } = $props();

  const loader = registryImageLoader();
  let resolvedUrl = $state("");
  let failed = $state(false);
  let observedElement = $state<HTMLElement>();
  let inView = $state(false);

  $effect(() => {
    if (loader === undefined || loading !== "lazy") {
      inView = true;
      return;
    }
    const element = observedElement;
    if (element === undefined || typeof IntersectionObserver === "undefined") {
      inView = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) inView = true;
      },
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  });

  $effect(() => {
    const current = reference;
    if (loader === undefined) {
      resolvedUrl = current.url;
      failed = false;
      return;
    }
    if (!inView) return;

    const controller = new AbortController();
    let active = true;
    let objectUrl = "";
    resolvedUrl = "";
    failed = false;
    void loader(current, { signal: controller.signal })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        resolvedUrl = objectUrl;
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof DOMException) || cause.name !== "AbortError")
        ) {
          failed = true;
        }
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl !== "") URL.revokeObjectURL(objectUrl);
    };
  });
</script>

{#if resolvedUrl !== ""}
  <img
    bind:this={observedElement}
    src={resolvedUrl}
    {alt}
    {width}
    {height}
    {loading}
    class={className}
  />
{:else}
  <span
    bind:this={observedElement}
    class="registry-verified-image__placeholder"
    data-image-state={failed ? "failed" : "loading"}
    role={alt === "" ? undefined : "img"}
    aria-label={alt === "" ? undefined : failed ? `${alt} unavailable` : alt}
    aria-hidden={alt === "" ? "true" : undefined}
  >
    {#if fallback}{@render fallback()}{/if}
  </span>
{/if}

<style>
  .registry-verified-image__placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 2rem;
    background: color-mix(in srgb, currentColor 5%, transparent);
  }
</style>
