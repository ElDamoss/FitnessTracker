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

// Normalize a name for case/accent-insensitive comparison
function normName(s?: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// Volume of a single exercise (sum of weight*reps over its sets)
function exVolume(ex: { sets: Array<{ weight?: string; reps?: string }> }): number {
  return (ex.sets || []).reduce((t, st) => t + (parseFloat(st.weight || '0') || 0) * (parseInt(st.reps || '0') || 0), 0)
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
  'Abdominaux': ['abs_L1','abs_R1'],
  'Obliques': [],
  'Lombaires': [],
  'Avant-bras': [],
  'Quadriceps': ['quadriceps_L1','quadriceps_R1'],
  'Ischio-jambiers': [],
  'Mollets': [],
  'Adducteurs': [],
  'Abducteurs': [],
  'Cuisses': ['quadriceps_L1','quadriceps_R1'],
  'Ischios': [],
  'Jambes': ['quadriceps_L1','quadriceps_R1'],
  'Fessiers': [],
  'Grand fessier': [],
  'Moyen fessier': [],
  'Petit fessier': [],
  'Dos': ['trapezius_L','trapezius_R']
}

const MAP_BACK: Record<string, string[]> = {
  'Pectoraux': [],
  'Épaules': ['deltoids_L','deltoids_R'],
  'Biceps': [],
  'Triceps': [],
  'Abdos': [],
  'Abdominaux': [],
  'Obliques': [],
  'Lombaires': [],
  'Avant-bras': [],
  'Quadriceps': [],
  'Ischio-jambiers': ['hamstring_L3','hamstring_R1'],
  'Mollets': [],
  'Adducteurs': [],
  'Abducteurs': ['gluteal_L2'],
  'Cuisses': [],
  'Ischios': ['hamstring_L3','hamstring_R1'],
  'Jambes': ['hamstring_L3','hamstring_R1'],
  'Fessiers': ['gluteal_L2','gluteal_R2'],
  'Grand fessier': ['gluteal_L2','gluteal_R2'],
  'Moyen fessier': ['gluteal_L2','gluteal_R2'],
  'Petit fessier': ['gluteal_L2','gluteal_R2'],
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

  // Find the sets of the same exercise in the most recent session ANTERIOR to `s`.
  // Returns null if no earlier session contains an exercise with the same name.
  function findPrevExerciseSets(s: SessionData, exName: string): Array<{ weight?: string; reps?: string }> | null {
    const target = normName(exName)
    const curTime = new Date(s.date).getTime()
    // sessions are loaded ordered by date desc; filter anterior and sort desc by date
    const anterior = sessions
      .filter(o => o.id !== s.id && new Date(o.date).getTime() < curTime)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    for (const o of anterior) {
      const match = (o.exercises || []).find(ex => normName(ex.name) === target)
      if (match) return match.sets || []
    }
    return null
  }

  // Individual per-session PDF report (auto-printed A4), ported from Figma V8.3 mockup.
  function downloadSession(s: SessionData) {
    const cs = getComputedStyle(document.documentElement)
    const neon     = cs.getPropertyValue('--neon').trim()
    const neonRgb  = cs.getPropertyValue('--neon-rgb').trim()
    const bg       = cs.getPropertyValue('--bg').trim()
    const bgPanel  = cs.getPropertyValue('--bg-panel').trim()
    const inkDim   = cs.getPropertyValue('--ink-dim').trim()
    const ink      = cs.getPropertyValue('--ink').trim()
    const inkFaint = cs.getPropertyValue('--ink-faint').trim()
    const line     = cs.getPropertyValue('--line').trim()
    const themeAttr = document.documentElement.getAttribute('data-theme')
    const isDark   = !themeAttr || themeAttr === '' || themeAttr === 'dark'

    const exercises = s.exercises || []
    const totalVol   = sesVol(s)
    const totalSets  = exercises.reduce((t, ex) => t + (ex.sets || []).length, 0)
    const exVols     = exercises.map(ex => exVolume(ex))
    const maxExVol   = Math.max(...(exVols.length ? exVols : [0]))
    const allWeights = exercises.flatMap(ex => (ex.sets || []).map(st => parseFloat(st.weight || '0') || 0))
    const maxCharge  = allWeights.length ? Math.max(...allWeights) : 0
    const dateStr    = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const printDate  = new Date().toLocaleDateString('fr-FR')

    const logoSvg = `<svg width="56" height="60" viewBox="0 0 64 68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="12" y1="26" x2="52" y2="26" stroke="${neon}" stroke-width=".5" opacity=".3"/>
      <line x1="32" y1="6" x2="32" y2="46" stroke="${neon}" stroke-width=".5" opacity=".3"/>
      <circle cx="32" cy="26" r="20" stroke="${neon}" stroke-width=".8" opacity=".2"/>
      <circle cx="32" cy="26" r="14" stroke="${neon}" stroke-width=".9" opacity=".35"/>
      <circle cx="32" cy="26" r="8" stroke="${neon}" stroke-width="1.1" opacity=".55"/>
      <circle cx="32" cy="26" r="3.5" stroke="${neon}" stroke-width="1" opacity=".7"/>
      <path d="M 32 26 L 41.5 8.2 A 20 20 0 0 1 48.6 14.6 Z" fill="${neon}" opacity=".15"/>
      <line x1="32" y1="26" x2="48" y2="13.5" stroke="${neon}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="48" cy="13.5" r="2.6" fill="${neon}"/>
      <circle cx="48" cy="13.5" r="4.5" fill="${neon}" opacity=".2"/>
      <circle cx="18" cy="18" r="1.6" fill="${neon}" opacity=".6"/>
      <circle cx="32" cy="26" r="2.2" fill="${neon}"/>
      <rect x="4" y="55.5" width="56" height="3" rx="1.5" fill="${neon}" opacity=".9"/>
      <rect x="2" y="45" width="8" height="19" rx="2" fill="${neon}" opacity=".95"/>
      <rect x="54" y="45" width="8" height="19" rx="2" fill="${neon}" opacity=".95"/>
      <rect x="11" y="48.5" width="5" height="12" rx="1.4" fill="${neon}" opacity=".7"/>
      <rect x="48" y="48.5" width="5" height="12" rx="1.4" fill="${neon}" opacity=".7"/>
      <rect x="17" y="51.5" width="3" height="6" rx=".8" fill="${neon}" opacity=".5"/>
      <rect x="44" y="51.5" width="3" height="6" rx=".8" fill="${neon}" opacity=".5"/>
    </svg>`

    // ── Détail des exercices (tableaux de séries) ──
    const exercisesHtml = exercises.map((ex, idx) => {
      const exVol   = exVols[idx]
      const barPct  = maxExVol > 0 ? Math.round((exVol / maxExVol) * 100) : 0
      const setW    = (ex.sets || []).map(st => parseFloat(st.weight || '0') || 0)
      const maxSet  = setW.length ? Math.max(...setW) : 0
      const setsHtml = (ex.sets || []).map((st, i) => {
        const kg   = parseFloat(st.weight || '0') || 0
        const reps = parseInt(st.reps || '0') || 0
        const isTop = kg === maxSet && maxSet > 0
        return `
        <td style="padding:10px 14px;text-align:center;vertical-align:middle;border-right:1px solid ${line}">
          <div style="font-size:9px;color:${inkFaint};text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">S${i + 1}</div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:${isTop ? neon : ink};line-height:1">${kg > 0 ? kg : 'PDC'}<span style="font-size:11px;font-weight:500;color:${inkFaint}">${kg > 0 ? 'kg' : ''}</span></div>
          <div style="font-size:12px;color:${inkDim};margin-top:4px;font-weight:600">${reps}<span style="font-size:10px;font-weight:400;color:${inkFaint}"> reps</span></div>
          ${kg > 0 ? `<div style="margin-top:6px;background:rgba(${neonRgb},0.12);border-radius:4px;padding:3px 6px;font-size:10px;color:${neon};font-weight:700">${kg * reps} kg</div>` : ''}
        </td>`
      }).join('')

      return `
      <div style="margin-bottom:20px;break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(${neonRgb},0.15);border:1px solid rgba(${neonRgb},0.3);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;color:${neon};flex-shrink:0">${idx + 1}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:16px;color:${ink}">${ex.name}</div>
            ${ex.muscle ? `<div style="font-size:11px;color:${neon};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${ex.muscle}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:${neon};line-height:1">${formatVolume(exVol)}</div>
            <div style="font-size:10px;color:${inkFaint};text-transform:uppercase;letter-spacing:.06em">volume</div>
          </div>
        </div>
        <div style="height:4px;background:rgba(${neonRgb},0.1);border-radius:2px;margin-bottom:12px;overflow:hidden">
          <div style="height:100%;width:${barPct}%;background:linear-gradient(90deg,rgba(${neonRgb},0.5),${neon});border-radius:2px"></div>
        </div>
        <div style="border:1px solid ${line};border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <tbody><tr>${setsHtml}</tr></tbody>
          </table>
        </div>
      </div>`
    }).join('')

    // ── Évolution vs séance précédente ──
    const chartData = exercises.map((ex, idx) => {
      const curVol = exVols[idx]
      const prevSets = findPrevExerciseSets(s, ex.name)
      const prevVol = prevSets ? prevSets.reduce((t, st) => t + (parseFloat(st.weight || '0') || 0) * (parseInt(st.reps || '0') || 0), 0) : 0
      return { name: ex.name, curVol, prevVol, hasPrev: prevSets !== null && prevVol > 0 }
    })
    const maxVol = Math.max(...chartData.map(c => Math.max(c.curVol, c.prevVol)), 1)
    const chartRows = chartData.map(c => {
      const delta = c.hasPrev && c.prevVol > 0 ? Math.round(((c.curVol - c.prevVol) / c.prevVol) * 100) : null
      const curW  = Math.round((c.curVol / maxVol) * 260)
      const prevW = c.prevVol > 0 ? Math.round((c.prevVol / maxVol) * 260) : 0
      const deltaColor = delta === null ? inkFaint : delta >= 0 ? neon : '#e05050'
      const deltaStr   = delta === null ? 'N/A' : delta >= 0 ? `+${delta}%` : `${delta}%`
      return `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:150px;flex-shrink:0">
            <div style="font-size:12px;font-weight:700;color:${ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
            <div style="font-size:10px;color:${inkFaint};margin-top:2px">${formatVolume(c.curVol)}</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px">
            ${c.hasPrev ? `<div style="display:flex;align-items:center;gap:6px">
              <div style="width:30px;font-size:9px;color:${inkFaint};text-align:right;flex-shrink:0">Préc.</div>
              <div style="height:10px;background:rgba(${neonRgb},0.15);border-radius:3px;width:${prevW}px;max-width:260px"></div>
              <div style="font-size:10px;color:${inkFaint}">${formatVolume(c.prevVol)}</div>
            </div>` : ''}
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:30px;font-size:9px;color:${neon};text-align:right;flex-shrink:0;font-weight:700">Actuel</div>
              <div style="height:14px;background:linear-gradient(90deg,rgba(${neonRgb},0.6),${neon});border-radius:4px;width:${curW}px;max-width:260px"></div>
              <div style="font-size:11px;font-weight:700;color:${neon}">${formatVolume(c.curVol)}</div>
            </div>
          </div>
          <div style="width:50px;text-align:right;flex-shrink:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;color:${deltaColor};line-height:1">${deltaStr}</div>
          </div>
        </div>`
    }).join('')

    const statsHtml = [
      { label: 'Volume total', val: formatVolume(totalVol), sub: `${totalSets} séries` },
      { label: 'Exercices', val: String(exercises.length), sub: 'groupes musculaires' },
      { label: 'Charge max', val: `${maxCharge} kg`, sub: 'sur la séance' },
    ].map((m, i) => `
      <div style="padding:22px 28px;${i < 2 ? `border-right:1px solid ${line};` : ''}text-align:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:34px;color:${neon};line-height:1">${m.val}</div>
        <div style="font-size:13px;font-weight:700;color:${ink};margin-top:4px">${m.label}</div>
        <div style="font-size:11px;color:${inkFaint};margin-top:2px">${m.sub}</div>
      </div>`).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Séance · ${s.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{background:${bg};color:${ink};font-family:'Barlow',sans-serif;font-size:14px}
  @page{size:A4;margin:0}
  @media print{
    body{background:${bg}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .no-print{display:none!important}
    .page{page-break-after:always}
  }
</style>
</head>
<body>

<div class="page" style="width:210mm;min-height:297mm;padding:0;position:relative;overflow:hidden;background:${bg}">

  <div style="background:${isDark ? `linear-gradient(135deg,#0a0d06 0%,rgba(${neonRgb},0.18) 100%)` : `linear-gradient(135deg,rgba(${neonRgb},0.12) 0%,rgba(${neonRgb},0.04) 100%)`};padding:36px 40px 32px;position:relative;overflow:hidden;border-bottom:2px solid rgba(${neonRgb},0.25)">
    <div style="position:absolute;right:-60px;top:-60px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(${neonRgb},0.18),transparent 65%);pointer-events:none"></div>
    <div style="position:absolute;right:100px;bottom:-80px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(${neonRgb},0.10),transparent 65%);pointer-events:none"></div>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;position:relative">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          ${logoSvg}
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;letter-spacing:.06em;color:${ink}">
              <span style="color:${neon}">FITNESS</span> TRACKER
            </div>
            <div style="font-size:10px;color:${inkFaint};letter-spacing:.1em;text-transform:uppercase;margin-top:1px">Performance Report</div>
          </div>
        </div>
        <div style="font-size:11px;color:${neon};font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">${dateStr}</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:38px;letter-spacing:.02em;color:${ink};line-height:1;margin-bottom:4px">${s.name}</div>
        <div style="font-size:13px;color:${inkFaint}">${exercises.length} exercices · ${totalSets} séries au total</div>
      </div>
      <div style="background:rgba(${neonRgb},0.12);border:1px solid rgba(${neonRgb},0.3);border-radius:16px;padding:16px 22px;text-align:center;flex-shrink:0">
        <div style="font-size:10px;color:${inkFaint};text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Durée</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px;color:${neon};line-height:1">${formatDuration(s.duration)}</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid ${line}">
    ${statsHtml}
  </div>

  <div style="padding:28px 40px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${inkFaint};margin-bottom:20px;display:flex;align-items:center;gap:10px">
      <span>Détail des exercices</span>
      <div style="flex:1;height:1px;background:${line}"></div>
    </div>
    ${exercisesHtml || `<div style="font-size:13px;color:${inkFaint}">Aucun exercice enregistré</div>`}
  </div>

  ${chartData.length ? `<div style="margin-top:28px;padding:0 40px 40px;break-inside:avoid">
    <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${inkFaint};margin-bottom:18px;display:flex;align-items:center;gap:10px">
      <span>Évolution vs séance précédente</span>
      <div style="flex:1;height:1px;background:${line}"></div>
    </div>
    <div style="background:${bgPanel};border:1px solid ${line};border-radius:14px;padding:20px 22px">
      ${chartRows}
      <div style="display:flex;gap:20px;margin-top:16px;padding-top:14px;border-top:1px solid ${line}">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:8px;border-radius:2px;background:rgba(${neonRgb},0.2)"></div><span style="font-size:10px;color:${inkFaint}">Séance précédente</span></div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:10px;border-radius:2px;background:${neon}"></div><span style="font-size:10px;color:${inkFaint}">Cette séance</span></div>
      </div>
    </div>
  </div>` : ''}

  <div style="position:absolute;bottom:0;left:0;right:0;padding:14px 40px;border-top:1px solid ${line};display:flex;align-items:center;justify-content:space-between;background:${bgPanel}">
    <div style="font-size:10px;color:${inkFaint}">Généré par <strong style="color:${neon}">FITNESS TRACKER</strong> · ${printDate}</div>
    <div style="font-size:10px;color:${inkFaint}">Confidentiel · Usage personnel</div>
  </div>
</div>

<script>
  window.addEventListener('load', () => setTimeout(() => window.print(), 600))
</script>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
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
                  <>
                    {/* Barre d'action : nb exercices + Télécharger */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--line)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>
                        {(s.exercises || []).length} exercice{(s.exercises || []).length > 1 ? 's' : ''} réalisé{(s.exercises || []).length > 1 ? 's' : ''}
                      </span>
                      <button
                        className="btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={(e) => { e.stopPropagation(); downloadSession(s) }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Télécharger
                      </button>
                    </div>

                    {/* Liste des exercices */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {(s.exercises || []).map((ex, idx) => {
                        const exVol = exVolume(ex)
                        return (
                          <div key={idx}>
                            {/* en-tête exercice */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{ex.name}</div>
                                {ex.muscle && (
                                  <div style={{ fontSize: 11, color: 'var(--neon)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ex.muscle}</div>
                                )}
                                {ex.comment && (
                                  <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--ink-faint)', marginTop: 3 }}>{ex.comment}</div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: 'var(--neon)', lineHeight: 1 }}>{formatVolume(exVol)}</div>
                                <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>volume total</div>
                              </div>
                            </div>

                            {/* cartes de séries */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {(ex.sets || []).map((st, si) => {
                                const kg   = parseFloat(st.weight || '0') || 0
                                const reps = parseInt(st.reps || '0') || 0
                                const isUnilat = (st.weightR != null && st.weightR !== '') || (st.repsR != null && st.repsR !== '') || (st.durationR != null && st.durationR !== '')
                                const kgR   = parseFloat(st.weightR || '0') || 0
                                const repsR = parseInt(st.repsR || '0') || 0
                                return (
                                  <div key={si} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', minWidth: 80, textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Sér. {si + 1}</div>
                                    {isUnilat ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                                          G {kg > 0 ? `${kg} kg` : 'PDC'} × {st.durationR != null && st.duration ? `${st.duration}s` : reps}
                                        </div>
                                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                                          D {kgR > 0 ? `${kgR} kg` : 'PDC'} × {st.durationR ? `${st.durationR}s` : repsR}
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>
                                          {kg > 0 ? kg : 'PDC'}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-faint)' }}>{kg > 0 ? ' kg' : ''}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 3, fontWeight: 600 }}>
                                          {st.duration ? `${st.duration}s` : `${reps} reps`}
                                        </div>
                                        {kg > 0 && (
                                          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 3, borderTop: '1px solid var(--line)', paddingTop: 4 }}>= {kg * reps} kg</div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* séparateur entre exercices */}
                            {idx < (s.exercises || []).length - 1 && <div style={{ height: 1, background: 'var(--line)', marginTop: 16 }} />}
                          </div>
                        )
                      })}
                    </div>
                  </>
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
