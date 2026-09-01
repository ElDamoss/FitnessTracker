import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Feature: v8-fitnesstracker, Property 8
// Property-based test for session note and per-exercise comment round-trip
// through persistence (Requirement 12.3).
//
// The two pure helpers below mirror WorkoutScreen's save mapping and the
// inverse read:
//   - buildSessionPayload: the session note defaults to '' when falsy, and
//     each exercise carries name/muscle/measurementType/sets. A `comment` key
//     is included only when the exercise actually has a (truthy) comment,
//     otherwise the key is intentionally absent from the saved exercise.
//   - readBack: extracts the session note and each exercise's comment back out
//     of the saved payload.

type MeasurementType = 'seconds' | 'reps'

interface ExerciseInput {
  name: string
  muscle: string
  measurementType: MeasurementType
  comment?: string
  sets: unknown[]
}

interface SavedExercise {
  name: string
  muscle: string
  measurementType: MeasurementType
  comment?: string
  sets: unknown[]
}

interface SessionPayload {
  notes: string
  exercises: SavedExercise[]
}

/**
 * Mirrors WorkoutScreen's save mapping: the session note defaults to '' when
 * falsy, and a per-exercise `comment` key is only emitted when the exercise
 * has a truthy comment.
 */
function buildSessionPayload(note: string | undefined, exercises: ExerciseInput[]): SessionPayload {
  return {
    notes: note || '',
    exercises: exercises.map((ex) => ({
      name: ex.name,
      muscle: ex.muscle,
      measurementType: ex.measurementType,
      ...(ex.comment ? { comment: ex.comment } : {}),
      sets: ex.sets,
    })),
  }
}

/** Inverse read: extract the session note and each exercise's comment. */
function readBack(payload: SessionPayload): { notes: string; comments: (string | undefined)[] } {
  return {
    notes: payload.notes,
    comments: payload.exercises.map((ex) => ex.comment),
  }
}

const textArb = fc.string({ minLength: 0, maxLength: 40 })
const measurementTypeArb: fc.Arbitrary<MeasurementType> = fc.constantFrom('seconds', 'reps')

const exerciseArb: fc.Arbitrary<ExerciseInput> = fc.record({
  name: fc.string({ minLength: 0, maxLength: 20 }),
  muscle: fc.string({ minLength: 0, maxLength: 20 }),
  measurementType: measurementTypeArb,
  comment: fc.option(textArb, { nil: undefined }),
  sets: fc.array(fc.record({ weight: fc.string(), reps: fc.string() }), { maxLength: 4 }),
})

describe('Session and per-exercise comment round-trip', () => {
  // Feature: v8-fitnesstracker, Property 8
  // Validates: Requirements 12.3
  it('Property 8: readBack(buildSessionPayload(note, exercises)) preserves the note and each present comment', () => {
    fc.assert(
      fc.property(
        textArb,
        fc.array(exerciseArb, { maxLength: 6 }),
        (note, exercises) => {
          const payload = buildSessionPayload(note, exercises)
          const result = readBack(payload)

          // Session note is preserved, defaulting to '' when falsy.
          expect(result.notes).toBe(note || '')

          // Each exercise's comment round-trips: a truthy comment stays the
          // same; an absent/falsy comment stays absent (undefined).
          exercises.forEach((ex, i) => {
            if (ex.comment) {
              expect(result.comments[i]).toBe(ex.comment)
              expect('comment' in payload.exercises[i]).toBe(true)
            } else {
              expect(result.comments[i]).toBeUndefined()
              expect('comment' in payload.exercises[i]).toBe(false)
            }
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})
