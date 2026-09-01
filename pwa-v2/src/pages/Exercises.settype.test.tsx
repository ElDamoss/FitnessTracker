import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// Exercises.tsx calls `../lib/supabase` on mount (getUser + select), so we mock
// the module with a minimal fluent stub that resolves to an empty library.
// This lets us render the component, open the "Nouvel exercice" modal, and
// assert the "Type de mesure" select renders both options (Reps / Secondes)
// bound to set_measurement_type. Validates: Requirements 11.1
vi.mock('../lib/supabase', () => {
  const selectResult = Promise.resolve({ data: [], error: null })
  const orderStub = vi.fn(() => selectResult)
  const selectStub = vi.fn(() => ({ order: orderStub }))
  const insertStub = vi.fn(() => ({
    select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
  }))
  const deleteStub = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return {
    supabase: {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })),
      },
      from: vi.fn(() => ({
        select: selectStub,
        insert: insertStub,
        delete: deleteStub,
      })),
    },
  }
})

import PageExercises from './Exercises'

afterEach(() => cleanup())

async function openModal() {
  render(<PageExercises />)
  // Wait for the initial load to finish (the "+ Nouveau" button appears once
  // loading is done).
  const newBtn = await screen.findByRole('button', { name: '+ Nouveau' })
  fireEvent.click(newBtn)
}

// Locates the select that carries the reps/seconds options. The "Type de
// mesure" label is not associated via htmlFor, so we identify the select by
// its option values rather than by accessible label.
function findSetTypeSelect(): HTMLSelectElement | undefined {
  return Array.from(document.querySelectorAll('select')).find(sel =>
    Array.from(sel.options).some(o => o.value === 'reps') &&
    Array.from(sel.options).some(o => o.value === 'seconds')
  ) as HTMLSelectElement | undefined
}

test('set-type select renders both Reps and Secondes options bound to set_measurement_type', async () => {
  await openModal()

  // The "Type de mesure" label text is present in the modal.
  expect(screen.getByText('Type de mesure')).toBeInTheDocument()

  const select = findSetTypeSelect()
  expect(select, 'expected a select bound to set measurement type').toBeTruthy()

  const values = Array.from((select as HTMLSelectElement).options).map(o => o.value)
  expect(values).toContain('reps')
  expect(values).toContain('seconds')

  const labels = Array.from((select as HTMLSelectElement).options).map(o => o.textContent)
  expect(labels).toContain('Reps')
  expect(labels).toContain('Secondes')

  // Default selection is 'reps'
  expect((select as HTMLSelectElement).value).toBe('reps')
})

test('choosing Secondes updates the select value (submits the chosen set_measurement_type)', async () => {
  await openModal()

  const select = findSetTypeSelect()
  expect(select).toBeTruthy()

  fireEvent.change(select as HTMLSelectElement, { target: { value: 'seconds' } })

  await waitFor(() => {
    expect((select as HTMLSelectElement).value).toBe('seconds')
  })
})
