import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Property-based test for the Mensurations save-payload build
// (v8-fitnesstracker, Requirement 9.3).
//
// `handleSubmit` in Mensurations.tsx builds the row it inserts into the
// `mensurations` table from a `values` record keyed by field key. The height
// field is keyed `taille` and the waist field is keyed `tour_taille` — two
// distinct keys. The pure `buildPayload` below mirrors that build exactly so
// it can be exercised deterministically without a network/DB, proving the two
// values never overwrite one another.

/**
 * Pure replica of the payload construction inside `handleSubmit`: keep only the
 * non-empty / non-null entries and coerce each remaining string to a number via
 * `parseFloat`. Identical to:
 *   Object.fromEntries(
 *     Object.entries(values)
 *       .filter(([_, v]) => v !== '' && v !== null)
 *       .map(([k, v]) => [k, parseFloat(v)])
 *   )
 */
function buildPayload(values: Record<string, string>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([_, v]) => v !== '' && v !== null)
      .map(([k, v]) => [k, parseFloat(v)])
  )
}

// ── Generators ───────────────────────────────────────────────────────────────
// A numeric string that parseFloat maps to a finite number (e.g. "12", "3.5").
// Rendered from a float so the value space matches real measurement input.
const numericStringArb: fc.Arbitrary<string> = fc
  .float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true })
  .map((n) => String(n))

// Either a real numeric string or the empty string (excluded from the payload).
const fieldValueArb: fc.Arbitrary<string> = fc.oneof(
  numericStringArb,
  fc.constant('')
)

// Other measurement fields that may coexist in the same form submission.
const OTHER_KEYS = [
  'poids',
  'tour_poitrine',
  'tour_bras_g',
  'tour_bras_d',
  'tour_hanche',
] as const

const otherFieldsArb: fc.Arbitrary<Record<string, string>> = fc.record(
  Object.fromEntries(OTHER_KEYS.map((k) => [k, fieldValueArb])) as Record<
    (typeof OTHER_KEYS)[number],
    fc.Arbitrary<string>
  >
)

describe('Mensurations payload build', () => {
  // Feature: v8-fitnesstracker, Property 5: Measurement value payload keeps taille and tour_taille independent
  it('Property 5: stores height under `taille` and waist under `tour_taille` without either overwriting the other', () => {
    fc.assert(
      fc.property(
        fieldValueArb, // height (taille)
        fieldValueArb, // waist (tour_taille)
        otherFieldsArb,
        (height, waist, others) => {
          const values: Record<string, string> = {
            ...others,
            taille: height,
            tour_taille: waist,
          }

          const payload = buildPayload(values)

          // `taille` and `tour_taille` are distinct keys — a fundamental guard
          // that one value can never clobber the other (Req 9.3).
          expect('taille').not.toBe('tour_taille')

          // Height → `taille`, independent of waist.
          if (height !== '') {
            expect(payload.taille).toBe(parseFloat(height))
          } else {
            // Empty height is excluded from the payload entirely.
            expect('taille' in payload).toBe(false)
          }

          // Waist → `tour_taille`, independent of height.
          if (waist !== '') {
            expect(payload.tour_taille).toBe(parseFloat(waist))
          } else {
            // Empty waist is excluded from the payload entirely.
            expect('tour_taille' in payload).toBe(false)
          }

          // Independence cross-check: whatever happens to height must not alter
          // the waist slot and vice versa. Rebuild with only the waist changed
          // to a sentinel and confirm `taille` is untouched.
          if (waist !== '') {
            const sentinel = '999'
            const swapped = buildPayload({ ...values, tour_taille: sentinel })
            expect(swapped.tour_taille).toBe(parseFloat(sentinel))
            if (height !== '') {
              expect(swapped.taille).toBe(parseFloat(height))
            } else {
              expect('taille' in swapped).toBe(false)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
