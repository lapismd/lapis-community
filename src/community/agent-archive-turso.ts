import type { CommunityAgentActivityStore } from "./agent-contracts.js";
import {
  agentArchiveLimit,
  agentArchiveRow,
  agentArchiveScopeKey,
  archiveIdentity,
  archivePage,
  type AgentArchiveRow,
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
  `);
}

export function createTursoAgentActivityStore(
  database: () => AgentArchiveDatabase,
): CommunityAgentActivityStore {
  return {
    async append(scope, records) {
      const rows = records.map((record) => agentArchiveRow(scope, record));
      const statements = rows.flatMap((row) => [
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
            row.record.profile.created_at,
            row.record.profile.id,
            JSON.stringify(row.record.profile),
          ],
        },
      ]);
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
          const agent = archiveIdentity(
            JSON.parse(row.profile_json),
            scope.ownerPubkey,
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
  };
}
