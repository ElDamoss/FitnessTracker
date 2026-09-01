import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

// Smoke test for Req 5.1, 5.2: the Supabase client must persist the Auth_Session
// in window.sessionStorage (cleared when the browser session ends) rather than
// a permanent store like localStorage.

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'supabase.ts'), 'utf8')

describe('supabase client session storage config', () => {
  it('imports a configured client', () => {
    // Sanity: the module exports a client instance.
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })

  it('configures auth storage as window.sessionStorage (source assertion)', () => {
    // The created client does not reliably expose its storage config publicly,
    // so we assert the client is created with sessionStorage at the source level.
    expect(source).toContain('createClient(')
    expect(source).toContain('storage: window.sessionStorage')
    // It must NOT fall back to localStorage for the auth session.
    expect(source).not.toContain('storage: window.localStorage')
  })
})
