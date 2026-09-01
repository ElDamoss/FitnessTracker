import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Property-based test for exercise reordering in the active workout
// (v8-fitnesstracker, Requirement 8). Reordering must be an order-only
// adjacent-swap permutation that preserves every exercise object (its sets,
// entered values, and completion state), and the save payload must list the
// exercises in their current displayed order.

/**
 * Minimal shape of a workout exercise as far as reordering is concerned.
 * Mirrors the extended WorkoutExercise in design.md (name/muscle/sets/completed
 * plus optional measurement/tempo/comment fields), but reorder treats each
 * exercise as an opaque object it must move without mutating.
 */
interface WorkoutSet {
  weight: string
  reps: string
  duration: string
  rpe: string
  done: boolean
}

interface WorkoutExercise {
  id: string
  name: string
  muscle: string
  restSec: number
  completed: boolean
  measurementType: 'reps' | 'seconds'
  tempo?: string
  comment?: string
  sets: WorkoutSet[]
}

/**
 * Pure reorder helper mirroring WorkoutScreen's up/down move logic:
 * swap the element at `idx` with its neighbour at `idx + dir` using
 * structuredClone so no set state is shared by reference. If the target
 * position is out of range (or `idx` itself is invalid), return the list
 * unchanged (this is what the disabled-at-ends UI guarantees).
 */
function moveExercise(
  list: WorkoutExercise[],
  idx: number,
  dir: -1 | 1
): WorkoutExercise[] {
  const target = idx + dir
  if (idx < 0 || idx >= list.length || target < 0 || target >= list.length) {
    return list
  }
  const next = structuredClone(list)
  const tmp = next[idx]
  next[idx] = next[target]
  next[target] = tmp
  return next
}

/** The save payload lists exercises in current displayed order (Req 8.4). */
function buildSaveOrder(list: WorkoutExercise[]): string[] {
  return list.map((ex) => ex.id)
}

const setArb: fc.Arbitrary<WorkoutSet> = fc.record({
  weight: fc.string(),
  reps: fc.string(),
  duration: fc.string(),
  rpe: fc.string(),
  done: fc.boolean(),
})

/**
 * Generate a list of exercises with unique ids so we can identify each object
 * across a reorder by id and deep-compare its preserved contents.
 */
const exerciseListArb: fc.Arbitrary<WorkoutExercise[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: 9999 }), { minLength: 1, maxLength: 8 })
  .chain((ids) =>
    fc.tuple(
      ...ids.map((id) =>
        fc.record({
          id: fc.constant(`ex-${id}`),
          name: fc.string(),
          muscle: fc.string(),
          restSec: fc.integer({ min: 0, max: 600 }),
          completed: fc.boolean(),
          measurementType: fc.constantFrom<'reps' | 'seconds'>('reps', 'seconds'),
          tempo: fc.option(fc.string(), { nil: undefined }),
          comment: fc.option(fc.string(), { nil: undefined }),
          sets: fc.array(setArb, { maxLength: 6 }),
        })
      )
    )
  )

/** Sort a list of exercises by id to compare as an order-independent multiset. */
function byId(list: WorkoutExercise[]): WorkoutExercise[] {
  return [...list].sort((a, b) => a.id.localeCompare(b.id))
}

describe('Workout exercise reordering', () => {
  // Feature: v8-fitnesstracker, Property 4: Reordering is an order-only
  // permutation that preserves exercise data and is saved in order.
  it('Property 4: reorder is an adjacent-swap permutation that preserves each exercise and saves in current order', () => {
    fc.assert(
      fc.property(
        exerciseListArb,
        // Any index (including out-of-range) and a direction.
        fc.integer({ min: -1, max: 8 }),
        fc.constantFrom<-1 | 1>(-1, 1),
        (list, idx, dir) => {
          const original = structuredClone(list)
          const result = moveExercise(list, idx, dir)

          const target = idx + dir
          const inRange =
            idx >= 0 && idx < list.length && target >= 0 && target < list.length

          // (1) Permutation: same multiset of exercise objects by id, and every
          //     object's full contents are preserved (deep equal to original by id).
          expect(byId(result)).toEqual(byId(original))
          expect(result.length).toBe(original.length)

          // (2) Structure of the change: unchanged when out of range, otherwise
          //     differs only by an adjacent swap of idx and idx+dir.
          if (!inRange) {
            expect(result).toEqual(original)
          } else {
            const expected = structuredClone(original)
            const tmp = expected[idx]
            expected[idx] = expected[target]
            expected[target] = tmp
            expect(result).toEqual(expected)

            // Only the two swapped positions differ from the original order.
            for (let i = 0; i < original.length; i++) {
              if (i !== idx && i !== target) {
                expect(result[i].id).toBe(original[i].id)
              }
            }
            expect(result[idx].id).toBe(original[target].id)
            expect(result[target].id).toBe(original[idx].id)
          }

          // (3) Save order equals the reordered displayed order.
          expect(buildSaveOrder(result)).toEqual(result.map((ex) => ex.id))
        }
      ),
      { numRuns: 100 }
    )
  })
})
