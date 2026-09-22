export function composerAutocompletePlacement(
  composer: HTMLElement,
  list: HTMLElement,
): "above" | "below" {
  const composerBounds = composer.getBoundingClientRect();
  let boundaryTop = 0;
  let ancestor = composer.parentElement;
  while (ancestor) {
    const style = getComputedStyle(ancestor);
    if (
      /(auto|scroll|hidden|clip)/u.test(`${style.overflow} ${style.overflowY}`)
    ) {
      const bounds = ancestor.getBoundingClientRect();
      boundaryTop = Math.max(boundaryTop, bounds.top);
    }
    ancestor = ancestor.parentElement;
  }
  const gap = 0.4 * Number.parseFloat(getComputedStyle(composer).fontSize);
  const popupHeight = list.getBoundingClientRect().height;
  return composerBounds.top - boundaryTop - gap >= popupHeight
    ? "above"
    : "below";
}
