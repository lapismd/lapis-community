import {
  loadDashboard,
  loadSnapshotTemplate,
  normalizeApiBase,
} from "./api.js";
import { shortHex, summarizeProvenance } from "./model.js";
import { requireNip07, signExactTemplate, submitWithNip98 } from "./nostr.js";
import type {
  NostrEvent,
  NostrEventTemplate,
  RegistryDashboard,
} from "./types.js";

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`Missing console element #${id}`);
  return value as T;
}

const apiForm = element<HTMLFormElement>("api-form");
const apiInput = element<HTMLInputElement>("api-base");
const refreshButton = element<HTMLButtonElement>("refresh");
const connectButton = element<HTMLButtonElement>("connect-signer");
const signerState = element<HTMLElement>("signer-state");
const statusRegion = element<HTMLElement>("status");
const unsignedBadge = element<HTMLElement>("unsigned-badge");
const pluginRows = element<HTMLTableSectionElement>("plugin-rows");
const workflowInput = element<HTMLTextAreaElement>("workflow-event");
const signButton = element<HTMLButtonElement>("sign-template");
const submitButton = element<HTMLButtonElement>("submit-event");
const snapshotButton = element<HTMLButtonElement>("sign-snapshot");

function setStatus(
  message: string,
  tone: "neutral" | "error" | "success" = "neutral",
) {
  statusRegion.textContent = message;
  statusRegion.dataset.tone = tone;
}

function apiBase(): string {
  return normalizeApiBase(apiInput.value);
}

async function busy(
  button: HTMLButtonElement,
  action: () => Promise<void>,
): Promise<void> {
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await action();
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Operation failed",
      "error",
    );
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function setMetric(id: string, value: string, detail: string): void {
  element<HTMLElement>(`${id}-value`).textContent = value;
  element<HTMLElement>(`${id}-detail`).textContent = detail;
}

function renderMap(
  targetId: string,
  values: Record<string, number>,
  emptyLabel: string,
): void {
  const target = element<HTMLUListElement>(targetId);
  target.replaceChildren();
  const entries = Object.entries(values).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length === 0) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = emptyLabel;
    target.append(item);
    return;
  }
  for (const [label, count] of entries) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const value = document.createElement("strong");
    name.textContent = label;
    value.textContent = String(count);
    item.append(name, value);
    target.append(item);
  }
}

function renderDashboard(dashboard: RegistryDashboard): void {
  const summary = summarizeProvenance(dashboard.provenance);
  unsignedBadge.hidden = !dashboard.unsigned;
  setMetric(
    "plugins",
    String(dashboard.index.plugins.length),
    "curated releases",
  );
  setMetric("events", String(summary.accepted), "accepted event IDs");
  setMetric("excluded", String(summary.excluded), "visible by reason below");
  setMetric("issues", String(summary.issues), "materialization diagnostics");
  element<HTMLElement>("registry-root").textContent = dashboard.responseRoot;
  element<HTMLElement>("backend").textContent = dashboard.provenance.backend;
  element<HTMLElement>("generated-at").textContent = new Date(
    dashboard.index.generatedAt,
  ).toLocaleString();

  pluginRows.replaceChildren();
  if (dashboard.index.plugins.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "empty-table";
    cell.textContent = "No approved plugins in this projection yet.";
    row.append(cell);
    pluginRows.append(row);
  }
  for (const plugin of dashboard.index.plugins) {
    const row = document.createElement("tr");
    const identity = document.createElement("td");
    const name = document.createElement("strong");
    const description = document.createElement("small");
    name.textContent = plugin.name;
    description.textContent = plugin.description;
    identity.append(name, description);
    for (const value of [plugin.id, plugin.latestVersion, plugin.status]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    row.prepend(identity);
    pluginRows.append(row);
  }
  renderMap(
    "source-counts",
    dashboard.provenance.sourceCounts,
    "No stored events",
  );
  renderMap(
    "exclusion-counts",
    dashboard.provenance.exclusionCounts,
    "No excluded events",
  );
  const issueList = element<HTMLUListElement>("issue-list");
  issueList.replaceChildren();
  if (dashboard.provenance.issues.length === 0) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "No materialization issues";
    issueList.append(item);
  }
  for (const issue of dashboard.provenance.issues.slice(0, 20)) {
    const item = document.createElement("li");
    item.textContent = `${issue.code} · ${shortHex(issue.eventId, 6)} · ${issue.message}`;
    issueList.append(item);
  }
}

async function refresh(): Promise<void> {
  const base = apiBase();
  localStorage.setItem("lapis-registry-api", base);
  setStatus("Loading registry projection…");
  renderDashboard(await loadDashboard(base));
  setStatus("Registry projection and provenance roots match.", "success");
}

function parseTemplate(value: string): NostrEventTemplate {
  const candidate = JSON.parse(value) as Partial<NostrEventTemplate>;
  if (
    !Number.isInteger(candidate.kind) ||
    !Number.isInteger(candidate.created_at) ||
    typeof candidate.content !== "string" ||
    !Array.isArray(candidate.tags) ||
    candidate.tags.some(
      (tag) =>
        !Array.isArray(tag) ||
        tag.length === 0 ||
        tag.some((item) => typeof item !== "string"),
    )
  ) {
    throw new Error("Textarea must contain a Nostr event template");
  }
  return candidate as NostrEventTemplate;
}

function parseEvent(value: string): NostrEvent {
  const candidate = parseTemplate(value) as Partial<NostrEvent>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.pubkey !== "string" ||
    typeof candidate.sig !== "string"
  ) {
    throw new Error("Sign the template before submitting it");
  }
  return candidate as NostrEvent;
}

apiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void busy(refreshButton, refresh);
});

connectButton.addEventListener("click", () => {
  void busy(connectButton, async () => {
    const pubkey = await requireNip07().getPublicKey();
    signerState.textContent = shortHex(pubkey);
    signerState.dataset.connected = "true";
    setStatus(
      "External Nostr signer connected. No key material entered the console.",
      "success",
    );
  });
});

signButton.addEventListener("click", () => {
  void busy(signButton, async () => {
    const signed = await signExactTemplate(
      requireNip07(),
      parseTemplate(workflowInput.value),
    );
    workflowInput.value = JSON.stringify(signed, null, 2);
    setStatus(
      `Signed event ${shortHex(signed.id)}. Review it before submission.`,
      "success",
    );
  });
});

submitButton.addEventListener("click", () => {
  void busy(submitButton, async () => {
    const result = await submitWithNip98(
      apiBase(),
      requireNip07(),
      parseEvent(workflowInput.value),
    );
    setStatus(
      `${result.inserted ? "Stored" : "Already stored"} event ${shortHex(result.eventId)}.`,
      "success",
    );
    await refresh();
  });
});

snapshotButton.addEventListener("click", () => {
  void busy(snapshotButton, async () => {
    const provider = requireNip07();
    const signed = await signExactTemplate(
      provider,
      await loadSnapshotTemplate(apiBase()),
    );
    workflowInput.value = JSON.stringify(signed, null, 2);
    const result = await submitWithNip98(apiBase(), provider, signed);
    setStatus(`Stored snapshot ${shortHex(result.eventId)}.`, "success");
    await refresh();
  });
});

const queryApi = new URL(window.location.href).searchParams.get("api");
apiInput.value =
  queryApi ??
  localStorage.getItem("lapis-registry-api") ??
  "http://127.0.0.1:8787/";
signerState.textContent =
  window.nostr === undefined ? "NIP-07 unavailable" : "Signer available";
void busy(refreshButton, refresh);
