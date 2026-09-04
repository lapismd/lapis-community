<script lang="ts">
  import type { Snippet } from "svelte";

  type SpoilerParticle = {
    x: number;
    y: number;
    size: number;
    phase: number;
    speed: number;
    driftX: number;
    driftY: number;
    shape: "circle" | "square" | "sparkle";
  };

  let {
    label = "Spoiler",
    children,
    ref = $bindable(null),
  }: {
    label?: string;
    children?: Snippet;
    ref?: HTMLButtonElement | null;
  } = $props();

  let revealed = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let content = $state<HTMLSpanElement>();

  $effect(() => {
    if (revealed || !canvas || !content) return;

    return mountSpoilerParticles(canvas, content, label);
  });

  function mountSpoilerParticles(
    target: HTMLCanvasElement,
    contentElement: HTMLSpanElement,
    seedText: string,
  ): () => void {
    const renderingContext = target.getContext("2d");
    if (!renderingContext) return () => {};
    const context: CanvasRenderingContext2D = renderingContext;

    let animationFrame = 0;
    let particles: SpoilerParticle[] = [];
    let width = 1;
    let height = 1;
    let visible = true;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;

    function draw(timeMs: number): void {
      context.clearRect(0, 0, width, height);
      context.fillStyle = getComputedStyle(target).color;
      const time = timeMs / 1_000;

      for (const particle of particles) {
        const wave = Math.sin(time * particle.speed + particle.phase);
        const x = particle.x + wave * particle.driftX;
        const y =
          particle.y +
          Math.cos(time * particle.speed + particle.phase) * particle.driftY;
        const size = particle.size * (0.78 + (wave + 1) * 0.11);
        context.globalAlpha = reducedMotion ? 0.68 : 0.32 + (wave + 1) * 0.26;

        if (particle.shape === "circle") {
          context.beginPath();
          context.arc(x, y, size / 2, 0, Math.PI * 2);
          context.fill();
        } else if (particle.shape === "square") {
          context.fillRect(x - size / 2, y - size / 2, size, size);
        } else {
          const thickness = Math.max(0.55, size * 0.26);
          context.fillRect(x - size / 2, y - thickness / 2, size, thickness);
          context.fillRect(x - thickness / 2, y - size / 2, thickness, size);
        }
      }

      context.globalAlpha = 1;
    }

    function rebuild(): void {
      const bounds = target.getBoundingClientRect();
      const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      target.width = Math.max(1, Math.ceil(width * devicePixelRatio));
      target.height = Math.max(1, Math.ceil(height * devicePixelRatio));
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      particles = buildParticles(seedText, width, height);
      draw(reducedMotion ? 0 : performance.now());
    }

    function animate(timeMs: number): void {
      draw(timeMs);
      animationFrame = window.requestAnimationFrame(animate);
    }

    function stop(): void {
      if (!animationFrame) return;

      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function start(): void {
      stop();
      if (!visible || reducedMotion) {
        draw(0);
        return;
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    const resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(contentElement);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        start();
      },
      { rootMargin: "96px" },
    );
    intersectionObserver.observe(target);

    const themeObserver = new MutationObserver(rebuild);
    themeObserver.observe(target.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    const handleMotionChange = (): void => {
      reducedMotion = motionQuery.matches;
      start();
    };
    motionQuery.addEventListener("change", handleMotionChange);

    rebuild();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }

  function buildParticles(
    seedText: string,
    width: number,
    height: number,
  ): SpoilerParticle[] {
    let seed = hashText(seedText) ^ Math.round(width * 31 + height * 17);
    const random = (): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 4_294_967_296;
    };
    const count = Math.min(
      180,
      Math.max(18, Math.round(width * height * 0.024)),
    );

    return Array.from({ length: count }, (_, index) => {
      const shapeRoll = random();
      return {
        x: 2 + random() * Math.max(1, width - 4),
        y: 2 + random() * Math.max(1, height - 4),
        size: 0.8 + random() * (index % 9 === 0 ? 2.1 : 1.25),
        phase: random() * Math.PI * 2,
        speed: 5 + random() * 5.5,
        driftX: (random() - 0.5) * 2.4,
        driftY: (random() - 0.5) * 1.8,
        shape:
          shapeRoll > 0.9 ? "sparkle" : shapeRoll > 0.48 ? "circle" : "square",
      };
    });
  }

  function hashText(value: string): number {
    let hash = 2_166_136_261;
    for (const character of value) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
  }
</script>

<button
  bind:this={ref}
  class="community-spoiler"
  class:revealed
  type="button"
  data-revealed={revealed}
  aria-label={revealed ? `Hide spoiler: ${label}` : "Reveal spoiler"}
  aria-pressed={revealed}
  onclick={() => (revealed = !revealed)}
>
  <canvas
    bind:this={canvas}
    class="community-spoiler__particles"
    data-ui-part="spoiler-particles"
    aria-hidden="true"
  ></canvas>
  <span
    bind:this={content}
    class="community-spoiler__content"
    data-ui-part="spoiler-content"
    aria-hidden={!revealed}>{@render children?.()}</span
  >
</button>

<style>
  .community-spoiler {
    position: relative;
    display: inline-block;
    padding: 0 0.12em;
    border: 0;
    border-radius: 0.3rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    line-height: inherit;
    vertical-align: baseline;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    transition: background-color 400ms ease-out;
  }

  .community-spoiler:hover,
  .community-spoiler:focus-visible,
  .community-spoiler.revealed {
    background: color-mix(in srgb, var(--muted) 68%, transparent);
  }

  .community-spoiler:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .community-spoiler__content {
    position: relative;
    z-index: 0;
    opacity: 0;
    color: transparent;
    filter: blur(0.5px);
    text-decoration-color: transparent;
    text-shadow: none;
    transition:
      opacity 180ms ease-out,
      filter 180ms ease-out,
      color 180ms ease-out;
  }

  .community-spoiler__particles {
    position: absolute;
    z-index: 1;
    inset: -0.1em;
    width: calc(100% + 0.2em);
    height: calc(100% + 0.2em);
    border-radius: inherit;
    color: color-mix(in srgb, var(--foreground) 76%, transparent);
    opacity: 1;
    pointer-events: none;
    transition: opacity 400ms ease-out;
  }

  .community-spoiler.revealed .community-spoiler__content {
    opacity: 1;
    color: inherit;
    filter: none;
    text-decoration-color: currentColor;
  }

  .community-spoiler.revealed .community-spoiler__particles {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .community-spoiler,
    .community-spoiler__content,
    .community-spoiler__particles {
      transition: none;
    }
  }
</style>
