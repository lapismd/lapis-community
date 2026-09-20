const ENABLED_STORAGE_KEY = "lapis-community:keep-addressed-agents-active";
const AUDIENCES_STORAGE_KEY = "lapis-community:persistent-agent-audiences:v1";
const PUBKEY = /^[0-9a-f]{64}$/u;

const listeners = new Set<() => void>();
let generation = 0;
let enabled = readEnabled();
let audiences = readAudiences();

export interface PersistentAgentAudienceScopeInput {
  ownerPubkey: string;
  channelId: string;
  threadRootId?: string | null;
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function normalizePubkeys(pubkeys: Iterable<string>): string[] {
  return [
    ...new Set(
      [...pubkeys]
        .map((pubkey) => pubkey.trim().toLowerCase())
        .filter((pubkey) => PUBKEY.test(pubkey)),
    ),
  ];
}

function readEnabled(): boolean {
  return storage()?.getItem(ENABLED_STORAGE_KEY) === "1";
}

function readAudiences(): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(
      storage()?.getItem(AUDIENCES_STORAGE_KEY) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, string[]> = {};
    for (const [scope, value] of Object.entries(parsed)) {
      if (scope && Array.isArray(value)) {
        result[scope] = normalizePubkeys(
          value.filter((entry): entry is string => typeof entry === "string"),
        );
      }
    }
    return result;
  } catch {
    return {};
  }
}

function persistEnabled(): void {
  try {
    storage()?.setItem(ENABLED_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Preference persistence is best-effort.
  }
}

function persistAudiences(): void {
  try {
    storage()?.setItem(AUDIENCES_STORAGE_KEY, JSON.stringify(audiences));
  } catch {
    // Audience persistence is best-effort.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getPersistentAgentAudienceScope({
  ownerPubkey,
  channelId,
  threadRootId = null,
}: PersistentAgentAudienceScopeInput): string | null {
  const owner = ownerPubkey.trim().toLowerCase();
  if (!PUBKEY.test(owner) || !channelId || !threadRootId) return null;
  return `${owner}:${channelId}:thread:${threadRootId}`;
}

export function getPersistentAgentAudienceEnabled(): boolean {
  return enabled;
}

export function getPersistentAgentAudienceGeneration(): number {
  return generation;
}

export function getPersistentAgentAudience(scope: string | null): string[] {
  return scope ? [...(audiences[scope] ?? [])] : [];
}

export function setPersistentAgentAudienceEnabled(nextEnabled: boolean): void {
  if (enabled === nextEnabled) return;
  enabled = nextEnabled;
  if (!nextEnabled) {
    generation += 1;
    audiences = {};
    persistAudiences();
  }
  persistEnabled();
  emit();
}

export function setPersistentAgentAudience(
  scope: string,
  pubkeys: Iterable<string>,
): void {
  if (!scope) return;
  const normalized = normalizePubkeys(pubkeys);
  const current = audiences[scope];
  if (
    current !== undefined &&
    current.length === normalized.length &&
    current.every((pubkey, index) => pubkey === normalized[index])
  ) {
    return;
  }
  audiences = { ...audiences, [scope]: normalized };
  persistAudiences();
  emit();
}

export function initializePersistentAgentAudience(
  scope: string | null,
  pubkeys: Iterable<string>,
): void {
  if (!enabled || !scope || Object.hasOwn(audiences, scope)) return;
  setPersistentAgentAudience(scope, pubkeys);
}

export function promotePersistentAgentAudience(
  scope: string | null,
  explicitAgentPubkeys: Iterable<string>,
): void {
  if (!enabled || !scope) return;
  setPersistentAgentAudience(scope, [
    ...normalizePubkeys(explicitAgentPubkeys),
    ...(audiences[scope] ?? []),
  ]);
}

export function addPersistentAgentAudienceMember(
  scope: string | null,
  pubkey: string,
): void {
  if (!scope) return;
  setPersistentAgentAudience(scope, [...(audiences[scope] ?? []), pubkey]);
}

export function removePersistentAgentAudienceMember(
  scope: string | null,
  pubkey: string,
): void {
  if (!scope) return;
  setPersistentAgentAudience(
    scope,
    (audiences[scope] ?? []).filter(
      (candidate) => candidate !== pubkey.trim().toLowerCase(),
    ),
  );
}

export function subscribePersistentAgentAudience(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPersistentAgentAudienceStore(): void {
  generation += 1;
  enabled = false;
  audiences = {};
  try {
    storage()?.removeItem(ENABLED_STORAGE_KEY);
    storage()?.removeItem(AUDIENCES_STORAGE_KEY);
  } catch {
    // Test and shutdown cleanup is best-effort.
  }
  emit();
}
