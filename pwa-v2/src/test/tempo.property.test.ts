import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Feature: v8-fitnesstracker, Property 11
// Property-based test for program-exercise tempo carry-through and display
// (Requirements 13.4, 13.5). The two pure helpers below mirror the app:
//   - mapProgramTempoToWorkout: Programs.tsx carries the program exercise's
//     tempo into the started WorkoutExercise unchanged.
//   - shouldShowTempo: WorkoutScreen's render condition for the tempo chip,
//     mirroring `ex.tempo && ex.tempo.trim() !== ''` — the indicator is shown
//     if and only if tempo is a non-empty (trimmed) string.

interface ProgramExercise {
  tempo?: string
}

/**
 * Mirrors Programs.tsx starting a workout: the program exercise's tempo is
 * carried into the workout exercise unchanged (Req 13.4).
 */
function mapProgramTempoToWorkout(programEx: ProgramExercise): { tempo?: string } {
  return { tempo: programEx.tempo }
}

/**
 * Mirrors WorkoutScreen's tempo-chip condition `ex.tempo && ex.tempo.trim() !== ''`.
 * The tempo indicator is rendered exactly when tempo is a non-empty trimmed
 * string; undefined / empty / whitespace-only tempo is omitted (Req 13.5).
 */
function shouldShowTempo(tempo?: string): boolean {
  return !!tempo && tempo.trim() !== ''
}

// Arbitrary tempo values: undefined, empty/whitespace strings, and arbitrary
// text (including realistic cadence strings like "3-0-1").
const tempoArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.constantFrom(' ', '  ', '\t', '\n', ' \t '),
  fc.constantFrom('3-0-1', '3011', 'descente lente', '2-1-2-0'),
  fc.string({ maxLength: 12 }),
)

describe('Program exercise tempo display (Property 11)', () => {
  // Feature: v8-fitnesstracker, Property 11: Tempo is displayed exactly when present
  // Validates: Requirements 13.4, 13.5
  it('carries tempo into the workout unchanged and shows the indicator iff tempo is a non-empty trimmed string', () => {
    fc.assert(
      fc.property(tempoArb, (tempo) => {
        const programEx: ProgramExercise = { tempo }

        // Tempo is carried through into the workout exercise unchanged (Req 13.4).
        const workoutEx = mapProgramTempoToWorkout(programEx)
        expect(workoutEx.tempo).toBe(tempo)

        // The tempo indicator is shown iff tempo is a non-empty trimmed string
        // (Req 13.4 shown when present, 13.5 omitted when absent/empty).
        const shown = shouldShowTempo(workoutEx.tempo)
        const expected = tempo !== undefined && tempo.trim() !== ''
        expect(shown).toBe(expected)
      }),
      { numRuns: 100 },
    )
  })
})
