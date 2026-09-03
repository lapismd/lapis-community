const SVELTE_RUNTIME_DIAGNOSTIC = /(?:\[svelte\]|svelte\.dev\/e\/[a-z_]+)/u;

export function isSvelteRuntimeDiagnostic(args: readonly unknown[]): boolean {
  return SVELTE_RUNTIME_DIAGNOSTIC.test(
    args
      .map((value) =>
        typeof value === "string"
          ? value
          : value instanceof Error
            ? (value.stack ?? value.message)
            : "",
      )
      .join(" "),
  );
}

export function installSvelteRuntimeDiagnosticGuard(): () => void {
  const originalWarn = console.warn;
  const originalError = console.error;

  const guard =
    (original: typeof console.warn) =>
    (...args: unknown[]): void => {
      original.apply(console, args);
      if (!isSvelteRuntimeDiagnostic(args)) return;
      const message = args
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .replaceAll("%c", "")
        .trim();
      throw new Error(`Svelte runtime diagnostic: ${message}`);
    };

  console.warn = guard(originalWarn);
  console.error = guard(originalError);

  return () => {
    console.warn = originalWarn;
    console.error = originalError;
  };
}
