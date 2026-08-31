import type {
  NostrEvent,
  NostrEventTemplate,
  RegistryDashboard,
  RegistryIndex,
  RegistryProvenance,
} from "./types.js";

export function normalizeApiBase(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Registry API must use HTTP or HTTPS");
  }
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function endpoint(apiBase: string, path: string): string {
  return new URL(
    path.replace(/^\//u, ""),
    normalizeApiBase(apiBase),
  ).toString();
}

async function readJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      value !== null &&
      typeof value === "object" &&
      "error" in value &&
      value.error !== null &&
      typeof value.error === "object" &&
      "message" in value.error &&
      typeof value.error.message === "string"
        ? value.error.message
        : `Registry request failed with ${response.status}`;
    throw new Error(message);
  }
  return value as T;
}

export async function loadDashboard(
  apiBase: string,
): Promise<RegistryDashboard> {
  const [indexResponse, provenanceResponse] = await Promise.all([
    fetch(endpoint(apiBase, "preview/v1/index.json")),
    fetch(endpoint(apiBase, "preview/v1/provenance.json")),
  ]);
  const [index, provenance] = await Promise.all([
    readJson<RegistryIndex>(indexResponse),
    readJson<RegistryProvenance>(provenanceResponse),
  ]);
  const indexRoot = indexResponse.headers.get("x-lapis-registry-root") ?? "";
  const provenanceRoot =
    provenanceResponse.headers.get("x-lapis-registry-root") ?? "";
  if (
    indexRoot === "" ||
    indexRoot !== provenanceRoot ||
    indexRoot !== provenance.root
  ) {
    throw new Error("Preview index and provenance roots do not match");
  }
  return {
    index,
    provenance,
    unsigned:
      indexResponse.headers.get("x-lapis-registry-unsigned") === "true" &&
      provenanceResponse.headers.get("x-lapis-registry-unsigned") === "true",
    responseRoot: indexRoot,
  };
}

export async function loadSnapshotTemplate(
  apiBase: string,
): Promise<NostrEventTemplate> {
  const response = await fetch(endpoint(apiBase, "preview/snapshot-template"));
  const value = await readJson<{ template: NostrEventTemplate }>(response);
  return value.template;
}

export async function loadChallenge(apiBase: string): Promise<{
  challenge: string;
  action: { url: string; method: string };
}> {
  const response = await fetch(endpoint(apiBase, "auth/challenge"));
  return readJson(response);
}

export async function submitEvent(
  action: { url: string; method: string },
  body: string,
  authorization: string,
): Promise<{ eventId: string; inserted: boolean }> {
  const response = await fetch(action.url, {
    method: action.method,
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body,
  });
  return readJson(response);
}

export function eventBody(event: NostrEvent): string {
  return JSON.stringify({ event });
}
