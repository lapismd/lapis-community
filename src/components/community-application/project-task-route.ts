import type { CommunityApplicationProjectRoute } from "./navigation.js";

export function taskForProjectRoute<T extends { root: { id: string } }>(
  tasks: readonly T[],
  route: CommunityApplicationProjectRoute | undefined,
  selectedTaskId: string,
): T | undefined {
  const fromHash =
    route?.kind === "repository" && route.surface === "tasks" && route.commitSha
      ? route.commitSha
      : undefined;
  const id = selectedTaskId || fromHash || "";
  return id === "" ? undefined : tasks.find((task) => task.root.id === id);
}
