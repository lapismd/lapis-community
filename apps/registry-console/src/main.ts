import {
  createBuzzCuratorDecisionTemplate,
  createBuzzReleaseMessageTemplate,
} from "@lapismd/registry-protocol";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";

import { loadConsoleConfig, loadDashboard, parseRelayList } from "./api.js";
import type { ConsoleConfig } from "./api.js";
import { shortHex, summarizeProvenance } from "./model.js";
import {
  publishSignedEvent,
  requireNip07,
  signExactTemplate,
} from "./nostr.js";
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

const relayForm = element<HTMLFormElement>("relay-form");
const relayInput = element<HTMLInputElement>("buzz-relays");
const refreshButton = element<HTMLButtonElement>("refresh");
const connectButton = element<HTMLButtonElement>("connect-signer");
const signerState = element<HTMLElement>("signer-state");
const statusRegion = element<HTMLElement>("status");
const pluginRows = element<HTMLTableSectionElement>("plugin-rows");
const workflowInput = element<HTMLTextAreaElement>("workflow-event");
const signButton = element<HTMLButtonElement>("sign-template");
const submitButton = element<HTMLButtonElement>("submit-event");
const releaseButton = element<HTMLButtonElement>("prepare-release");
const approveButton = element<HTMLButtonElement>("prepare-approval");
const rejectButton = element<HTMLButtonElement>("prepare-rejection");

const readSecret = generateSecretKey();
const readAuth = async (template: NostrEventTemplate): Promise<NostrEvent> =>
  finalizeEvent(template, readSecret);
let baseConfig: ConsoleConfig | undefined;

function setStatus(
  message: string,
  tone: "neutral" | "error" | "success" = "neutral",
): void {
  statusRegion.textContent = message;
  statusRegion.dataset.tone = tone;
}

function currentConfig(): ConsoleConfig {
  if (baseConfig === undefined) {
    throw new Error("Relay configuration has not loaded yet");
  }
  return { ...baseConfig, buzzRelays: parseRelayList(relayInput.value) };
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

function renderMap(values: Record<string, number>): void {
  const target = element<HTMLUListElement>("source-counts");
  target.replaceChildren();
  for (const [label, count] of Object.entries(values).toSorted(
    ([left], [right]) => left.localeCompare(right),
  )) {
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
  setMetric(
    "plugins",
    String(dashboard.index.plugins.length),
    "approved plugins",
  );
  setMetric("events", String(summary.accepted), "trusted event IDs");
  setMetric("releases", String(dashboard.releaseEvents), "kind 9 submissions");
  setMetric("decisions", String(dashboard.decisionEvents), "kind 7 decisions");
  setMetric("issues", String(summary.issues), "ignored or invalid events");
  setMetric(
    "relays",
    String(Object.keys(dashboard.provenance.sourceCounts).length),
    "authenticated Buzz sources",
  );
  element<HTMLElement>("registry-root").textContent = dashboard.provenance.root;
  element<HTMLElement>("backend").textContent = dashboard.provenance.backend;
  element<HTMLElement>("generated-at").textContent = new Date(
    dashboard.index.generatedAt,
  ).toLocaleString();

  pluginRows.replaceChildren();
  for (const plugin of dashboard.index.plugins) {
    const row = document.createElement("tr");
    const identity = document.createElement("td");
    const name = document.createElement("strong");
    const description = document.createElement("small");
    name.textContent = plugin.name;
    description.textContent = plugin.description;
    identity.append(name, description);
    row.append(identity);
    for (const value of [plugin.id, plugin.latestVersion, plugin.status]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    pluginRows.append(row);
  }
  renderMap(dashboard.provenance.sourceCounts);
  const issues = element<HTMLUListElement>("issue-list");
  issues.replaceChildren();
  if (dashboard.provenance.issues.length === 0) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "No materialization issues";
    issues.append(item);
  }
  for (const issue of dashboard.provenance.issues.slice(0, 20)) {
    const item = document.createElement("li");
    item.textContent = `${issue.code} · ${shortHex(issue.eventId, 6)} · ${issue.message}`;
    issues.append(item);
  }
}

async function refresh(): Promise<void> {
  const config = currentConfig();
  localStorage.setItem(
    "lapis-registry-buzz-relays",
    config.buzzRelays.join(","),
  );
  setStatus("Authenticating a read session and materializing Buzz events…");
  renderDashboard(await loadDashboard(config, readAuth));
  setStatus("Buzz events and trusted curator decisions verify.", "success");
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
    throw new Error("Sign the template before publishing it");
  }
  return candidate as NostrEvent;
}

function requiredInput(id: string, label: string): string {
  const value = element<HTMLInputElement>(id).value.trim();
  if (value === "") throw new Error(`${label} is required`);
  return value;
}

function prepareRelease(): void {
  const pluginId = requiredInput("plugin-id", "Plugin ID");
  const sha256 = requiredInput("manifest-sha", "Manifest SHA-256");
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new Error("Manifest SHA-256 must be 64 lowercase hex characters");
  }
  const size = Number(requiredInput("manifest-size", "Manifest size"));
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new Error("Manifest size must be a positive integer");
  }
  workflowInput.value = JSON.stringify(
    createBuzzReleaseMessageTemplate(
      pluginId,
      {
        url: new URL(requiredInput("manifest-url", "Manifest URL")).toString(),
        mimeType: "application/json",
        sha256,
        size,
        filename: `${pluginId}.manifest.json`,
      },
      Math.floor(Date.now() / 1_000),
      `${pluginId} release submitted for curator review.`,
    ),
    null,
    2,
  );
  setStatus("Prepared a standard kind 9 Buzz release message.", "success");
}

