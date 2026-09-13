import type {
  CommunityAgentActivityCheckpoint,
  CommunityAgentActivityStore,
} from "./agent-contracts.js";
import {
  agentActivityContextKey,
  agentArchiveLimit,
  agentArchiveIdentityRecord,
  agentArchiveIdentityVersion,
  agentArchiveRow,
  agentArchiveScopeKey,
  archiveIdentity,
  archivePage,
  type AgentArchiveRow,
  validateActivityCheckpoint,
} from "./agent-archive.js";

export interface AgentArchiveDatabase {
  exec(sql: string): Promise<void>;
  all<T extends Record<string, unknown>>(
    sql: string,
    ...args: unknown[]
  ): Promise<T[]>;
  batch(
    statements: Array<{ sql: string; args?: unknown[] }>,
    mode?: string,
  ): Promise<unknown>;
}

export async function initializeAgentArchiveDatabase(
  db: AgentArchiveDatabase,
): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS community_agent_activity (
      archive_key TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL,
      agent_pubkey TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS community_agent_activity_page
      ON community_agent_activity(scope_key, agent_pubkey, created_at, event_id);
    CREATE INDEX IF NOT EXISTS community_agent_activity_scope
      ON community_agent_activity(scope_key, created_at, event_id);
    CREATE TABLE IF NOT EXISTS community_agent_identities (
      scope_key TEXT NOT NULL,
      agent_pubkey TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      PRIMARY KEY (scope_key, agent_pubkey)
    );
    CREATE TABLE IF NOT EXISTS community_agent_activity_sync (
      scope_key TEXT NOT NULL,
      agent_pubkey TEXT NOT NULL,
      context_key TEXT NOT NULL,
      stream_id TEXT,
      offset_value INTEGER NOT NULL,
      not_before INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (scope_key, agent_pubkey, context_key)
    );
    CREATE TABLE IF NOT EXISTS community_agent_activity_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO community_agent_activity_meta(key,value)
      VALUES ('contract-version','1');
    DELETE FROM community_agent_activity
      WHERE (SELECT value FROM community_agent_activity_meta WHERE key='contract-version') <> '2';
    DELETE FROM community_agent_activity_sync
      WHERE (SELECT value FROM community_agent_activity_meta WHERE key='contract-version') <> '2';
    UPDATE community_agent_activity_meta SET value='2'
      WHERE key='contract-version';
  `);
}

export function createTursoAgentActivityStore(
  database: () => AgentArchiveDatabase,
): CommunityAgentActivityStore {
  return {
    async append(scope, records) {
      const rows = records.map((record) => agentArchiveRow(scope, record));
      const statements = archiveStatements(rows);
      if (statements.length) await database().batch(statements, "immediate");
    },
    async page(query) {
      const clauses = ["scope_key = ?"];
      const args: unknown[] = [agentArchiveScopeKey(query.scope)];
      if (query.agentPubkey) {
        clauses.push("agent_pubkey = ?");
        args.push(query.agentPubkey);
      }
      if (query.channelId) {
        clauses.push("channel_id = ?");
        args.push(query.channelId);
      }
      if (query.before) {
        clauses.push("(created_at < ? OR (created_at = ? AND event_id < ?))");
        args.push(
          query.before.createdAt,
          query.before.createdAt,
          query.before.eventId,
        );
      }
      args.push(agentArchiveLimit(query) + 1);
      const rows = await database().all<{
        raw_json: string;
        created_at: number;
        event_id: string;
      }>(
        `SELECT raw_json, created_at, event_id FROM community_agent_activity WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, event_id DESC LIMIT ?`,
        ...args,
      );
      const decoded: AgentArchiveRow[] = rows.map((row) => {
        let record;
        try {
          record = JSON.parse(row.raw_json);
        } catch {
          record = {};
        }
        return {
          key: "",
          scopeKey: "",
          agentPubkey: "",
          channelId: "",
          createdAt: row.created_at,
          eventId: row.event_id,
          record,
        };
      });
      return archivePage(decoded, query);
    },
    async agents(scope) {
      const rows = await database().all<{ profile_json: string }>(
        "SELECT profile_json FROM community_agent_identities WHERE scope_key = ? ORDER BY agent_pubkey",
        agentArchiveScopeKey(scope),
      );
      return rows.flatMap((row) => {
        try {
          const stored = JSON.parse(row.profile_json);
          const identity =
            stored && typeof stored === "object" && "profile" in stored
              ? stored
              : { profile: stored };
          const agent = archiveIdentity(
            identity.profile,
            scope.ownerPubkey,
            scope.relayPubkey,
            identity.instance,
          );
          return agent ? [agent] : [];
        } catch {
          return [];
        }
      });
    },
    async clear(scope, agent) {
      const clause = `scope_key = ?${agent ? " AND agent_pubkey = ?" : ""}`;
      const args = [agentArchiveScopeKey(scope), ...(agent ? [agent] : [])];
      await database().batch(
        [
          { sql: `DELETE FROM community_agent_activity WHERE ${clause}`, args },
          {
            sql: `DELETE FROM community_agent_identities WHERE ${clause}`,
            args,
          },
        ],
        "immediate",
      );
    },
    async checkpoint(scope, agent, context) {
      const rows = await database().all<{
        context_key: string;
        stream_id: string | null;
        offset_value: number;
        not_before: number | null;
        updated_at: number;
      }>(
        `SELECT context_key,stream_id,offset_value,not_before,updated_at
         FROM community_agent_activity_sync
         WHERE scope_key=? AND agent_pubkey=? AND context_key IN (?, '*')`,
        agentArchiveScopeKey(scope),
        agent,
        agentActivityContextKey(context),
      );
      return mergeStoredCheckpoints(rows, agentActivityContextKey(context));
    },
    async commitSyncPage(scope, agent, context, records, checkpoint) {
      const rows = records.map((record) => agentArchiveRow(scope, record));
      if (rows.some((row) => row.agentPubkey !== agent))
        throw new Error("Activity page contains a different agent");
      const next = validateActivityCheckpoint(checkpoint);
      await database().batch(
        [
          ...archiveStatements(rows),
          {
            sql: `INSERT INTO community_agent_activity_sync(scope_key,agent_pubkey,context_key,stream_id,offset_value,not_before,updated_at)
                  VALUES (?,?,?,?,?,?,?)
                  ON CONFLICT(scope_key,agent_pubkey,context_key) DO UPDATE SET
                    stream_id=excluded.stream_id,offset_value=excluded.offset_value,
                    not_before=excluded.not_before,updated_at=excluded.updated_at`,
            args: [
              agentArchiveScopeKey(scope),
              agent,
              agentActivityContextKey(context),
              next.streamId ?? null,
              next.offset,
              next.notBefore ?? null,
              next.updatedAt,
            ],
          },
        ],
        "immediate",
      );
    },
    async suppressBefore(scope, agent, timestamp) {
      await database().batch(
        [
          {
            sql: `INSERT INTO community_agent_activity_sync(scope_key,agent_pubkey,context_key,stream_id,offset_value,not_before,updated_at)
                  VALUES (?,?, '*',NULL,0,?,?)
                  ON CONFLICT(scope_key,agent_pubkey,context_key) DO UPDATE SET
                    not_before=MAX(COALESCE(community_agent_activity_sync.not_before,0),excluded.not_before),
                    updated_at=excluded.updated_at`,
            args: [agentArchiveScopeKey(scope), agent, timestamp, timestamp],
          },
        ],
        "immediate",
      );
    },
  };
}

function archiveStatements(rows: readonly AgentArchiveRow[]) {
  return rows.flatMap((row) => {
    const identity = agentArchiveIdentityRecord(row.record);
    const version = agentArchiveIdentityVersion(identity);
    return [
      {
        sql: "INSERT OR IGNORE INTO community_agent_activity(archive_key, scope_key, agent_pubkey, channel_id, created_at, event_id, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [
          row.key,
          row.scopeKey,
          row.agentPubkey,
          row.channelId,
          row.createdAt,
          row.eventId,
          JSON.stringify(row.record),
        ],
      },
      {
        sql: `INSERT INTO community_agent_identities(scope_key, agent_pubkey, created_at, event_id, profile_json) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(scope_key, agent_pubkey) DO UPDATE SET created_at=excluded.created_at, event_id=excluded.event_id, profile_json=excluded.profile_json
      WHERE excluded.created_at > community_agent_identities.created_at OR (excluded.created_at = community_agent_identities.created_at AND excluded.event_id < community_agent_identities.event_id)`,
        args: [
          row.scopeKey,
          row.agentPubkey,
          version.createdAt,
          version.eventId,
          JSON.stringify(identity),
        ],
      },
    ];
  });
}

function mergeStoredCheckpoints(
  rows: readonly {
    context_key: string;
    stream_id: string | null;
    offset_value: number;
    not_before: number | null;
    updated_at: number;
  }[],
  contextKey: string,
): CommunityAgentActivityCheckpoint | undefined {
  const exact = rows.find((row) => row.context_key === contextKey);
  const suppression = rows.find((row) => row.context_key === "*");
  if (!exact && !suppression) return;
  const row = exact ?? suppression!;
  return {
    ...(row.stream_id ? { streamId: row.stream_id } : {}),
    offset: row.offset_value,
    ...(row.not_before !== null || suppression?.not_before != null
      ? {
          notBefore: Math.max(
            row.not_before ?? 0,
            suppression?.not_before ?? 0,
          ),
        }
      : {}),
    updatedAt: Math.max(row.updated_at, suppression?.updated_at ?? 0),
  };
}
