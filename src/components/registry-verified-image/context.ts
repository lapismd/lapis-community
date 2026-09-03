import { getContext, setContext } from "svelte";

import type {
  RegistryImageReference,
  RegistryLoadOptions,
} from "../../registry/index.js";

export type RegistryImageLoader = (
  reference: RegistryImageReference,
  options?: RegistryLoadOptions,
) => Promise<Blob>;

const registryImageLoaderKey = Symbol("lapis.registry.image-loader");

export function provideRegistryImageLoader(
  loader: RegistryImageLoader | undefined,
): void {
  setContext(registryImageLoaderKey, loader);
}

export function registryImageLoader(): RegistryImageLoader | undefined {
  return getContext<RegistryImageLoader | undefined>(registryImageLoaderKey);
}