function prepareDecision(decision: "approved" | "rejected"): void {
  const eventId = requiredInput("release-event-id", "Release event ID");
  if (!/^[0-9a-f]{64}$/u.test(eventId)) {
    throw new Error("Release event ID must be 64 lowercase hex characters");
  }
  workflowInput.value = JSON.stringify(
    createBuzzCuratorDecisionTemplate(
      eventId,
      decision,
      Math.floor(Date.now() / 1_000),
    ),
    null,
    2,
  );
  setStatus(`Prepared a standard kind 7 ${decision} decision.`, "success");
}

relayForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void busy(refreshButton, refresh);
});

connectButton.addEventListener("click", () => {
  void busy(connectButton, async () => {
    const pubkey = await requireNip07().getPublicKey();
    signerState.textContent = shortHex(pubkey);
    signerState.dataset.connected = "true";
    setStatus(
      "NIP-07 signer connected; private keys remain external.",
      "success",
    );
  });
});

releaseButton.addEventListener("click", () => {
  try {
    prepareRelease();
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Template failed",
      "error",
    );
  }
});
approveButton.addEventListener("click", () => {
  try {
    prepareDecision("approved");
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Template failed",
      "error",
    );
  }
});
rejectButton.addEventListener("click", () => {
  try {
    prepareDecision("rejected");
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Template failed",
      "error",
    );
  }
});

signButton.addEventListener("click", () => {
  void busy(signButton, async () => {
    const signed = await signExactTemplate(
      requireNip07(),
      parseTemplate(workflowInput.value),
    );
    workflowInput.value = JSON.stringify(signed, null, 2);
    setStatus(`Signed event ${shortHex(signed.id)}.`, "success");
  });
});

submitButton.addEventListener("click", () => {
  void busy(submitButton, async () => {
    const signed = parseEvent(workflowInput.value);
    const result = await publishSignedEvent(
      currentConfig(),
      requireNip07(),
      signed,
    );
    setStatus(
      `Published ${shortHex(signed.id)} to ${result.accepted}/${result.total} Buzz relays.`,
      "success",
    );
    await refresh();
  });
});

signerState.textContent =
  window.nostr === undefined ? "NIP-07 unavailable" : "Signer available";
void busy(refreshButton, async () => {
  baseConfig = await loadConsoleConfig();
  const query = new URL(window.location.href).searchParams;
  relayInput.value =
    query.get("relays") ??
    localStorage.getItem("lapis-registry-buzz-relays") ??
    baseConfig.buzzRelays.join(",");
  await refresh();
});
