import { QueryClient } from "@tanstack/svelte-query";

export const PROJECT_REPOSITORY_READ_STALE_TIME_MS = 30_000;
export const PROJECT_REPOSITORY_READ_GC_TIME_MS =
  typeof window === "undefined" ? Number.POSITIVE_INFINITY : 10 * 60_000;
export const PROJECT_CHANNEL_READ_STALE_TIME_MS = 30_000;

export function createCommunityQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
