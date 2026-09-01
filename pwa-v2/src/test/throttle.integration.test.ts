// Feature: v8-fitnesstracker, throttle integration (Req 6.1, 6.2, 6.3)
//
// Integration test that exercises the REAL Supabase throttle RPCs
// (check_login_gate, record_login_failure, record_login_success) against a
// live project, confirming the in-memory model in throttle.model.ts matches
// server behavior.
//
// SAFETY: this suite is OPT-IN. It only runs when a dedicated *test* Supabase
// project is configured via env vars (VITE_SUPABASE_TEST_URL /
// VITE_SUPABASE_TEST_KEY, or plain SUPABASE_TEST_URL / SUPABASE_TEST_KEY).
// When those are absent, the whole suite is SKIPPED (never failed), so
// `npm run test` passes locally and in CI without a test project or
// credentials. It uses a throwaway identifier and never signs in, so no real
// account is touched; it cleans up by resetting the identifier at the end.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 5

// Resolve test-project credentials from env. Support both Vite-style
// (import.meta.env) and process.env so it works under Node runners too.
function readEnv(...keys: string[]): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  for (const key of keys) {
    const fromVite = viteEnv?.[key]
    if (fromVite && fromVite.trim()) return fromVite.trim()
    const fromNode =
      typeof process !== 'undefined' ? process.env?.[key] : undefined
    if (fromNode && fromNode.trim()) return fromNode.trim()
  }
  return undefined
}

const TEST_URL = readEnv('VITE_SUPABASE_TEST_URL', 'SUPABASE_TEST_URL')
const TEST_KEY = readEnv('VITE_SUPABASE_TEST_KEY', 'SUPABASE_TEST_KEY')

// The suite is enabled only when BOTH the URL and key of a dedicated test
// project are present. Otherwise it is skipped cleanly.
const ENABLED = Boolean(TEST_URL && TEST_KEY)

// A throwaway identifier so we never collide with a real account and cleanup
// is trivial. Randomized to keep parallel/repeat runs independent.
const rand = Math.random().toString(36).slice(2, 10)
const TEST_IDENTIFIER = `test+throttle-${rand}@example.com`

describe.skipIf(!ENABLED)('Throttle RPCs (real Supabase integration)', () => {
  // The client is created lazily in beforeAll (not at collection time) so the
  // describe body can be registered even when the suite is skipped — building
  // the client eagerly would throw when no test URL/key is configured.
  let client: SupabaseClient

  beforeAll(() => {
    // ENABLED guarantees TEST_URL/TEST_KEY exist when this runs.
    client = createClient(TEST_URL as string, TEST_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  afterAll(async () => {
    // Best-effort cleanup: reset the throwaway identifier's throttle state.
    try {
      await client?.rpc('record_login_success', { p_identifier: TEST_IDENTIFIER })
    } catch {
      // ignore cleanup errors
    }
  })

  it('gate → 5 failures lock → success resets, matching the model', async () => {
    // 1. Initial gate check: the throwaway identifier is not blocked.
    const initial = await client.rpc('check_login_gate', {
      p_identifier: TEST_IDENTIFIER,
    })
    expect(initial.error).toBeNull()
    const initialRow = Array.isArray(initial.data) ? initial.data[0] : initial.data
    expect(initialRow.blocked).toBe(false)

    // 2. Record MAX_ATTEMPTS failures; the last one must report blocked with a
    //    future locked_until (Req 6.1, 6.2).
    let lastFailureRow: { blocked: boolean; locked_until: string | null } | undefined
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const res = await client.rpc('record_login_failure', {
        p_identifier: TEST_IDENTIFIER,
      })
      expect(res.error).toBeNull()
      lastFailureRow = Array.isArray(res.data) ? res.data[0] : res.data
    }
    expect(lastFailureRow?.blocked).toBe(true)
    expect(lastFailureRow?.locked_until).not.toBeNull()
    expect(new Date(lastFailureRow!.locked_until as string).getTime()).toBeGreaterThan(
      Date.now()
    )

    // 3. A gate check now reports blocked (Req 6.2, 6.4).
    const blocked = await client.rpc('check_login_gate', {
      p_identifier: TEST_IDENTIFIER,
    })
    expect(blocked.error).toBeNull()
    const blockedRow = Array.isArray(blocked.data) ? blocked.data[0] : blocked.data
    expect(blockedRow.blocked).toBe(true)
    expect(blockedRow.locked_until).not.toBeNull()

    // 4. A successful login resets the counter (Req 6.3), so the next gate
    //    check is not blocked.
    const success = await client.rpc('record_login_success', {
      p_identifier: TEST_IDENTIFIER,
    })
    expect(success.error).toBeNull()

    const afterReset = await client.rpc('check_login_gate', {
      p_identifier: TEST_IDENTIFIER,
    })
    expect(afterReset.error).toBeNull()
    const afterResetRow = Array.isArray(afterReset.data)
      ? afterReset.data[0]
      : afterReset.data
    expect(afterResetRow.blocked).toBe(false)
    expect(afterResetRow.attempts_left).toBe(MAX_ATTEMPTS)
  })
})
