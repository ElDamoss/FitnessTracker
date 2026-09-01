// In-memory model of the server-authoritative brute-force throttle.
//
// This is a faithful, pure-TypeScript reimplementation of the Supabase
// SECURITY DEFINER RPCs defined in the v8-fitnesstracker design document:
//   - public.check_login_gate(p_identifier)
//   - public.record_login_failure(p_identifier)
//   - public.record_login_success(p_identifier)
//
// The real logic lives in Postgres; this model mirrors it exactly so the
// throttle behavior can be validated with property-based tests without a
// live database. Time is injected via a `now()` clock so the 15-minute
// lock window can be tested deterministically.
//
// Feature: v8-fitnesstracker

/** Configured constants — must match the RPC (MAX_ATTEMPTS = 5, 15 min window). */
export const MAX_ATTEMPTS = 5
export const LOCK_WINDOW_MS = 15 * 60 * 1000

/** A single row in the `login_attempts` table. */
export interface LoginAttemptRow {
  identifier: string
  attempt_count: number
  last_attempt_at: number // epoch ms
  locked_until: number | null // epoch ms, null when not locked
}

/** Verdict returned by check_login_gate. */
export interface GateVerdict {
  blocked: boolean
  locked_until: number | null
  attempts_left: number
}

/** Result returned by record_login_failure. */
export interface FailureResult {
  blocked: boolean
  locked_until: number | null
}

/** Injectable clock: returns the current time in epoch milliseconds. */
export type Clock = () => number

/**
 * Normalize an identifier the way the SQL does: lower(trim(p_identifier)).
 */
export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase()
}

/**
 * In-memory store of login_attempts rows, keyed by normalized identifier.
 * Mirrors the single Postgres table plus the three RPCs.
 */
export class ThrottleStore {
  private rows = new Map<string, LoginAttemptRow>()
  private now: Clock

  constructor(now: Clock) {
    this.now = now
  }

  /** Test helper: read the current stored row (undefined when absent). */
  peek(identifier: string): LoginAttemptRow | undefined {
    const row = this.rows.get(normalizeIdentifier(identifier))
    return row ? { ...row } : undefined
  }

  /**
   * check_login_gate: lazily expire an old lock, then report the verdict.
   * Mirrors the RPC exactly (Req 6.2, 6.4, 6.5).
   */
  checkLoginGate(identifier: string): GateVerdict {
    const id = normalizeIdentifier(identifier)
    let row = this.rows.get(id)
    const t = this.now()

    // Lazy lock expiry (Req 6.5): if a lock exists and has elapsed, reset.
    if (
      row !== undefined &&
      row.locked_until !== null &&
      row.locked_until <= t
    ) {
      row = {
        ...row,
        attempt_count: 0,
        locked_until: null,
        last_attempt_at: t,
      }
      this.rows.set(id, row)
    }

    if (row !== undefined && row.locked_until !== null && row.locked_until > t) {
      // Still blocked.
      return { blocked: true, locked_until: row.locked_until, attempts_left: 0 }
    }

    const currentCount = row?.attempt_count ?? 0
    return {
      blocked: false,
      locked_until: null,
      attempts_left: MAX_ATTEMPTS - currentCount,
    }
  }

  /**
   * record_login_failure: increment (upsert) the counter and lock when the
   * threshold is reached (Req 6.1, 6.2).
   */
  recordLoginFailure(identifier: string): FailureResult {
    const id = normalizeIdentifier(identifier)
    const t = this.now()
    const existing = this.rows.get(id)

    // upsert: insert with count 1, or increment on conflict.
    const count = existing ? existing.attempt_count + 1 : 1
    let row: LoginAttemptRow = existing
      ? { ...existing, attempt_count: count, last_attempt_at: t }
      : {
          identifier: id,
          attempt_count: count,
          last_attempt_at: t,
          locked_until: null,
        }
    this.rows.set(id, row)

    if (count >= MAX_ATTEMPTS) {
      const locked = t + LOCK_WINDOW_MS
      row = { ...row, locked_until: locked }
      this.rows.set(id, row)
      return { blocked: true, locked_until: locked }
    }
    return { blocked: false, locked_until: null }
  }

  /**
   * record_login_success: delete the row, resetting the counter (Req 6.3).
   */
  recordLoginSuccess(identifier: string): void {
    this.rows.delete(normalizeIdentifier(identifier))
  }
}
