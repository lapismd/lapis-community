export type RegistryBackend = "cache" | "http" | "nostr";

export interface RegistryCache<T> {
  read(): Promise<T | undefined>;
  write(value: T): Promise<void>;
}

export class MemoryRegistryCache<T> implements RegistryCache<T> {
  #value: T | undefined;

  constructor(initial?: T) {
    this.#value = initial;
  }

  async read(): Promise<T | undefined> {
    return this.#value;
  }

  async write(value: T): Promise<void> {
    this.#value = value;
  }
}

export interface BackendFailure {
  backend: RegistryBackend | "cache-write";
  message: string;
}

export interface SelectedRegistry<T> {
  backend: RegistryBackend;
  value: T;
  failures: BackendFailure[];
}

export interface RegistryFallbackOptions<T> {
  loadNostr(): Promise<T>;
  loadHttp(): Promise<T>;
  cache: RegistryCache<T>;
  isComplete(value: T): boolean;
}

export class RegistryFallbackError extends Error {
  readonly failures: BackendFailure[];

  constructor(failures: BackendFailure[]) {
    super(
      "Nostr, HTTP, and cached registry states were unavailable or incomplete",
    );
    this.name = "RegistryFallbackError";
    this.failures = failures;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function selectCompleteRegistry<T>(
  options: RegistryFallbackOptions<T>,
): Promise<SelectedRegistry<T>> {
  const failures: BackendFailure[] = [];

  for (const [backend, load] of [
    ["nostr", options.loadNostr],
    ["http", options.loadHttp],
  ] as const) {
    try {
      const value = await load();
      if (!options.isComplete(value)) {
        failures.push({ backend, message: "Registry state was incomplete" });
        continue;
      }

      try {
        await options.cache.write(value);
      } catch (error) {
        failures.push({ backend: "cache-write", message: message(error) });
      }
      return { backend, value, failures };
    } catch (error) {
      failures.push({ backend, message: message(error) });
    }
  }

  try {
    const value = await options.cache.read();
    if (value === undefined || !options.isComplete(value)) {
      failures.push({
        backend: "cache",
        message: "Registry state was incomplete",
      });
    } else {
      return { backend: "cache", value, failures };
    }
  } catch (error) {
    failures.push({ backend: "cache", message: message(error) });
  }

  throw new RegistryFallbackError(failures);
}
