/** Give portable application stories the same sized canvas as Storybook Canvas. */
export function preparePortableApplicationCanvas(
  document: Document,
  canvas: HTMLElement | undefined,
  fullViewport: boolean,
): void {
  if (!canvas || canvas.parentElement !== document.body || canvas.id) return;
  // The regular Storybook renderer already owns its named root and body classes.
  if (document.getElementById("storybook-root")) return;
  document.body.classList.toggle("sb-main-fullscreen", fullViewport);
  if (fullViewport) canvas.id = "storybook-root";
}
