import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Feature: v8-fitnesstracker, Property 10
// Property-based test for the program-exercise tempo round-trip
// (Requirements 13.2, 13.3). The helpers below mirror the real persistence
// path in src/pages/Programs.tsx:
//   - saveProgram: the `days` jsonb is serialized to the database. We model
//     the Supabase jsonb column as a JSON.stringify round-trip.
//   - loadProgram: reading the row back is a JSON.parse.
//   - normalizeProgram: the coercion applied in Programs.tsx after load
//     (repsTarget -> String(...), tempo -> tempo ?? '').

interface ProgramExercise {
  id: string
  name: string
  muscle: string
  sets: number
  repsTarget: string
  restSec: number
  tempo?: string
}

interface ProgramDay {
  id: string
  name: string
  weekdays: number[]
  exercises: ProgramExercise[]
}

interface Program {
  id: string
  user_id: string
  name: string
  goal: string
  days: ProgramDay[]
}

// Model the jsonb write: serialize the days payload as it is stored.
function saveProgram(days: ProgramDay[]): string {
  return JSON.stringify(days)
}

// Model the jsonb read: parse the stored payload back.
function loadProgram(stored: string): ProgramDay[] {
  return JSON.parse(stored) as ProgramDay[]
}

// Mirrors normalizeProgram in Programs.tsx (repsTarget -> String, tempo -> ?? '').
function normalizeProgram(p: Program): Program {
  return {
    ...p,
    days: (p.days || []).map((d) => ({
      ...d,
      weekdays: (d.weekdays || []).map(Number),
      exercises: (d.exercises || []).map((ex) => ({
        ...ex,
        repsTarget: ex.repsTarget == null ? '' : String(ex.repsTarget),
        tempo: ex.tempo ?? '',
      })),
    })),
  }
}

// Full save -> load -> normalize cycle, returning the reloaded program.
function roundTrip(program: Program): Program {
  const stored = saveProgram(program.days)
  const reloadedDays = loadProgram(stored)
  return normalizeProgram({ ...program, days: reloadedDays })
}

// Any tempo string, including the empty string.
const tempoArb = fc.string({ minLength: 0, maxLength: 20 })

// A program carrying an arbitrary tempo on its single program exercise.
const programWithTempoArb: fc.Arbitrary<{ program: Program; tempo: string }> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  user_id: fc.string({ minLength: 1, maxLength: 12 }),
  name: fc.string({ maxLength: 20 }),
  goal: fc.string({ maxLength: 20 }),
  tempo: tempoArb,
}).map(({ tempo, ...base }) => ({
  tempo,
  program: {
    ...base,
    days: [
      {
        id: 'day-1',
        name: 'Jour 1',
        weekdays: [0],
        exercises: [
          {
            id: 'ex-1',
            name: 'Développé couché',
            muscle: 'Pectoraux',
            sets: 3,
            repsTarget: '8-12',
            restSec: 90,
            tempo,
          },
        ],
      },
    ],
  },
}))

describe('Program exercise tempo round-trip (Property 10)', () => {
  // Feature: v8-fitnesstracker, Property 10: Program exercise tempo round-trips as free text
  // Validates: Requirements 13.2, 13.3
  it('reloads the exact same tempo value for any tempo string, including empty', () => {
    fc.assert(
      fc.property(programWithTempoArb, ({ program, tempo }) => {
        // A provided string must survive the save+load+normalize cycle identically.
        const reloaded = roundTrip(program)
        expect(reloaded.days[0].exercises[0].tempo).toBe(tempo)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: v8-fitnesstracker, Property 10 (caveat): undefined tempo normalizes to ''
  // Validates: Requirements 13.2, 13.3
  it('normalizes an absent tempo to the empty string after round-trip', () => {
    const program: Program = {
      id: 'p1',
      user_id: 'u1',
      name: 'P',
      goal: 'G',
      days: [
        {
          id: 'day-1',
          name: 'Jour 1',
          weekdays: [0],
          // tempo intentionally omitted (undefined)
          exercises: [{ id: 'ex-1', name: 'Squat', muscle: 'Jambes', sets: 3, repsTarget: '8-12', restSec: 90 }],
        },
      ],
    }
    const reloaded = roundTrip(program)
    expect(reloaded.days[0].exercises[0].tempo).toBe('')
  })
})
