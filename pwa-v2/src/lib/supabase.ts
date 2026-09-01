import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hxlhdgfxusckralcjhbw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bGhkZ2Z4dXNja3JhbGNqaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODkwODAsImV4cCI6MjEwMTE2NTA4MH0.qRDOb_HQbmtHPaDWftiPJ3W67fV2AyFRuCCfFc1nGXQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // sessionStorage is cleared when the browser session ends -> no permanent token (Req 5.1, 5.2, 5.3)
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
