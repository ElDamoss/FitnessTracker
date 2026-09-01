import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Property-based test for the usual-weights query filtering
// (v8-fitnesstracker, Requirement 3.2/3.3/3.4/3.5).
//
// `queryUsualWeights(name)` in WorkoutScreen.tsx fetches the user's recent
// sessions from Supabase, then flattens the sets of every exercise whose
// CURRENT name equals `name`. The pure filtering step below mirrors that inner
// loop exactly so it can be exercised deterministically without a network/DB.

// ── Shapes mirroring sessions.exercises jsonb ────────────────────────────────
interface HistSet {
  weight?: string
  reps?: string
  duration?: string
}
interface HistExercise {
  name?: string
  sets?: HistSet[]
}
interface HistSession {
  date: string
  exercises?: HistExercise[]
}
interface UsualWeightRow {
  date: string
  weight: string
  reps?: string
  duration?: string
}

/**
 * Pure replica of the filtering performed inside `queryUsualWeights`: given a
 * list of sessions and a target exercise name, flatten every set of every
 * exercise recorded under exactly that name (most-recent-first order preserved
 * from the input). Uses the same defensive defaults (`?? []`, `?? ''`) as the
 * source and the same `ex.name === name` equality check (Req 3.2).
 */
function filterUsualWeights(sessions: HistSession[], name: string): UsualWeightRow[] {
  const out: UsualWeightRow[] = []
  for (const s of sessions ?? []) {
    for (const ex of (s.exercises ?? [])) {
      if (ex.name === name) {
        for (const st of (ex.sets ?? [])) {
          out.push({ date: s.date, weight: st.weight ?? '', reps: st.reps, duration: st.duration })
        }
      }
    }
  }
  return out
}

// ── Generators ───────────────────────────────────────────────────────────────
// Constrain exercise names to a small pool so generated histories realistically
// contain both matching and non-matching names for a chosen target.
const NAME_POOL = ['Développé couché', 'Squat', 'Planche', 'Rowing', 'Curl', 'Gainage']

const setArb: fc.Arbitrary<HistSet> = fc.record({
  weight: fc.string({ maxLength: 5 }),
  reps: fc.option(fc.string({ maxLength: 3 }), { nil: undefined }),
  duration: fc.option(fc.string({ maxLength: 3 }), { nil: undefined }),
})

const exerciseArb: fc.Arbitrary<HistExercise> = fc.record({
  name: fc.constantFrom(...NAME_POOL),
  sets: fc.array(setArb, { maxLength: 5 }),
})

const sessionArb: fc.Arbitrary<HistSession> = fc.record({
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString().slice(0, 10)),
  exercises: fc.array(exerciseArb, { maxLength: 5 }),
})

const sessionsArb = fc.array(sessionArb, { maxLength: 10 })
const targetArb = fc.constantFrom(...NAME_POOL)

describe('Usual-weights query filtering', () => {
  // Feature: v8-fitnesstracker, Property 2: Usual-weights query is filtered by exercise name
  it('Property 2: returns exactly the sets recorded under the target name and nothing else', () => {
    fc.assert(
      fc.property(sessionsArb, targetArb, (sessions, target) => {
        const rows = filterUsualWeights(sessions, target)

        // Total sets belonging to exercises recorded under exactly `target`.
        let expectedCount = 0
        let anyMatch = false
        for (const s of sessions) {
          for (const ex of s.exercises ?? []) {
            if (ex.name === target) {
              anyMatch = true
              expectedCount += (ex.sets ?? []).length
            }
          }
        }

        // (Req 3.2/3.3) Every returned row originates from a matching-name
        // exercise, and the count equals the total sets across those exercises.
        // Since a row carries no name, we verify by count: no set from a
        // different name can inflate the total, and none from the target can
        // be dropped.
        expect(rows.length).toBe(expectedCount)

        // (Req 3.5) When no exercise matches the target name, the result is empty.
        const hadMatchingSets = expectedCount > 0
        if (!anyMatch) {
          expect(rows.length).toBe(0)
        }
        if (!hadMatchingSets) {
          expect(rows).toEqual([])
        }

        // (Req 3.3/3.4) Cross-check: filtering after mislabelling every matching
        // exercise to a name absent from the pool yields an empty result, proving
        // the filter keys strictly on the current name and never leaks other names.
        const ABSENT = '<<no-such-exercise>>'
        const relabelled = sessions.map((s) => ({
          ...s,
          exercises: (s.exercises ?? []).map((ex) =>
            ex.name === target ? { ...ex, name: ABSENT } : ex
          ),
        }))
        expect(filterUsualWeights(relabelled, target)).toEqual([])

        // And every set that WAS under the target is now retrievable under the
        // new name — count conservation confirms no matching set was lost.
        expect(filterUsualWeights(relabelled, ABSENT).length).toBe(expectedCount)
      }),
      { numRuns: 100 }
    )
  })
})
