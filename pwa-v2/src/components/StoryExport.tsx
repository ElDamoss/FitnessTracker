/* ============================================================
   FITNESSTRACKER — Story Instagram Export (1080x1080)
   ============================================================ */
import { drawAnatomicalOnCanvas } from './Mannequin'

function getMannequinColors() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark'
  const p: Record<string, { accent: string; outline: string; base: string }> = {
    dark:   { accent: '#86f7b4', outline: '#4a6b52', base: '#1e3325' },
    light:  { accent: '#2d8f56', outline: '#90b89a', base: '#dfeee3' },
    stitch: { accent: '#4fc3f7', outline: '#3a6080', base: '#152d42' },
    girly:  { accent: '#ff6b9d', outline: '#8a3858', base: '#2a1520' },
  }
  return p[theme] || p.dark
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function formatVolumeStory(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1).replace('.0', '')} t`
  return `${vol} kg`
}

function formatDurationStory(sec?: number): string {
  if (!sec) return '\u2014'
  const m = Math.round(sec / 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const min = m % 60
    return min > 0 ? `${h}h${min.toString().padStart(2, '0')}` : `${h}h`
  }
  return `${m} min`
}

function fDate(d: string): string {
  const date = new Date(d)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateStoryImage(session: any): Promise<void> {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark'
  const themes: Record<string, { accent: string; bg: string; text: string; dim: string; isLight: boolean }> = {
    dark: { accent: '#5dff9f', bg: '#080808', text: '#ffffff', dim: '#999', isLight: false },
    light: { accent: '#00c853', bg: '#ffffff', text: '#111111', dim: '#555', isLight: true },
    stitch: { accent: '#00bfff', bg: '#f5f9ff', text: '#0a1929', dim: '#4a7a9a', isLight: true },
    girly: { accent: '#ff4081', bg: '#fff5f8', text: '#1a0010', dim: '#a04060', isLight: true },
  }
  const c = themes[theme] || themes.dark

  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 1. Background
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, W, H)

  // Diagonal scratches
  ctx.strokeStyle = c.isLight ? '#cccccc' : '#333333'
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.08
  const scratches = [
    [50,0,300,H],[200,0,500,H],[400,0,650,H],[600,0,900,H],[800,0,1050,H],
    [0,100,W,300],[0,500,W,700],[0,900,W,1050],
    [100,0,400,H],[700,0,950,H],[0,200,W,450],[0,800,W,1050],
  ]
  scratches.forEach((sc) => {
    ctx.beginPath(); ctx.moveTo(sc[0], sc[1]); ctx.lineTo(sc[2], sc[3]); ctx.stroke()
  })
  ctx.globalAlpha = 1

  // Vignette
  const vigGrad = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8)
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)')
  vigGrad.addColorStop(1, c.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vigGrad
  ctx.fillRect(0, 0, W, H)

  // Geometric pattern lines
  ctx.strokeStyle = c.accent
  ctx.lineWidth = 1
  ctx.globalAlpha = c.isLight ? 0.12 : 0.06

  ctx.beginPath(); ctx.moveTo(80, 300); ctx.lineTo(300, 150); ctx.lineTo(200, 500); ctx.closePath(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W-100, 400); ctx.lineTo(W-250, 200); ctx.lineTo(W-50, 250); ctx.closePath(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(150, 1000); ctx.lineTo(50, 800); ctx.lineTo(300, 850); ctx.closePath(); ctx.stroke()

  // Hexagons
  function drawHexagon(cx: number, cy: number, r: number) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i - Math.PI / 6
      const hx = cx + r * Math.cos(angle)
      const hy = cy + r * Math.sin(angle)
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy)
    }
    ctx.closePath(); ctx.stroke()
  }
  drawHexagon(120, 600, 60)
  drawHexagon(W-100, 700, 45)
  drawHexagon(W/2, 950, 40)

  // Connecting lines
  ctx.beginPath(); ctx.moveTo(120, 600); ctx.lineTo(300, 500); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W-100, 700); ctx.lineTo(W-200, 850); ctx.stroke()

  // Small circles
  const geoCircles = [{x:300,y:500,r:5},{x:W-200,y:850,r:4},{x:80,y:300,r:3},{x:W-50,y:250,r:3},{x:50,y:800,r:4}]
  geoCircles.forEach((gc) => { ctx.beginPath(); ctx.arc(gc.x, gc.y, gc.r, 0, Math.PI * 2); ctx.stroke() })

  // Thin straight lines
  ctx.beginPath(); ctx.moveTo(0, 500); ctx.lineTo(W, 450); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W/2-200, 0); ctx.lineTo(W/2-100, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W/2+200, 0); ctx.lineTo(W/2+100, H); ctx.stroke()
  ctx.globalAlpha = 1

  // 2. Session name banner
  let sessionName: string = session.name || 'Séance'
  if (sessionName.indexOf(' \u2014 ') > -1) {
    sessionName = sessionName.split(' \u2014 ')[0]
  }

  ctx.fillStyle = c.isLight ? '#f0f0f0' : '#000000'
  ctx.fillRect(40, 45, W - 80, 85)
  ctx.fillStyle = c.accent
  ctx.fillRect(40, 45, 4, 85)

  // REC dot
  ctx.save()
  ctx.shadowColor = '#ff0000'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#ff0000'
  ctx.beginPath(); ctx.arc(90, 88, 10, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Session name
  ctx.save()
  ctx.textAlign = 'left'
  ctx.font = 'bold 62px Impact, Arial Black, sans-serif'
  ctx.fillStyle = c.text
  ctx.shadowColor = c.accent
  ctx.shadowBlur = 8
  ctx.fillText(sessionName.toUpperCase(), 120, 110)
  ctx.restore()

  // Subtitle
  const workedMuscles: Record<string, boolean> = {}
  const muscles: string[] = []
  ;(session.exercises || []).forEach((ex: any) => {
    if (ex.muscle) {
      workedMuscles[ex.muscle] = true
      if (muscles.indexOf(ex.muscle) === -1) muscles.push(ex.muscle)
    }
  })
  const subtitleText = muscles.map((m) => m.toUpperCase()).join(' \u2022 ') + ' \u2022 ' + fDate(session.date).toUpperCase()

  ctx.fillStyle = c.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.8)'
  ctx.fillRect(40, 140, W - 80, 45)
  ctx.textAlign = 'center'
  ctx.font = 'bold 28px Impact, Arial Black, sans-serif'
  ctx.fillStyle = c.text
  ctx.fillText(subtitleText, W / 2, 170)

  // 3. Mannequin
  const mannH = 320
  const mannW = Math.round(mannH * 0.48)
  const mannY = 180
  const mannGap = 80
  const mannLeftX = W / 2 - mannW - mannGap / 2
  const mannRightX = W / 2 + mannGap / 2

  const mannColors = { ...getMannequinColors(), accent: c.accent }
  drawAnatomicalOnCanvas(ctx, workedMuscles, mannLeftX, mannY, mannW, mannH, true, mannColors)
  drawAnatomicalOnCanvas(ctx, workedMuscles, mannRightX, mannY, mannW, mannH, false, mannColors)

  // 4. Stats
  let vol = 0
  ;(session.exercises || []).forEach((ex: any) => {
    ;(ex.sets || []).forEach((st: any) => {
      vol += (parseFloat(st.weight || '0') || 0) * (parseInt(st.reps || '0') || 0)
    })
  })
  const volText = formatVolumeStory(vol)
  const dur = session.duration_sec ? formatDurationStory(session.duration_sec) : (session.duration ? `${session.duration} min` : '\u2014')

  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 120px Impact, Arial Black, sans-serif'
  ctx.shadowColor = c.accent
  ctx.shadowBlur = 25
  ctx.fillStyle = c.accent
  ctx.fillText(volText, W / 2 - 200, 620)
  ctx.restore()

  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 120px Impact, Arial Black, sans-serif'
  ctx.shadowColor = c.accent
  ctx.shadowBlur = 25
  ctx.fillStyle = c.accent
  ctx.fillText(dur, W / 2 + 200, 620)
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.font = 'bold 28px Impact, Arial Black, sans-serif'
  ctx.fillStyle = c.text
  ctx.fillText('VOLUME TOTAL', W / 2 - 200, 670)
  ctx.fillText('DUR\u00c9E EXPLOSÉE', W / 2 + 200, 670)

  ctx.fillStyle = c.accent
  ctx.fillRect(W / 2 - 200 - 40, 685, 80, 4)
  ctx.fillRect(W / 2 + 200 - 40, 685, 80, 4)

  // 5. Branding
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 64px Impact, Arial Black, sans-serif'
  ctx.fillStyle = c.text
  ctx.shadowColor = c.accent
  ctx.shadowBlur = 10
  ctx.fillText('FITNESSTRACKER.BZH', W / 2, 820)
  ctx.restore()

  // 6. Button
  const btnW = 700, btnH = 100, btnX = (W - btnW) / 2, btnY = 900
  ctx.save()
  ctx.fillStyle = c.accent
  roundRect(ctx, btnX, btnY, btnW, btnH, 30)
  ctx.fill()
  ctx.restore()

  // Instagram icon
  const iconX = btnX + 70, iconY = btnY + btnH / 2
  ctx.save()
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3
  roundRect(ctx, iconX - 18, iconY - 18, 36, 36, 10)
  ctx.stroke()
  ctx.beginPath(); ctx.arc(iconX, iconY, 10, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(iconX + 11, iconY - 11, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#000000'; ctx.fill()
  ctx.restore()

  // Button text
  ctx.textAlign = 'center'
  ctx.font = 'bold 30px Impact, Arial Black, sans-serif'
  ctx.fillStyle = '#000000'
  ctx.fillText('\ud83d\udc49 PARTAGER SUR INSTA', W / 2 + 20, btnY + 45)
  ctx.font = 'bold 26px Impact, Arial Black, sans-serif'
  ctx.fillStyle = '#000000'
  ctx.fillText('& D\u00c9FIER TES POTES !', W / 2 + 20, btnY + 80)

  // Download as PNG
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `story-fitnesstracker-${session.date || 'export'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}
