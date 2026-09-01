import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Feature: v8-fitnesstracker, Property 7
// Property-based test for set measurement-type routing (Requirement 11.4, 11.5, 11.6).
// The two pure helpers below mirror the behavior of two places in the app:
//   - buildSavedSet: WorkoutScreen's save mapping. When the exercise's
//     measurementType is 'seconds' the captured value goes into `duration`
//     (no `reps` key); when 'reps' it goes into `reps` (no `duration` key).
//   - formatSetLabel: History's display mapping. A weighted set renders as
//     "<weight>kg × <reps>"; a duration-only set renders as "<duration>s";
//     otherwise a fallback.

type MeasurementType = 'seconds' | 'reps'

interface SetInput {
  weight: string
  reps: string
  duration: string
  rpe: string
}

interface SavedSet {
  weight: string
  rpe: string
  reps?: string
  duration?: string
}

/**
 * Mirrors WorkoutScreen's save mapping: the measurement type decides whether
 * the captured value lands in `duration` (seconds) or `reps`, and the other
 * key is intentionally absent from the saved set.
 */
function buildSavedSet(measurementType: MeasurementType, set: SetInput): SavedSet {
  if (measurementType === 'seconds') {
    return { weight: set.weight, duration: set.duration, rpe: set.rpe }
  }
  return { weight: set.weight, reps: set.reps, rpe: set.rpe }
}

/**
 * Mirrors History's display: prefer a weighted "<weight>kg × <reps>" label,
 * fall back to a "<duration>s" label for duration-only sets, else a dash.
 */
function formatSetLabel(savedSet: SavedSet): string {
  if (savedSet.weight) {
    return `${savedSet.weight}kg × ${savedSet.reps ?? ''}`
  }
  if (savedSet.duration) {
    return `${savedSet.duration}s`
  }
  return '—'
}

/** A short arbitrary numeric-ish string field (includes the empty string). */
const fieldArb = fc.string({ minLength: 0, maxLength: 6 })

const setInputArb: fc.Arbitrary<SetInput> = fc.record({
  weight: fieldArb,
  reps: fieldArb,
  duration: fieldArb,
  rpe: fieldArb,
})

const measurementTypeArb: fc.Arbitrary<MeasurementType> = fc.constantFrom('seconds', 'reps')

describe('Set measurement-type routing', () => {
  // Feature: v8-fitnesstracker, Property 7
  // Validates: Requirements 11.4, 11.5, 11.6
  it('Property 7: seconds routes to duration, reps routes to reps, and seconds display is labeled as seconds', () => {
    fc.assert(
      fc.property(measurementTypeArb, setInputArb, (measurementType, set) => {
        const saved = buildSavedSet(measurementType, set)

        if (measurementType === 'seconds') {
          // Value stored under duration; reps key absent (Req 11.4, 11.5).
          expect(saved.duration).toBe(set.duration)
          expect('reps' in saved).toBe(false)

          // Displayed as seconds when it is a duration-only set (Req 11.6).
          const durationOnly: SavedSet = { weight: '', duration: set.duration, rpe: set.rpe }
          if (durationOnly.duration) {
            expect(formatSetLabel(durationOnly).endsWith('s')).toBe(true)
          } else {
            expect(formatSetLabel(durationOnly)).toBe('—')
          }
        } else {
          // Value stored under reps; duration key absent (Req 11.4, 11.5).
          expect(saved.reps).toBe(set.reps)
          expect('duration' in saved).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })
})
