import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'
import { MannequinPair } from '../components/Mannequin'
import { generateStoryImage } from '../components/StoryExport'

interface SessionData {
  id: string
  date: string
  name: string
  type?: string
  exercises?: Array<{
    name: string
    muscle?: string
    comment?: string
    measurementType?: 'reps' | 'seconds'
    unilateral?: boolean
    sets: Array<{ weight?: string; reps?: string; duration?: string; rpe?: string; weightR?: string; repsR?: string; durationR?: string }>
  }>
  duration?: number
  calories?: number
  user_id: string
  notes?: string
  duration_sec?: number
}

function sesVol(s: SessionData): number {
  let vol = 0
  ;(s.exercises || []).forEach((ex) => {
    ;(ex.sets || []).forEach((st) => {
      vol += (parseFloat(st.weight || '0') || 0) * (parseInt(st.reps || '0') || 0)
    })
  })
  return vol
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1).replace('.0', '')} t`
  return `${vol} kg`
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '—'
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
  }
  return `${minutes} min`
}

// ── Mannequin SVG Data (from V1) ──
const FRONT_PATHS: Record<string, string> = {
  chest_L: 'M272.91 422.84c-18.95-17.19-22-57-12.64-78.79 5.57-12.99 26.54-24.37 39.97-25.87q20.36-2.26 37.02.75c9.74 1.76 16.13 15.64 18.41 25.04 3.99 16.48 3.23 31.38 1.67 48.06q-1.35 14.35-2.05 16.89c-6.52 23.5-38.08 29.23-58.28 24.53-9.12-2.12-17.24-4.38-24.1-10.61z',
  chest_R: 'M416.04 435c-15.12.11-34.46-6.78-41.37-21.48q-1.88-3.99-2.84-12.18c-2.89-24.41-5.9-53.65 8.44-74.79 4.26-6.26 10.49-7.93 18.36-8.56q11.66-.92 23.32-.35c10.58.53 18.02 2.74 26.62 7.87 12.81 7.65 19.73 14.52 22.67 29.75 4.94 25.57.24 64.14-28.21 74.97q-12.26 4.67-26.99 4.77z',
  deltoids_L: 'M274.06 311.69q3.94 2.77 4.33 8.14.04.48-.38.73c-9.98 5.88-24.35 7.45-28.82 19.75-2.31 6.36-.97 17.35-1.43 23.68q-.55 7.51-5.73 14.07-10.37 13.11-13.81 16.67c-3.41 3.53-6.81 1.76-10.69-.47-15.42-8.87-24.95-25.45-22.52-43.22 2.05-14.92 12.71-25.79 24.06-35.02 16.99-13.82 35.58-17.99 54.99-4.33z',
  deltoids_R: 'M450.39 320.75q-.95-.52-.7-1.58c1.57-6.61 5.8-9.1 12.14-11.9 24.99-11.03 43.76 3.33 60.17 20.74 20.73 21.99 11.81 56.44-14.82 68.19-4.41 1.94-6.79-1.03-9.81-4.51-5.81-6.7-13.46-14.12-15.99-22.8-3.93-13.43 4.32-27.54-9.64-37.62q-8.22-5.93-17.99-9.08-1.84-.59-3.36-1.44z',
  biceps_L: 'M189.52 492.51c-2.43.62-7.38.57-7.51-3.08-.56-16.01-.42-35.49 5.11-50.26 3.19-8.54 13.89-30.22 23.27-32.72 10.08-2.68 12.68 16.59 12.6 22.8-.22 15.98-7.51 34.79-15.05 48.71-4.29 7.94-9.95 12.38-18.42 14.55z',
  biceps_R: 'M526.69 486.31c-9.9-8.61-17.75-33.21-20.65-47.73-1.41-7.06-1.34-29.61 8.58-32.16 10.33-2.66 23.81 25.34 26.6 32.91q2.6 7.04 3.6 16.13 1.62 14.66 1.66 32.28c.03 11.04-16.45 1.48-19.79-1.43z',
  quadriceps_L1: 'M292.42 935.6q-.95-.52-1.57-1.4-4.1-5.79-7-13.53-7.8-20.79-13.3-42.33c-9.06-35.53-19.33-71.36-25.03-107.59-5.33-33.86 4-74.19 20.7-103.37q.35-.62.53.07c14.44 55.57 39.03 107.94 41.45 165.34 1.11 26.34.66 52.96-3.6 79.03-.63 3.83-4.73 27.81-12.18 23.78z',
  quadriceps_R1: 'M437.82 933.52c-8.9 14.18-15.15-26.74-15.46-29.25q-5.26-43.04-1.19-86.08c4.9-51.8 26.91-99.32 40.38-150.92q.18-.66.5-.06c17.25 31.67 25.39 68.28 20.54 104.36q-2.29 17.02-8.71 42.76-7.56 30.25-15.2 60.47-6.13 24.25-15.06 47.61-1.83 4.79-5.8 11.11z',
  abs_L1: 'M347.73 429.25c7.46-3.61 10.5 6.27 10.99 11.52.48 5.06 3.46 30.61-2.78 32.93q-4.17 1.55-6.89 3.33-17.56 11.54-35.88 21.46a1.6 1.59-21.9 01-2.3-.98c-2.87-10.41-10.59-43.96 1.66-50.95 11.3-6.45 23.96-11.86 35.2-17.31z',
  abs_R1: 'M371.94 473.31c-5.46-2.59-2.97-24.26-2.77-29.56.25-6.8 2.41-18.63 12.64-13.8q16.26 7.67 32.34 15.72 6.18 3.1 7.13 10.05c.58 4.26 1.35 8.49 1.07 12.72q-.84 12.55-4.33 26.56-.54 2.16-1.1 3.44-.25.58-.81.31c-15.78-7.29-30.79-19.08-44.17-25.44z',
  trapezius_L: 'M285.01 307.01a.89.89 0 01-.11-1.64q19.44-9.61 35.65-24.8 1.68-1.57 3.31-.31.4.32.45.82 1.25 12.61-1.57 25.41c-.74 3.32-2.55 4.23-5.9 4.48q-16.02 1.24-31.83-3.96z',
  trapezius_R: 'M414 311.19c-5.24-.12-7.81-.64-8.9-6.27q-2.33-12.09-1.17-23.94.06-.61.61-.89 1.66-.85 3.65.99 16.12 14.87 33.97 23.63 3.65 1.79-.27 2.89-13.88 3.91-27.89 3.59z',
}

const BACK_PATHS: Record<string, string> = {
  trapezius_L: 'M1071.06 308.94c5.6 4.92 6.96 17.83 7.43 24.88q1.5 22.3.93 44.68-1.2 46.76-5.66 94a.57.56 3.7 01-.59.51q-.68-.03-.94-1.01-4.29-15.9-9.79-25.19c-10.24-17.31-18.8-31.84-25.59-49.4-10.19-26.38-15.6-54.28-26.46-80.58q-3.07-7.43-7.61-14.07-.3-.43.2-.6 12.47-4.28 25.48-4.85c5.54-.25 12.15.86 18.32 1.41 9.7.87 16.77 3.6 24.28 10.22z',
  trapezius_R: 'M1163.98 302.12a.43.43 0 01.22.65q-7.08 10.77-11.41 23.37c-10.53 30.61-17.8 62.94-31.3 91.07-5.11 10.64-15.17 25.22-20.12 36.26q-4.08 9.08-6.59 18.83a.77.77 0 01-1.51-.12q-4.27-45.15-5.52-90.99c-.56-20.28-.74-39.92 2.75-60.43 1.04-6.13 2.77-9.98 7.85-13.85 9.8-7.48 18.02-7.73 30.1-9.11 12.02-1.39 23.92.4 35.53 4.32z',
  deltoids_L: 'M980.66 319.58c.19.14.55.19.65.32a.8.8 0 01-.16 1.15c-6.78 4.75-15.26 9.77-20.03 15.58-6.41 7.78-8.76 16.96-9.44 27.04-.39 5.92-1.68 9.5-5.59 13.43-10.02 10.08-19.04 16.47-31.14 20.41q-.75.25-.75-.55.19-18.4-.09-36.3-.14-9.4 1.07-14.22c4.04-16.07 22.8-33.85 39.68-35.64 9.99-1.06 17.34 2.46 25.8 8.78z',
  deltoids_R: 'M1227.3 316.44c14.62 9.44 25.48 21.03 25.46 39.51q-.02 20.56-.01 41.37a.37.37 0 01-.51.35c-5.08-2.06-10.41-3.98-14.9-6.97-7.84-5.24-21.14-14.95-21.77-24.95-.69-10.75-2.81-20.85-9.76-29.25-4.68-5.65-12.96-10.58-19.6-15.26q-1.23-.87.01-1.71c4.6-3.13 9.91-6.78 15.25-7.98q13.58-3.03 25.83 4.89z',
  upperback_L1: 'M987.06 381.44c-8.48-5.06-14.14-13.28-18.82-22.92q-5.3-10.92-6.46-14.04c-1.49-4.01 35.14-19.22 39.61-20.97q2.75-1.08 4.33-.72c4.33.96 6.61 9.96 7.46 13.7q5.43 23.89 14.65 55.74.78 2.7-.88 4.39c-5.37 5.5-34.69-12.08-39.89-15.18z',
  upperback_R1: 'M1141.45 397.63a2.17 2.14-3.6 01-1.88-1.64q-.71-2.97.18-5.95 8.74-29.19 11.75-43.29c1.73-8.11 3.07-16.77 6.94-22.08 1.92-2.62 4.28-2.27 7.19-1.15q20.52 7.9 39.09 18.77a1.37 1.36 25.9 01.58 1.67c-6.05 15.46-12.98 30.84-28.43 39.45-9.45 5.26-25.83 15.17-35.42 14.22z',
  gluteal_L2: 'M1007.94 762.81c-16.94-16.64-29.37-37.66-31.47-61-2.06-22.84 15.63-34.95 32.18-45.71 8.2-5.33 46.51-27.32 54.37-17.65 5.92 7.29 13.38 15.84 15.44 25.21q3.01 13.63 2.44 27.6-.94 22.59-6.27 44.49c-2.43 9.96-2.9 17.16-2.59 26.75.47 14.83-18.52 17.18-29.12 14.07-6.38-1.87-13.79-4.83-21.35-6.25q-7.39-1.38-13.63-7.51z',
  gluteal_R2: 'M1124.12 776.61c-9.28 2.74-26.75 1.29-28.86-10.88-1.05-6.03.27-14.88-1.3-23.27q-.54-2.94-2.15-9.35c-3.2-12.81-4.02-23.33-5.08-35.27-1.07-12.03-.57-22 1.64-33.17q1.1-5.6 4.19-10.41 8.74-13.58 11.87-16.59c4.96-4.77 15.84.18 21.19 2.11q19.7 7.12 40.17 21.43c9.59 6.7 19.29 14.31 22.93 25.17 4.81 14.37-.65 33.88-7.42 46.87q-7.79 14.97-21.39 28.9-6.74 6.9-15.26 8.36c-7.07 1.21-13.68 4.08-20.53 6.1z',
  hamstring_L3: 'M998.81 761.94q14.07 14.17 20.1 33.62c.98 3.15-.78 9.61-.93 12.91q-1.3 27.63-2.3 55.27c-.55 15.31-1.54 30.27-5.12 45.26q-8.62 36.18-22.76 68.73-3.65 8.41-10.15 17.19-.45.61-.41-.14c.11-1.93.82-4.15.99-5.71q2.45-22.72 6.08-45.26c2.83-17.66 4.18-35.95 4.33-52.37.33-36.43-.75-73.34 1.47-109.68.33-5.32 1.07-16.16 4.7-20.25q.33-.36.81-.45 1.95-.37 3.19.88z',
  hamstring_R1: 'M1183.25 947.53c2.57 14.85 4.32 31.11 6.22 46.14q.35 2.74-1.11.39c-14.67-23.67-23.34-52.15-30.55-79.32q-5.08-19.14-5.97-39.05-1.36-30.37-2.44-60.74c-.22-6.09-2.56-15.63-.55-21.57q5.87-17.35 18.96-31.07c10.77-11.28 10.17 46.55 10.16 48.97-.13 41.09-.45 74.18 1.91 110.07.57 8.75 1.88 17.53 3.37 26.18z',
}

const MAP_FRONT: Record<string, string[]> = {
  'Pectoraux': ['chest_L','chest_R'],
  'Épaules': ['deltoids_L','deltoids_R'],
  'Biceps': ['biceps_L','biceps_R'],
  'Triceps': [],
  'Abdos': ['abs_L1','abs_R1'],
  'Jambes': ['quadriceps_L1','quadriceps_R1'],
  'Fessiers': [],
  'Dos': ['trapezius_L','trapezius_R']
}

const MAP_BACK: Record<string, string[]> = {
  'Pectoraux': [],
  'Épaules': ['deltoids_L','deltoids_R'],
  'Biceps': [],
  'Triceps': [],
  'Abdos': [],
  'Jambes': ['hamstring_L3','hamstring_R1'],
  'Fessiers': ['gluteal_L2','gluteal_R2'],
  'Dos': ['trapezius_L','trapezius_R','upperback_L1','upperback_R1']
}

function buildAnatomicalSVG(workedMuscles: Record<string, boolean>, isFront: boolean, colors: { accent: string; outline: string; base: string }) {
  const paths = isFront ? FRONT_PATHS : BACK_PATHS
  const map = isFront ? MAP_FRONT : MAP_BACK
  const vb = isFront ? '80 100 580 1300' : '860 100 480 1300'

  let svg = `<svg width="180" height="400" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">`
  Object.keys(paths).forEach(key => {
    let isWorked = false
    Object.keys(map).forEach(muscle => {
      if (workedMuscles[muscle] && map[muscle].indexOf(key) > -1) isWorked = true
    })
    const fill = isWorked ? colors.accent : colors.base
    const stroke = isWorked ? colors.accent : colors.outline
    const op = isWorked ? '0.9' : '0.45'
    svg += `<path d="${paths[key]}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="${op}"/>`
  })
  svg += '</svg>'
  return svg
}

