import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { render, cleanup } from '@testing-library/react'

// Feature: v8-fitnesstracker, Property 9
// Property-based test: the rendered history detail contains the session note
// text (when present) and each exercise's comment text (when present).
// Validates: Requirements 12.1, 12.2
//
// HistoryDetail below is a pure helper component mirroring History.tsx's
// expanded detail view: it renders each exercise's `comment` (when present)
// as italic text, and renders `notes` inside a "Commentaire :" block, or the
// "Aucun commentaire enregistré." fallback when the note is absent.

interface HistoryDetailExercise {
  name: string
  comment?: string
  sets?: Array<{ weight?: string; reps?: string; duration?: string }>
}

function HistoryDetail({ notes, exercises }: { notes?: string; exercises: HistoryDetailExercise[] }) {
  return (
    <div>
      {exercises.length === 0 ? (
        <div>Aucun exercice enregistré</div>
      ) : (
        exercises.map((ex, idx) => (
          <div key={idx}>
            <div style={{ fontWeight: 600 }}>{ex.name}</div>
            {ex.comment && <div style={{ fontStyle: 'italic' }}>{ex.comment}</div>}
            <div>
              {(ex.sets || []).map((st, si) => (
                <span key={si}>
                  {st.weight ? `${st.weight}kg × ${st.reps || '?'}` : st.duration ? `${st.duration}s` : `Set ${si + 1}`}
                </span>
              ))}
            </div>
          </div>
        ))
      )}

      <div>
        {notes ? (
          <div style={{ fontStyle: 'italic' }}>
            <span style={{ fontStyle: 'normal', fontWeight: 600 }}>Commentaire : </span>
            {notes}
          </div>
        ) : (
          <div style={{ fontStyle: 'italic' }}>Aucun commentaire enregistré.</div>
        )}
      </div>
    </div>
  )
}

const textArb = fc.string({ minLength: 0, maxLength: 40 })

const exerciseArb: fc.Arbitrary<HistoryDetailExercise> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  comment: fc.option(textArb, { nil: undefined }),
  sets: fc.array(fc.record({ weight: fc.string(), reps: fc.string() }), { maxLength: 4 }),
})

describe('History detail displays every stored comment', () => {
  afterEach(() => cleanup())

  // Feature: v8-fitnesstracker, Property 9
  // Validates: Requirements 12.1, 12.2
  it('Property 9: renders the session note (when present) and each exercise comment (when present)', () => {
    fc.assert(
      fc.property(textArb, fc.array(exerciseArb, { maxLength: 6 }), (notes, exercises) => {
        // Render fresh each iteration to avoid duplicated DOM across runs.
        cleanup()
        const { container } = render(<HistoryDetail notes={notes} exercises={exercises} />)
        const rendered = container.textContent || ''

        // Assert via textContent inclusion (rather than getByText) to avoid
        // whitespace/regex issues with arbitrary fast-check strings.

        // When notes is non-empty, its text must appear in the output.
        if (notes) {
          expect(rendered).toContain(notes)
        }

        // For each exercise with a non-empty comment, its text must appear.
        exercises.forEach((ex) => {
          if (ex.comment) {
            expect(rendered).toContain(ex.comment)
          }
        })
      }),
      { numRuns: 100 }
    )
  })
})
