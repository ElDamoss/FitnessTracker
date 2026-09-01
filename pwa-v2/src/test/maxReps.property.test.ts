import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Feature: v8-fitnesstracker, Property 6
// Property-based test for the Progress page max single-set reps metric
// (Requirement 10.1, 10.2, 10.3).
//
// Stats.tsx computes the repetition metric for the selected exercise as the
// MAXIMUM reps recorded in any single set across the period — never a sum.
// The relevant source loop is:
//
//   ;(ex.sets || []).forEach(st => {
//     const r = parseInt(st.reps || '0') || 0
//     if (r > maxReps) maxReps = r
//   })
//
// and `maxRepsOverall` takes the max of those per-session maxima. The pure
// helper below mirrors that exactly: across all sessions, for the named
// exercise, take Math.max of parseInt(set.reps) over every one of its sets.

// ── Shapes mirroring sessions.exercises jsonb ────────────────────────────────
interface StatSet {
  weight?: string
  reps?: string
}
interface StatExercise {
  name: string
  muscle?: string
  sets?: StatSet[]
}
interface StatSession {
  date: string
  exercises?: StatExercise[]
}

/**
 * Pure replica of the Stats.tsx reps aggregation: over all sessions, for the
 * exercise recorded under `exerciseName`, return the maximum single-set reps
 * (parseInt of the reps string, defaulting to 0). Never sums across sets.
 * Returns 0 when there is no reps data — matching the source's initial value
 * (Stats renders the "Aucune donnée de répétitions." message when it stays 0).
 */
function maxSingleSetReps(sessions: StatSession[], exerciseName: string): number {
  let maxRepsOverall = 0
  for (const s of sessions ?? []) {
    const ex = (s.exercises ?? []).find(e => e.name === exerciseName)
    if (!ex) continue
    let maxReps = 0
    for (const st of (ex.sets ?? [])) {
      const r = parseInt(st.reps ?? '0') || 0
      if (r > maxReps) maxReps = r
    }
    if (maxReps > maxRepsOverall) maxRepsOverall = maxReps
  }
  return maxRepsOverall
}

// ── Generators ───────────────────────────────────────────────────────────────
const NAME_POOL = ['Développé couché', 'Squat', 'Planche', 'Rowing', 'Curl', 'Gainage']

// Reps stored as numeric strings (matches how the app persists them). Kept
// non-negative and bounded so parseInt gives a clean, comparable integer.
const repsValueArb = fc.integer({ min: 0, max: 200 })
const repsStringArb = repsValueArb.map(n => String(n))

const setArb: fc.Arbitrary<StatSet> = fc.record({
  weight: fc.string({ maxLength: 5 }),
  reps: repsStringArb,
})

const exerciseArb: fc.Arbitrary<StatExercise> = fc.record({
  name: fc.constantFrom(...NAME_POOL),
  muscle: fc.string({ maxLength: 8 }),
  // Several sets per exercise so multi-set cases (sum != max) are exercised.
  sets: fc.array(setArb, { minLength: 1, maxLength: 6 }),
})

const sessionArb: fc.Arbitrary<StatSession> = fc.record({
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01'), noInvalidDate: true })
    .map(d => d.toISOString().slice(0, 10)),
  exercises: fc.array(exerciseArb, { minLength: 1, maxLength: 4 }),
})

const sessionsArb = fc.array(sessionArb, { minLength: 1, maxLength: 8 })
const targetArb = fc.constantFrom(...NAME_POOL)

describe('Progress reps metric — max single-set reps', () => {
  // Feature: v8-fitnesstracker, Property 6: Progress reps metric is the maximum single-set reps over the period
  // Validates: Requirements 10.1, 10.2, 10.3
  it('Property 6: equals the max single-set reps, is >= every set, and never the cross-set sum', () => {
    fc.assert(
      fc.property(sessionsArb, targetArb, (sessions, target) => {
        const metric = maxSingleSetReps(sessions, target)

        // Collect every individual set's reps for the target exercise. Mirror
        // the source's `.find(e => e.name === target)`: it considers only the
        // FIRST exercise entry with that name per session, so the cross-check
        // must scan the same sets the metric was computed from.
        const allReps: number[] = []
        for (const s of sessions) {
          const ex = (s.exercises ?? []).find(e => e.name === target)
          if (!ex) continue
          for (const st of ex.sets ?? []) {
            allReps.push(parseInt(st.reps ?? '0') || 0)
          }
        }

        // (Req 10.1) The metric equals the true maximum single-set reps.
        const trueMax = allReps.length ? Math.max(...allReps) : 0
        expect(metric).toBe(trueMax)

        // (Req 10.1) It is >= every individual set's reps.
        for (const r of allReps) {
          expect(metric).toBeGreaterThanOrEqual(r)
        }

        // (Req 10.2) It is never the sum across sets when more than one nonzero
        // set exists and that sum differs from the max (i.e. a genuine sum).
        const nonzero = allReps.filter(r => r > 0)
        const sum = allReps.reduce((a, b) => a + b, 0)
        if (nonzero.length >= 2 && sum !== trueMax) {
          expect(metric).not.toBe(sum)
        }
      }),
      { numRuns: 100 }
    )
  })
})
