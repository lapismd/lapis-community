import { randomBytes } from "node:crypto";

import type { Pool } from "pg";

export interface AuthChallenge {
  token: string;
  actionUrl: string;
  method: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthChallengeStore {
  create(challenge: AuthChallenge): Promise<void>;
  consume(
    token: string,
    actionUrl: string,
    method: string,
    now: string,
  ): Promise<boolean>;
}

export class MemoryAuthChallengeStore implements AuthChallengeStore {
  readonly #challenges = new Map<
    string,
    AuthChallenge & { consumed: boolean }
  >();

  async create(challenge: AuthChallenge): Promise<void> {
    this.#challenges.set(challenge.token, { ...challenge, consumed: false });
  }

  async consume(
    token: string,
    actionUrl: string,
    method: string,
    now: string,
  ): Promise<boolean> {
    const challenge = this.#challenges.get(token);
    if (
      challenge === undefined ||
      challenge.consumed ||
      challenge.actionUrl !== actionUrl ||
      challenge.method !== method ||
      challenge.expiresAt <= now
    ) {
      return false;
    }
    challenge.consumed = true;
    return true;
  }
}

export class PostgresAuthChallengeStore implements AuthChallengeStore {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  async create(challenge: AuthChallenge): Promise<void> {
    await this.#pool.query(
      `INSERT INTO registry_auth_challenges
        (token, action_url, method, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        challenge.token,
        challenge.actionUrl,
        challenge.method,
        challenge.expiresAt,
        challenge.createdAt,
      ],
    );
  }

  async consume(
    token: string,
    actionUrl: string,
    method: string,
    now: string,
  ): Promise<boolean> {
    const result = await this.#pool.query(
      `UPDATE registry_auth_challenges
       SET consumed_at = $4
       WHERE token = $1
         AND action_url = $2
         AND method = $3
         AND consumed_at IS NULL
         AND expires_at > $4
       RETURNING token`,
      [token, actionUrl, method, now],
    );
    return result.rowCount === 1;
  }
}

export function newChallenge(
  actionUrl: string,
  method: string,
  now: Date,
  lifetimeSeconds = 120,
): AuthChallenge {
  return {
    token: randomBytes(32).toString("base64url"),
    actionUrl,
    method,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetimeSeconds * 1_000).toISOString(),
  };
}
