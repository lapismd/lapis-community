<script lang="ts">
  import { onDestroy } from "svelte";
  import { toast } from "svelte-sonner";

  import { formatCommunityRelativeTime } from "../community-relative-time/model.js";

  let {
    cachedCatalogAt,
    error = "",
    onRetry,
  }: {
    cachedCatalogAt: number | undefined;
    error?: string;
    onRetry: (() => void | Promise<void>) | undefined;
  } = $props();

  const toastScope = $props.id();
  const cachedToastId = `${toastScope}-cached-project-catalog`;
  const errorToastId = `${toastScope}-project-refresh-error`;

  const errorTitle = $derived(
    cachedCatalogAt === undefined
      ? "Projects could not be loaded"
      : "Live project refresh failed",
  );

  $effect(() => {
    if (cachedCatalogAt === undefined || error) {
      toast.dismiss(cachedToastId);
      return;
    }
    toast.info("Showing cached project catalog", {
      id: cachedToastId,
      description: `Last verified ${formatCommunityRelativeTime(Math.floor(cachedCatalogAt / 1_000))}. Live project data is being refreshed from this community's relay.`,
    });
  });

  $effect(() => {
    if (!error) {
      toast.dismiss(errorToastId);
      return;
    }
    toast.error(errorTitle, {
      id: errorToastId,
      description: error,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      ...(onRetry
        ? {
            action: {
              label: "Retry",
              onClick: (event: MouseEvent) => {
                event.preventDefault();
                void retry();
                queueMicrotask(() => {
                  if (error) showErrorToast(error);
                });
              },
            },
          }
        : {}),
    });
  });

  async function retry(): Promise<void> {
    try {
      await onRetry?.();
    } catch (cause) {
      showErrorToast(
        cause instanceof Error ? cause.message : "Projects could not be loaded",
      );
    }
  }

  function showErrorToast(description: string): void {
    toast.error(errorTitle, {
      id: errorToastId,
      description,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: {
        label: "Retry",
        onClick: (event: MouseEvent) => {
          event.preventDefault();
          void retry();
          queueMicrotask(() => {
            if (error) showErrorToast(error);
          });
        },
      },
    });
  }

  onDestroy(() => {
    toast.dismiss(cachedToastId);
    toast.dismiss(errorToastId);
  });
</script>
