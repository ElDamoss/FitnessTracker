import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  ThrottleStore,
  MAX_ATTEMPTS,
  LOCK_WINDOW_MS,
  normalizeIdentifier,
  type Clock,
} from './throttle.model'

// Property-based tests for the server-authoritative brute-force throttle
// (v8-fitnesstracker, Requirement 6). Each property validates the in-memory
// model against the behavior defined by the Supabase RPCs in design.md.

/** Generator for a plausible email-like identifier (non-empty after trim). */
const identifierArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0)

/** A mutable clock helper for deterministic time control. */
function makeClock(start = 1_700_000_000_000): { clock: Clock; advance: (ms: number) => void; set: (ms: number) => void } {
  let t = start
  return {
    clock: () => t,
    advance: (ms: number) => {
      t += ms
    },
    set: (ms: number) => {
      t = ms
    },
  }
}

describe('Brute-force throttle model', () => {
  // Feature: v8-fitnesstracker, Property 12
  it('Property 12: a failed login increments the attempt counter by exactly one (below threshold)', () => {
    fc.assert(
      fc.property(
        identifierArb,
        // Number of prior failures kept strictly below the threshold so the
        // identifier is never locked before the measured increment.
        fc.integer({ min: 0, max: MAX_ATTEMPTS - 2 }),
        (identifier, priorFailures) => {
          const { clock } = makeClock()
          const store = new ThrottleStore(clock)

          for (let i = 0; i < priorFailures; i++) {
            store.recordLoginFailure(identifier)
          }

          const before = store.peek(identifier)?.attempt_count ?? 0
          store.recordLoginFailure(identifier)
          const after = store.peek(identifier)?.attempt_count ?? 0

          expect(after).toBe(before + 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: v8-fitnesstracker, Property 13
  it('Property 13: reaching the threshold blocks further attempts with locked_until in the future', () => {
    fc.assert(
      fc.property(identifierArb, (identifier) => {
        const { clock } = makeClock()
        const store = new ThrottleStore(clock)

        let lastFailure = { blocked: false, locked_until: null as number | null }
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
          lastFailure = store.recordLoginFailure(identifier)
        }

        // The failure that reaches the threshold reports blocked with a future lock.
        expect(lastFailure.blocked).toBe(true)
        expect(lastFailure.locked_until).not.toBeNull()
        expect(lastFailure.locked_until!).toBe(clock() + LOCK_WINDOW_MS)

        // A subsequent gate check (still within the window) reports blocked.
        const verdict = store.checkLoginGate(identifier)
        expect(verdict.blocked).toBe(true)
        expect(verdict.attempts_left).toBe(0)
        expect(verdict.locked_until).not.toBeNull()
        expect(verdict.locked_until!).toBeGreaterThan(clock())
      }),
      { numRuns: 100 }
    )
  })

  // Feature: v8-fitnesstracker, Property 14
  it('Property 14: a successful login resets the counter so the next gate check is not blocked with full attempts', () => {
    fc.assert(
      fc.property(
        identifierArb,
        // Any failed-attempt count below the lock threshold.
        fc.integer({ min: 0, max: MAX_ATTEMPTS - 1 }),
        (identifier, priorFailures) => {
          const { clock } = makeClock()
          const store = new ThrottleStore(clock)

          for (let i = 0; i < priorFailures; i++) {
            store.recordLoginFailure(identifier)
          }

          store.recordLoginSuccess(identifier)

          const verdict = store.checkLoginGate(identifier)
          expect(verdict.blocked).toBe(false)
          expect(verdict.locked_until).toBeNull()
          expect(verdict.attempts_left).toBe(MAX_ATTEMPTS)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: v8-fitnesstracker, Property 15
  it('Property 15: once now passes locked_until the next gate check is not blocked and reset', () => {
    fc.assert(
      fc.property(
        identifierArb,
        // Extra time advanced beyond the lock window before the gate check.
        fc.integer({ min: 0, max: 60 * 60 * 1000 }),
        (identifier, extraMs) => {
          const { clock, advance } = makeClock()
          const store = new ThrottleStore(clock)

          // Lock the identifier by reaching the threshold.
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            store.recordLoginFailure(identifier)
          }

          // While still within the window, it must be blocked.
          expect(store.checkLoginGate(identifier).blocked).toBe(true)

          // Advance the clock past locked_until (window + any extra time).
          advance(LOCK_WINDOW_MS + extraMs + 1)

          const verdict = store.checkLoginGate(identifier)
          expect(verdict.blocked).toBe(false)
          expect(verdict.locked_until).toBeNull()
          expect(verdict.attempts_left).toBe(MAX_ATTEMPTS)

          // The stored row is reset: counter back to zero, no lock.
          const row = store.peek(identifier)
          expect(row?.attempt_count ?? 0).toBe(0)
          expect(row?.locked_until ?? null).toBeNull()

          // Sanity: normalization is applied consistently.
          expect(normalizeIdentifier(identifier)).toBe(identifier.trim().toLowerCase())
        }
      ),
      { numRuns: 100 }
    )
  })
})
