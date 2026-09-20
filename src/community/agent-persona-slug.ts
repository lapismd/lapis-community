export function personaSlugFromName(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replaceAll(/[^a-z0-9_-]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 64) || "agent"
  );
}