function getThemeColors(theme: string): { accent: string; outline: string; base: string } {
  const palettes: Record<string, { accent: string; outline: string; base: string }> = {
    dark: { accent: '#86f7b4', outline: '#4a6b52', base: '#1e3325' },
    light: { accent: '#2d8f56', outline: '#90b89a', base: '#dfeee3' },
    stitch: { accent: '#4fc3f7', outline: '#3a6080', base: '#152d42' },
    girly: { accent: '#ff6b9d', outline: '#8a3858', base: '#2a1520' },
  }
  return palettes[theme] || palettes.dark
}

function exportSessions(sessions: SessionData[], theme: string) {
  const themeCSS = theme === 'light'
    ? 'body{background:#f4f6f3;color:#141a12;} .accent{color:#2d8f56;} table{border-color:#dde3db;} th{background:#f0f3ef;color:#4a5e47;} td{border-color:#e8ede7;} .day-sep{border-color:#dde3db;}'
    : theme === 'stitch'
    ? 'body{background:#e8f4fd;color:#1a3a5c;} .accent{color:#2196f3;} table{border-color:#a8d4f0;} th{background:#d0e8f8;color:#3d6a8f;} td{border-color:#bde0f5;} .day-sep{border-color:#a8d4f0;}'
    : theme === 'girly'
    ? 'body{background:#fff5f8;color:#4a1942;} .accent{color:#e84b8a;} table{border-color:#ffd1e0;} th{background:#ffe8f0;color:#8b3a7a;} td{border-color:#ffe4ee;} .day-sep{border-color:#ffd1e0;}'
    : 'body{background:#07090a;color:#eef1ec;} .accent{color:#86f7b4;} table{border-color:#1f2921;} th{background:#151b14;color:#92a599;} td{border-color:#171f19;} .day-sep{border-color:#1f2921;}'

  let totalVol = 0
  sessions.forEach(s => {
    ;(s.exercises || []).forEach(ex => {
      ;(ex.sets || []).forEach(st => {
        totalVol += (parseFloat(st.weight || '0') || 0) * (parseInt(st.reps || '0') || 0)
      })
    })
  })

  const workedMuscles: Record<string, boolean> = {}
  sessions.forEach(s => {
    ;(s.exercises || []).forEach(ex => {
      if (ex.muscle) workedMuscles[ex.muscle] = true
    })
  })

  const colors = getThemeColors(theme)
  const mannequinFront = buildAnatomicalSVG(workedMuscles, true, colors)
  const mannequinBack = buildAnatomicalSVG(workedMuscles, false, colors)

  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>`
  html += `<title>Rapport FitnessTracker</title>`
  html += `<style>*{box-sizing:border-box;margin:0;padding:0;}`
  html += `body{font-family:Inter,system-ui,sans-serif;padding:32px;max-width:900px;margin:0 auto;}`
  html += themeCSS
  html += `h1{font-size:24px;margin-bottom:4px;} .sub{font-size:13px;opacity:.6;margin-bottom:24px;}`
  html += `.stats{display:flex;gap:24px;margin-bottom:28px;} .stat{text-align:center;}`
  html += `.stat-val{font-size:28px;font-weight:700;} .stat-label{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;}`
  html += `.day-sep{border:none;border-top:2px solid;margin:28px 0 20px;} .day-title{font-size:18px;font-weight:700;margin-bottom:4px;} .day-meta{font-size:12px;opacity:.6;margin-bottom:14px;}`
  html += `table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;}`
  html += `th{padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;}`
  html += `td{padding:8px 10px;border-top:1px solid;} .ex-title{font-size:14px;font-weight:700;margin:12px 0 6px;}`
  html += `.footer{margin-top:32px;font-size:11px;opacity:.5;text-align:center;}`
  html += `.accent{font-weight:700;}`
  html += `.mannequin-wrap{display:flex;justify-content:center;gap:32px;margin:24px 0 28px;}`
  html += `.mannequin-label{text-align:center;font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.08em;margin-top:8px;}`
  html += `</style></head><body>`
  html += `<h1>Rapport d'entraînement</h1>`
  html += `<div class="sub">${now} · ${sessions.length} séance(s)</div>`
  html += `<div class="stats">`
  html += `<div class="stat"><div class="stat-val accent">${sessions.length}</div><div class="stat-label">Séances</div></div>`
  html += `<div class="stat"><div class="stat-val accent">${formatVolume(totalVol)}</div><div class="stat-label">Volume total</div></div>`
  html += `</div>`

  // Mannequin SVG
  html += `<div class="mannequin-wrap">`
  html += `<div><div style="text-align:center">${mannequinFront}</div><div class="mannequin-label">Face</div></div>`
  html += `<div><div style="text-align:center">${mannequinBack}</div><div class="mannequin-label">Dos</div></div>`
  html += `</div>`

  sessions.forEach((s, idx) => {
    if (idx > 0) html += '<hr class="day-sep"/>'
    const vol = sesVol(s)
    html += `<div class="day-title">${s.name}</div>`
    html += `<div class="day-meta">${new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} · ${formatDuration(s.duration)} · ${formatVolume(vol)}</div>`
    if (s.notes) html += `<div style="font-style:italic;opacity:.7;margin-bottom:12px;font-size:13px;">"${s.notes}"</div>`
    ;(s.exercises || []).forEach(ex => {
      html += `<div class="ex-title">${ex.name}${ex.muscle ? ` <span style="font-size:11px;opacity:.6">(${ex.muscle})</span>` : ''}</div>`
      html += `<table><thead><tr><th>Poids</th><th>Reps</th><th>RPE</th><th>Volume</th></tr></thead><tbody>`
      ;(ex.sets || []).forEach(st => {
        const v = (parseFloat(st.weight || '0') || 0) * (parseInt(st.reps || '0') || 0)
        html += `<tr><td>${st.weight ? st.weight + ' kg' : '—'}</td><td>${st.reps || '—'}</td><td>${st.rpe || '—'}</td><td>${v > 0 ? formatVolume(v) : '—'}</td></tr>`
      })
      html += `</tbody></table>`
    })
  })

  html += `<div class="footer">Généré par FitnessTracker · ${now}</div>`
  html += `</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rapport-fitnesstracker-${new Date().toISOString().split('T')[0]}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function PageHistory() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    setSessions(data || [])
    setLoading(false)
  }

  async function deleteSession(id: string) {
    if (!confirm('Supprimer cette séance ?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleExport() {
    const selected = sessions.filter(s => selectedIds.includes(s.id))
    if (!selected.length) return
    const theme = document.documentElement.getAttribute('data-theme') || 'dark'
    exportSessions(selected, theme)
    setSelectedIds([])
  }

  // Build month options from sessions
  const months = Array.from(new Set(
    sessions.map(s => {
      const d = new Date(s.date)
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
    })
  )).sort().reverse()

  const monthLabels: Record<string, string> = {}
  months.forEach(m => {
    const [year, month] = m.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1)
    monthLabels[m] = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  })

  // Filter sessions
  const filtered = sessions.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    const matchMonth = !monthFilter || (() => {
      const d = new Date(s.date)
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      return key === monthFilter
    })()
    return matchSearch && matchMonth
  })

  const isCardio = (s: SessionData) => s.type === 'cardio'

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-h1 display">Historique</h2>
        </div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-faint)' }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Historique</h2>
      </div>

      {/* Search & filter */}
      <div className="search-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Rechercher…"
          className="search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 14, flex: 1 }}
        />
        <select
          className="select-sm"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
        >
          <option value="">Tous les mois</option>
          {months.map(m => (
            <option key={m} value={m}>{monthLabels[m]}</option>
          ))}
        </select>
      </div>

      {/* Export button */}
      {selectedIds.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            className="btn-primary btn-sm"
            onClick={handleExport}
            style={{ fontSize: 12, padding: '8px 16px' }}
          >
            Exporter {selectedIds.length} séance(s)
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-faint)' }}>
          Aucune séance trouvée
        </div>
      )}

      {filtered.map(s => {
        const d = new Date(s.date)
        const day = d.getDate().toString().padStart(2, '0')
        const month = (d.getMonth() + 1).toString().padStart(2, '0')
        const vol = sesVol(s)
        const exCount = (s.exercises || []).length
        const expanded = expandedId === s.id

        return (
          <div key={s.id}>
            <TiltCard
              style={{ marginBottom: expanded ? 0 : 10, padding: '14px 16px', cursor: 'pointer' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 14 }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 18, height: 18, accentColor: 'var(--neon)', flexShrink: 0, cursor: 'pointer' }}
                />

                {/* Date badge */}
                <div
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  style={{
                    width: 44, height: 44, borderRadius: 10, background: 'var(--bg-raised)', border: '1px solid var(--line)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, lineHeight: 1, flexShrink: 0,
                  }}>
                  <span style={{ fontSize: 16, color: 'var(--neon)' }}>{day}</span>
                  <span style={{ fontSize: 9, color: 'var(--ink-faint)', marginTop: 1 }}>/{month}</span>
                </div>

                {/* Name + info */}
                <div style={{ flex: 1 }} onClick={() => setExpandedId(expanded ? null : s.id)}>
                  <div className="history-name">{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>
                    {isCardio(s)
                      ? `${s.calories || 0} kcal · ${formatDuration(s.duration)}`
                      : `${exCount} exercice${exCount > 1 ? 's' : ''} · ${formatDuration(s.duration)}`
                    }
                  </div>
                </div>

                {/* Volume or calories */}
                <div style={{ textAlign: 'right' }} onClick={() => setExpandedId(expanded ? null : s.id)}>
                  {isCardio(s) ? (
                    <>
                      <div className="session-vol-val">{formatDuration(s.duration)}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>durée</div>
                    </>
                  ) : (
                    <>
                      <div className="session-vol-val">{formatVolume(vol)}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>volume</div>
                    </>
                  )}
                </div>
              </div>

              {/* Delete button row */}
              {expanded && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    className="btn-ghost btn-sm"
                    style={{ color: '#ff5555', fontSize: 11 }}
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </TiltCard>

            {/* Expanded detail */}
            {expanded && (
              <div style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--line)',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
                padding: '12px 16px',
                marginBottom: 10,
              }}>
                {(s.exercises || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Aucun exercice enregistré</div>
                ) : (
                  (s.exercises || []).map((ex, idx) => (
                    <div key={idx} style={{ marginBottom: idx < (s.exercises || []).length - 1 ? 10 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{ex.name}</div>
                      {ex.comment && (
                        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--ink-faint)', marginBottom: 4 }}>
                          {ex.comment}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(ex.sets || []).map((st, si) => (
                          <span key={si} style={{
                            fontSize: 11,
                            background: 'var(--bg)',
                            border: '1px solid var(--line)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            color: 'var(--ink-faint)',
                          }}>
                            {(st.weightR != null && st.weightR !== '') || (st.repsR != null && st.repsR !== '') || (st.durationR != null && st.durationR !== '')
                              ? `G ${st.weight || '0'}kg×${st.duration ? `${st.duration}s` : (st.reps || '?')} · D ${st.weightR || '0'}kg×${st.durationR ? `${st.durationR}s` : (st.repsR || '?')}`
                              : st.weight ? `${st.weight}kg × ${st.reps || '?'}` : st.duration ? `${st.duration}s` : `Set ${si + 1}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                {/* Session notes / comment (Req 12.1, 12.4) */}
                <div style={{ marginTop: (s.exercises || []).length > 0 ? 12 : 0 }}>
                  {s.notes ? (
                    <div style={{
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: 'var(--ink-faint)',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}>
                      <span style={{ fontStyle: 'normal', fontWeight: 600, opacity: 0.7 }}>Commentaire : </span>
                      {s.notes}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--ink-faint)' }}>
                      Aucun commentaire enregistré.
                    </div>
                  )}
                </div>

                {/* Mannequin anatomique */}
                {(s.exercises || []).length > 0 && (() => {
                  const worked: Record<string, boolean> = {}
                  ;(s.exercises || []).forEach((ex) => { if (ex.muscle) worked[ex.muscle] = true })
                  if (Object.keys(worked).length === 0) return null
                  return <MannequinPair workedMuscles={worked} width={120} height={260} />
                })()}

                {/* Story Instagram export */}
                {!isCardio(s) && (s.exercises || []).length > 0 && (
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button
                      className="btn-ghost btn-sm"
                      style={{ fontSize: 11, color: 'var(--neon)' }}
                      onClick={(e) => { e.stopPropagation(); generateStoryImage(s) }}
                    >
                      📸 Story Instagram
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
