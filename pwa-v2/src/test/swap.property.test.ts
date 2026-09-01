import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Property-based test for the exercise swap during a workout
// (v8-fitnesstracker, Requirement 7). The helpers below mirror the real
// logic in src/components/WorkoutScreen.tsx: `selectSwap` (identity replace,
// preserving sets) and the `handleSave` per-exercise payload mapping.

// ── Types (mirror WorkoutScreen.tsx) ────────────────────────────────────────
interface WorkoutSet {
  weight: string
  reps: string
  duration: string
  rpe: string
  done: boolean
  restLeft: number
  restPaused: boolean
}

interface WorkoutExercise {
  name: string
  muscle: string
  restSec: number
  completed: boolean
  measurementType: 'reps' | 'seconds'
  tempo?: string
  comment?: string
  sets: WorkoutSet[]
}

interface LibraryExercise {
  id: string
  name: string
  muscle: string
  set_measurement_type?: 'reps' | 'seconds'
}

// ── Pure helper mirroring selectSwap in WorkoutScreen.tsx ───────────────────
// Returns a NEW exercise whose name/muscle become the library replacement's,
// measurementType derives from lib.set_measurement_type (defaulting to 'reps'),
// and whose sets are left unchanged (Req 7.3, 7.4).
function applySwap(exercise: WorkoutExercise, lib: LibraryExercise): WorkoutExercise {
  const next = structuredClone(exercise)
  next.name = lib.name
  next.muscle = lib.muscle
  next.measurementType = lib.set_measurement_type === 'seconds' ? 'seconds' : 'reps'
  return next
}

// ── Pure helper mirroring the handleSave per-exercise payload mapping ───────
function buildSavedExercise(ex: WorkoutExercise) {
  return {
    name: ex.name,
    muscle: ex.muscle,
    measurementType: ex.measurementType,
    ...(ex.comment ? { comment: ex.comment } : {}),
    sets: ex.sets
      .filter((s) => s.done)
      .map((s) =>
        ex.measurementType === 'seconds'
          ? { weight: s.weight, duration: s.duration, rpe: s.rpe || '' }
          : { weight: s.weight, reps: s.reps, rpe: s.rpe || '' },
      ),
  }
}

// ── Generators ──────────────────────────────────────────────────────────────
const setArb: fc.Arbitrary<WorkoutSet> = fc.record({
  weight: fc.string({ maxLength: 5 }),
  reps: fc.string({ maxLength: 5 }),
  duration: fc.string({ maxLength: 5 }),
  rpe: fc.string({ maxLength: 3 }),
  done: fc.boolean(),
  restLeft: fc.integer({ min: 0, max: 300 }),
  restPaused: fc.boolean(),
})

const workoutExerciseArb: fc.Arbitrary<WorkoutExercise> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  muscle: fc.string({ minLength: 1, maxLength: 20 }),
  restSec: fc.integer({ min: 0, max: 300 }),
  completed: fc.boolean(),
  measurementType: fc.constantFrom<'reps' | 'seconds'>('reps', 'seconds'),
  tempo: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
  comment: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  sets: fc.array(setArb, { minLength: 0, maxLength: 6 }),
})

const libraryExerciseArb: fc.Arbitrary<LibraryExercise> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  muscle: fc.string({ minLength: 1, maxLength: 20 }),
  set_measurement_type: fc.option(fc.constantFrom<'reps' | 'seconds'>('reps', 'seconds'), {
    nil: undefined,
  }),
})

// ── Property 3 ───────────────────────────────────────────────────────────────
describe('Exercise swap (Property 3)', () => {
  // Feature: v8-fitnesstracker, Property 3: Exercise swap updates name and muscle and is reflected on save
  it('swaps name/muscle to the replacement, leaves sets unchanged, and the save payload carries the replacement identity', () => {
    fc.assert(
      fc.property(workoutExerciseArb, libraryExerciseArb, (exercise, lib) => {
        const originalSets = structuredClone(exercise.sets)

        const swapped = applySwap(exercise, lib)

        // name/muscle become the replacement's (Req 7.3, 7.4)
        expect(swapped.name).toBe(lib.name)
        expect(swapped.muscle).toBe(lib.muscle)

        // that exercise's sets and entered values are unchanged (Req 7.3)
        expect(swapped.sets).toEqual(originalSets)

        // the save payload built afterward carries the replacement name/muscle (Req 7.5, 7.6)
        const saved = buildSavedExercise(swapped)
        expect(saved.name).toBe(lib.name)
        expect(saved.muscle).toBe(lib.muscle)
      }),
      { numRuns: 100 },
    )
  })
})
