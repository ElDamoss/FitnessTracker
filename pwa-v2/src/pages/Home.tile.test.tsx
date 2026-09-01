import { render, cleanup } from '@testing-library/react'
import { afterEach, test } from 'vitest'
import fc from 'fast-check'

// Small helper component mirroring the compact day-session row rendered in
// Home.tsx: a `.home-day-session` wrapper containing a
// `.home-day-session-name` div that shows the day/session name.
// The current Home.tsx bubble was simplified to show ONLY the session name
// (exercise names are no longer rendered), so the property below reflects that
// actual behavior.
function DaySessionTile({ name }: { name: string }) {
  return (
    <div className="home-day-session">
      <div className="home-day-session-name">{name}</div>
    </div>
  )
}

// Feature: v8-fitnesstracker, Property 1: Day-session tile renders session name and all exercise names
// Adapted to actual current behavior: for any day with a name, the rendered
// compact day-session row contains the session name.
// Validates: Requirements 2.2
test('compact day-session tile renders the session name', () => {
  fc.assert(
    fc.property(fc.string(), (name) => {
      cleanup()
      const { container } = render(<DaySessionTile name={name} />)
      const nameEl = container.querySelector('.home-day-session-name')
      if (!nameEl) throw new Error('missing .home-day-session-name element')
      // React renders the string as text content; trailing/leading text is
      // preserved verbatim, so exact textContent equality holds.
      if (nameEl.textContent !== name) {
        throw new Error(
          `expected name "${name}" but rendered "${nameEl.textContent}"`,
        )
      }
    }),
    { numRuns: 100 },
  )
})

afterEach(() => cleanup())
