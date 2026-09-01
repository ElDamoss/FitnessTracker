import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { TiltCard } from './TiltCard'

// Unit tests for TiltCard static behavior (Req 1.3, 1.4, 1.5).
// TiltCard must render statically: no 3D mouse-tracking rotation, no
// perspective, and it must not react to mousemove. Hover lift lives in CSS.

const __dirname = dirname(fileURLToPath(import.meta.url))
const indexCssPath = resolve(__dirname, '../index.css')

afterEach(() => {
  cleanup()
})

describe('TiltCard static behavior', () => {
  it('renders content inside a .tilt-card element (Req 1.3)', () => {
    const { getByText } = render(<TiltCard>content</TiltCard>)
    const content = getByText('content')
    const card = content.closest('.tilt-card') as HTMLElement
    expect(card).not.toBeNull()
    expect(card).toBeInTheDocument()
  })

  it('has no rotateX / rotateY / perspective in its inline style (Req 1.3, 1.5)', () => {
    const { getByText } = render(<TiltCard>content</TiltCard>)
    const card = getByText('content').closest('.tilt-card') as HTMLElement
    const inline = card.getAttribute('style') ?? ''
    expect(inline).not.toMatch(/rotateX/i)
    expect(inline).not.toMatch(/rotateY/i)
    expect(inline).not.toMatch(/perspective/i)
    // The transform property itself should not carry a 3D tilt.
    expect(card.style.transform ?? '').toBe('')
  })

  it('does not change its inline style on mousemove (no mouse-tracking) (Req 1.5)', () => {
    const { getByText } = render(<TiltCard>content</TiltCard>)
    const card = getByText('content').closest('.tilt-card') as HTMLElement
    const before = card.getAttribute('style') ?? ''

    fireEvent.mouseMove(card, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(card, { clientX: 200, clientY: 150 })

    const after = card.getAttribute('style') ?? ''
    expect(after).toBe(before)
    expect(after).not.toMatch(/rotate/i)
    expect(after).not.toMatch(/perspective/i)
  })

  it('forwards className and style props without adding tilt transforms', () => {
    const { getByText } = render(
      <TiltCard className="extra" style={{ color: 'red' }}>
        content
      </TiltCard>,
    )
    const card = getByText('content').closest('.tilt-card') as HTMLElement
    expect(card.className).toContain('tilt-card')
    expect(card.className).toContain('extra')
    expect(card.style.color).toBe('red')
    expect(card.style.transform ?? '').toBe('')
  })
})

describe('index.css ported 2.0 design (Req 1.4)', () => {
  const css = readFileSync(indexCssPath, 'utf8')

  it('contains a sporty gradient background', () => {
    // The 2.0 "fond sportif" uses layered gradients on the body backdrop.
    expect(css).toMatch(/radial-gradient|linear-gradient/)
  })

  it('contains a .tilt-card:hover lift rule with translateY(-3px)', () => {
    expect(css).toContain('.tilt-card:hover')
    expect(css).toContain('translateY(-3px)')
  })
})
