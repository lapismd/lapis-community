import { loadConsoleConfig, loadDashboard, parseRelayList } from "./api.js";
import type { ConsoleConfig } from "./api.js";
import {
  shortHex,
  summarizeCommunity,
  summarizeProvenance,
  summarizeSecurity,
} from "./model.js";
import {
  loadLiveSnapshotTemplate,
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
const officialRelayInput = element<HTMLInputElement>("official-relays");
const communityRelayInput = element<HTMLInputElement>("community-relays");
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

let baseConfig: ConsoleConfig | undefined;

function currentConfig(): ConsoleConfig {
  if (baseConfig === undefined) {
    throw new Error("Relay configuration has not loaded yet");
  }
  const officialRelays = parseRelayList(officialRelayInput.value);
  const communityRelays = parseRelayList(communityRelayInput.value);
  if (baseConfig.publishQuorum > officialRelays.length) {
    throw new Error(
      `This environment requires ${baseConfig.publishQuorum} official relay acknowledgements`,
    );
  }
  return { ...baseConfig, officialRelays, communityRelays };
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

function renderTextList(
  targetId: string,
  values: Array<{ heading: string; detail: string; tone?: string }>,
  emptyLabel: string,
): void {
  const target = element<HTMLUListElement>(targetId);
  target.replaceChildren();
  if (values.length === 0) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = emptyLabel;
    target.append(item);
    return;
  }
  for (const value of values) {
    const item = document.createElement("li");
    const heading = document.createElement("strong");
    const detail = document.createElement("span");
    heading.textContent = value.heading;
    detail.textContent = value.detail;
    if (value.tone !== undefined) item.dataset.tone = value.tone;
    item.append(heading, detail);
    target.append(item);
  }
}

function renderDashboard(dashboard: RegistryDashboard): void {
  const summary = summarizeProvenance(dashboard.provenance);
  const community = summarizeCommunity(dashboard.community);
  const security = summarizeSecurity(dashboard.security);
  unsignedBadge.hidden = !dashboard.unsigned;
  setMetric(
    "plugins",
    String(dashboard.index.plugins.length),
    "curated releases",
  );
  setMetric("events", String(summary.accepted), "accepted event IDs");
  setMetric("excluded", String(summary.excluded), "visible by reason below");
  setMetric("issues", String(summary.issues), "materialization diagnostics");
  setMetric(
    "ratings",
    String(community.ratings),
    `${community.reviews} reviews · ${community.reports} reports`,
  );
  setMetric(
    "security",
    String(security.warnings + security.blocked),
    `${security.warnings} warnings · ${security.blocked} blocks`,
  );
  element<HTMLElement>("registry-root").textContent = dashboard.responseRoot;
  element<HTMLElement>("community-root").textContent = dashboard.communityRoot;
  element<HTMLElement>("security-root").textContent = dashboard.securityRoot;
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
  renderTextList(
    "rating-list",
    dashboard.community.ratingAggregates.map((rating) => ({
      heading: rating.pluginId,
      detail:
        rating.average === null
          ? `${rating.count} ratings · no average`
          : `${rating.count} ratings · ${rating.average.toFixed(1)} / 5`,
    })),
    "No community ratings",
  );
  renderTextList(
    "community-list",
    [
      ...dashboard.community.reviews.map((review) => ({
        heading: `Review · ${review.pluginId}`,
        detail: `${review.content} · ${shortHex(review.event.id, 6)}`,
      })),
      ...dashboard.community.collections.map((collection) => ({
        heading: `Collection · ${collection.title ?? collection.identifier}`,
        detail: `${collection.pluginIds.length} plugins · ${shortHex(collection.event.id, 6)}`,
      })),
      ...dashboard.community.reports.map((report) => ({
        heading: `Report · ${report.reportTypes.join(", ")}`,
        detail: shortHex(report.event.id, 6),
        tone: "warn",
      })),
      ...dashboard.community.followLists.map((followList) => ({
        heading: "Follow list",
        detail: `${followList.pubkeys.length} publishers · ${shortHex(followList.event.id, 6)}`,
      })),
    ],
    "No reviews, reports, collections, or follows",
  );
  renderTextList(
    "security-list",
    dashboard.security.statuses.map((status) => ({
      heading: `${status.enforcement.toUpperCase()} · ${status.advisory.pluginId}`,
      detail: `${status.advisory.severity} · ${status.advisory.summary}`,
      tone: status.enforcement,
    })),
    "No active security advisories",
  );
}

async function refresh(): Promise<void> {
  const config = currentConfig();
  localStorage.setItem(
    "lapis-registry-official-relays",
    config.officialRelays.join(","),
  );
  localStorage.setItem(
    "lapis-registry-community-relays",
    config.communityRelays.join(","),
  );
  setStatus("Resolving the signed snapshot directly from relays…");
  renderDashboard(await loadDashboard(config));
  setStatus(
    "Relay snapshot, event set, and projection roots verify.",
    "success",
  );
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
      `Signed event ${shortHex(signed.id)}. Review it before publication.`,
      "success",
    );
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
      `Published event ${shortHex(signed.id)} to ${result.accepted}/${result.total} official relays.`,
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
      await loadLiveSnapshotTemplate(currentConfig()),
    );
    workflowInput.value = JSON.stringify(signed, null, 2);
    const result = await publishSignedEvent(currentConfig(), provider, signed);
    setStatus(
      `Published snapshot ${shortHex(signed.id)} to ${result.accepted}/${result.total} official relays.`,
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
  officialRelayInput.value =
    query.get("relays") ??
    localStorage.getItem("lapis-registry-official-relays") ??
    baseConfig.officialRelays.join(",");
  communityRelayInput.value =
    query.get("community") ??
    localStorage.getItem("lapis-registry-community-relays") ??
    baseConfig.communityRelays.join(",");
  await refresh();
});
