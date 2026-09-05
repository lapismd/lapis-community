import { getContext, setContext } from "svelte";

interface RegistryDiscussionIsolationContext {
  setIsolated(isolated: boolean): void;
}

const registryDiscussionIsolationContext = Symbol(
  "registry-discussion-isolation",
);

export function provideRegistryDiscussionIsolation(
  context: RegistryDiscussionIsolationContext,
): void {
  setContext(registryDiscussionIsolationContext, context);
}

export function useRegistryDiscussionIsolation():
  | RegistryDiscussionIsolationContext
  | undefined {
  return getContext<RegistryDiscussionIsolationContext | undefined>(
    registryDiscussionIsolationContext,
  );
}
