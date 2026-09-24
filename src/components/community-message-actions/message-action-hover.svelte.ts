import { onDestroy } from "svelte";
/** One hover/focus lifecycle for messages and transcript records. */
export function createMessageActionHover() {
  const actionOpenDelay = 180;
  const actionCloseDelay = 150;
  let actionOpenTimer: ReturnType<typeof setTimeout> | undefined;
  let actionCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let actionsVisible = $state(false);
  let hasFocusWithin = false;

  function clearActionOpenTimer(): void {
    if (actionOpenTimer === undefined) return;
    clearTimeout(actionOpenTimer);
    actionOpenTimer = undefined;
  }

  function clearActionCloseTimer(): void {
    if (actionCloseTimer === undefined) return;
    clearTimeout(actionCloseTimer);
    actionCloseTimer = undefined;
  }

  function scheduleActions(): void {
    clearActionCloseTimer();
    if (actionsVisible) return;
    clearActionOpenTimer();
    actionOpenTimer = setTimeout(() => {
      actionsVisible = true;
      actionOpenTimer = undefined;
    }, actionOpenDelay);
  }

  function keepActionsVisible(): void {
    clearActionOpenTimer();
    clearActionCloseTimer();
    actionsVisible = true;
  }

  function scheduleActionsHide(): void {
    clearActionOpenTimer();
    clearActionCloseTimer();
    if (hasFocusWithin) return;
    actionCloseTimer = setTimeout(() => {
      actionsVisible = false;
      actionCloseTimer = undefined;
    }, actionCloseDelay);
  }

  function focusActions(): void {
    hasFocusWithin = true;
    keepActionsVisible();
  }

  function blurActions(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget instanceof Node) {
      if (event.currentTarget.contains(next)) return;
    }
    hasFocusWithin = false;
    clearActionCloseTimer();
    actionsVisible = false;
  }

  onDestroy(() => {
    clearActionOpenTimer();
    clearActionCloseTimer();
  });

  return {
    get visible() {
      return actionsVisible;
    },
    handlers: {
      onpointerenter: scheduleActions,
      onpointerleave: scheduleActionsHide,
      onfocusin: focusActions,
      onfocusout: blurActions,
      onpointerdown: (event: PointerEvent) => {
        if (event.pointerType === "touch") keepActionsVisible();
      },
    },
  };
}
