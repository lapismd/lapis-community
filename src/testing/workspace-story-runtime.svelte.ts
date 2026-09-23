import { onMount, tick } from "svelte";
import {
  createCommunityStoryRuntime,
  type CommunityStoryRuntime,
} from "./community-test-runtime.js";

/** Mount consumers before connecting the asynchronous controller. */
export function createWorkspaceStoryRuntime() {
  let runtime = $state.raw<CommunityStoryRuntime>();
  let error = $state("");
  onMount(() => {
    let active = true;
    let runtimeGeneration = 0;
    const startRuntime = (): void => {
      const currentGeneration = ++runtimeGeneration;
      runtime?.dispose();
      runtime = undefined;
      error = "";
      void createCommunityStoryRuntime()
        .then(async (created) => {
          if (!active || currentGeneration !== runtimeGeneration) {
            created.dispose();
            return;
          }
          runtime = created;
          await tick();
          if (active && currentGeneration === runtimeGeneration)
            created.controller.initialize();
        })
        .catch((cause: unknown) => {
          if (active && currentGeneration === runtimeGeneration) {
            error =
              cause instanceof Error
                ? cause.message
                : "Community story runtime failed";
          }
        });
    };
    window.addEventListener("community-story-backend-change", startRuntime);
    startRuntime();
    return () => {
      active = false;
      runtimeGeneration += 1;
      window.removeEventListener(
        "community-story-backend-change",
        startRuntime,
      );
      runtime?.dispose();
    };
  });

  return {
    get runtime() {
      return runtime;
    },
    get error() {
      return error;
    },
  };
}
