// Feature: v8-fitnesstracker — Task 2.5 (trimmed mobile navigation)
// Requirements: 4.1, 4.2, 4.3, 4.4
//
// App.tsx is guarded by a Supabase auth gate and performs network calls on
// mount, so a full render is neither reliable nor necessary to verify the
// navigation trim. Instead this is a static-source assertion: we read the
// App.tsx source as text and assert the mobile bottom-nav bar was removed
// while the home FAB remains. This directly validates the design decision
// (design.md: "remove the entire mobile-nav bar and keep only the home-fab").

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(here, 'App.tsx'), 'utf8')

describe('App navigation trim (Req 4.1–4.4)', () => {
  it('does not render a mobile-nav bar (Req 4.1, 4.2)', () => {
    // The whole <nav className="mobile-nav"> block must be gone. No JSX
    // element should carry the mobile-nav class in any quote style.
    expect(appSource).not.toMatch(/className\s*=\s*(["'`])mobile-nav\1/)
    expect(appSource).not.toContain('mobile-nav')
  })

  it('keeps the home FAB for navigating to Home (Req 4.3, 4.4)', () => {
    // A button with the home-fab class must remain.
    expect(appSource).toMatch(/className\s*=\s*(["'`])home-fab\1/)
  })

  it('routes the home FAB to the Home page (Req 4.3, 4.4)', () => {
    // The FAB navigates to 'page-home'. Confirm the source wires the click to
    // navigation targeting the home page in the same statement as home-fab.
    const fabRegion = appSource.slice(appSource.indexOf('home-fab'))
    expect(fabRegion).toMatch(/navigate\(\s*(["'`])page-home\1\s*\)/)
  })
})
