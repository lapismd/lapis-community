import type { Pool } from "pg";

import type { NostrEvent } from "@lapismd/registry-protocol";

export type RegistryEventSource =
  | "api"
  | "legacy-import"
  | "relay-community"
  | "relay-official";

export interface StoredRegistryEvent {
  event: NostrEvent;
  source: RegistryEventSource;
  receivedAt: string;
}

export interface RegistryEventStore {
  migrate(): Promise<void>;
  put(value: StoredRegistryEvent): Promise<boolean>;
  get(eventId: string): Promise<StoredRegistryEvent | undefined>;
  list(): Promise<StoredRegistryEvent[]>;
}

export const REGISTRY_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS registry_events (
  id text PRIMARY KEY,
  pubkey text NOT NULL,
  created_at bigint NOT NULL,
  kind integer NOT NULL,
  tags jsonb NOT NULL,
  content text NOT NULL,
  sig text NOT NULL,
  source text NOT NULL CHECK (source IN ('api', 'legacy-import', 'relay-community', 'relay-official')),
  received_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS registry_events_kind_created_at_idx
  ON registry_events (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS registry_auth_challenges (
  token text PRIMARY KEY,
  action_url text NOT NULL,
  method text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS registry_auth_challenges_expiry_idx
  ON registry_auth_challenges (expires_at)
  WHERE consumed_at IS NULL;
`;

export class MemoryRegistryEventStore implements RegistryEventStore {
  readonly #events = new Map<string, StoredRegistryEvent>();

  async migrate(): Promise<void> {}

  async put(value: StoredRegistryEvent): Promise<boolean> {
    if (this.#events.has(value.event.id)) return false;
    this.#events.set(value.event.id, structuredClone(value));
    return true;
  }

  async get(eventId: string): Promise<StoredRegistryEvent | undefined> {
    const value = this.#events.get(eventId);
    return value === undefined ? undefined : structuredClone(value);
  }

  async list(): Promise<StoredRegistryEvent[]> {
    return [...this.#events.values()]
      .toSorted(
        (left, right) =>
          left.event.created_at - right.event.created_at ||
          left.event.id.localeCompare(right.event.id),
      )
      .map((value) => structuredClone(value));
  }
}

export class PostgresRegistryEventStore implements RegistryEventStore {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  async migrate(): Promise<void> {
    await this.#pool.query(REGISTRY_MIGRATION_SQL);
  }

  async put(value: StoredRegistryEvent): Promise<boolean> {
    const result = await this.#pool.query(
      `INSERT INTO registry_events
        (id, pubkey, created_at, kind, tags, content, sig, source, received_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        value.event.id,
        value.event.pubkey,
        value.event.created_at,
        value.event.kind,
        JSON.stringify(value.event.tags),
        value.event.content,
        value.event.sig,
        value.source,
        value.receivedAt,
      ],
    );
    return result.rowCount === 1;
  }

  async get(eventId: string): Promise<StoredRegistryEvent | undefined> {
    const result = await this.#pool.query(
      `SELECT id, pubkey, created_at, kind, tags, content, sig, source, received_at
       FROM registry_events WHERE id = $1`,
      [eventId],
    );
    return result.rows[0] === undefined ? undefined : fromRow(result.rows[0]);
  }

  async list(): Promise<StoredRegistryEvent[]> {
    const result = await this.#pool.query(
      `SELECT id, pubkey, created_at, kind, tags, content, sig, source, received_at
       FROM registry_events ORDER BY created_at, id`,
    );
    return result.rows.map(fromRow);
  }
}

function fromRow(row: Record<string, unknown>): StoredRegistryEvent {
  return {
    event: {
      id: String(row.id),
      pubkey: String(row.pubkey),
      created_at: Number(row.created_at),
      kind: Number(row.kind),
      tags: row.tags as string[][],
      content: String(row.content),
      sig: String(row.sig),
    },
    source: row.source as RegistryEventSource,
    receivedAt: new Date(String(row.received_at)).toISOString(),
  };
}
