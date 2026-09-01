import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

interface Mensuration {
  id: string
  user_id: string
  date: string
  poids: number | null
  taille: number | null
  tour_poitrine: number | null
  tour_bras_g: number | null
  tour_bras_d: number | null
  tour_cuisse_g: number | null
  tour_cuisse_d: number | null
  tour_mollet_g: number | null
  tour_mollet_d: number | null
  tour_taille: number | null
  tour_hanche: number | null
  created_at: string
}

const FIELDS = [
  { key: 'poids', label: 'Poids', unit: 'kg' },
  { key: 'taille', label: 'Taille', unit: 'cm' },
  { key: 'tour_poitrine', label: 'Tour de poitrine', unit: 'cm' },
  { key: 'tour_bras_g', label: 'Tour bras gauche', unit: 'cm' },
  { key: 'tour_bras_d', label: 'Tour bras droit', unit: 'cm' },
  { key: 'tour_cuisse_g', label: 'Tour cuisse gauche', unit: 'cm' },
  { key: 'tour_cuisse_d', label: 'Tour cuisse droite', unit: 'cm' },
  { key: 'tour_mollet_g', label: 'Tour mollet gauche', unit: 'cm' },
  { key: 'tour_mollet_d', label: 'Tour mollet droit', unit: 'cm' },
  { key: 'tour_taille', label: 'Tour de taille', unit: 'cm' },
  { key: 'tour_hanche', label: 'Tour de hanche', unit: 'cm' },
] as const

type FieldKey = typeof FIELDS[number]['key']

function SimpleLineChart({ data }: { data: { x: string; y: number }[] }) {
  if (data.length < 2) return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>Pas assez de données pour cette mesure.</div>

  const maxY = Math.max(...data.map(d => d.y))
  const minY = Math.min(...data.map(d => d.y))
  const W = 500, H = 160, padX = 40, padY = 20
  const range = maxY - minY || 1

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (W - padX * 2)
    const y = H - padY - ((d.y - minY) / range) * (H - padY * 2)
    return { x, y, label: d.x, value: d.y }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Gradient area
  const areaD = pathD + ` L ${points[points.length - 1].x} ${H - padY} L ${points[0].x} ${H - padY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
      <defs>
        <linearGradient id="mensuGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--neon)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--neon)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = H - padY - f * (H - padY * 2)
        const val = Math.round(minY + f * range)
        return (
          <g key={f}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--line)" strokeWidth="0.5" />
            <text x={padX - 5} y={y + 3} fontSize="8" fill="var(--ink-faint)" textAnchor="end">{val}</text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#mensuGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--neon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--neon)" />
      ))}

      {/* X labels (show first, middle, last) */}
      {[0, Math.floor(points.length / 2), points.length - 1].map(i => (
        <text key={i} x={points[i].x} y={H - 4} fontSize="8" fill="var(--ink-faint)" textAnchor="middle">
          {points[i].label}
        </text>
      ))}
    </svg>
  )
}

export default function PageMensurations() {
  const [entries, setEntries] = useState<Mensuration[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [selectedMeasure, setSelectedMeasure] = useState<FieldKey>('poids')

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('mensurations')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const hasValue = Object.values(values).some(v => v !== '' && v !== null)
    if (!hasValue) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const payload = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v !== '' && v !== null).map(([k, v]) => [k, parseFloat(v)])
    )

    await supabase.from('mensurations').insert({ user_id: user.id, date: today, ...payload })
    setValues({})
    setShowForm(false)
    setSaving(false)
    fetchEntries()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('mensurations').delete().eq('id', id)
    fetchEntries()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getDelta = (current: Mensuration, previous: Mensuration | null, key: FieldKey): string | null => {
    if (!previous) return null
    const cur = current[key] as number | null
    const prev = previous[key] as number | null
    if (cur == null || prev == null) return null
    const diff = cur - prev
    if (diff === 0) return null
    return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
  }

  const getDeltaClass = (delta: string | null): string => {
    if (!delta) return ''
    return delta.startsWith('+') ? 'up' : 'down'
  }

  // Build chart data for the selected measure (entries chronological, null values filtered out)
  const chartData: { x: string; y: number }[] = [...entries]
    .reverse()
    .map(entry => {
      const val = entry[selectedMeasure] as number | null
      if (val == null) return null
      const d = new Date(entry.date)
      return { x: `${d.getDate()}/${d.getMonth() + 1}`, y: val }
    })
    .filter((p): p is { x: string; y: number } => p !== null)

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Mensurations</h2>
        <button className="btn-ghost btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : '+ Saisir'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <TiltCard style={{ padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>
                    {f.label}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder={f.unit}
                      value={values[f.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 32px 8px 10px',
                        fontSize: 13,
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        color: 'var(--ink)',
                      }}
                    />
                    <span style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: 'var(--ink-faint)',
                    }}>
                      {f.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !Object.values(values).some(v => v !== '' && v !== null)}
              style={{ width: '100%' }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les mesures'}
            </button>
          </form>
        </TiltCard>
      )}

      {/* Evolution chart */}
      <TiltCard style={{ padding: '18px 20px', marginBottom: 20 }}>
        <div className="panel-head">
          <div className="panel-title">Évolution</div>
          <select
            className="select-sm"
            value={selectedMeasure}
            onChange={e => setSelectedMeasure(e.target.value as FieldKey)}
          >
            {FIELDS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <SimpleLineChart data={chartData} />
      </TiltCard>

      {/* History table */}
      {loading && <div className="empty-state">Chargement…</div>}

      {!loading && entries.length === 0 && (
        <TiltCard style={{ padding: 24 }}>
          <div className="empty-state">Aucune mensuration enregistrée. Clique "Saisir" pour commencer.</div>
        </TiltCard>
      )}

      {!loading && entries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                {FIELDS.map(f => (
                  <th key={f.key} style={thStyle}>{f.label}</th>
                ))}
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const prev = entries[idx + 1] || null
                return (
                  <tr key={entry.id}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{formatDate(entry.date)}</span>
                    </td>
                    {FIELDS.map(f => {
                      const val = entry[f.key] as number | null
                      const delta = getDelta(entry, prev, f.key)
                      const cls = getDeltaClass(delta)
                      return (
                        <td key={f.key} style={tdStyle}>
                          {val != null ? (
                            <span>
                              {val}
                              {delta && (
                                <span style={{
                                  fontSize: 10,
                                  marginLeft: 4,
                                  color: cls === 'up' ? '#3fa66b' : cls === 'down' ? '#e05252' : 'var(--ink-faint)',
                                  fontWeight: 600,
                                }}>
                                  {cls === 'up' ? '↑' : '↓'} {delta}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-faint)' }}>—</span>
                          )}
                        </td>
                      )
                    })}
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="btn-icon"
                        title="Supprimer"
                        style={{ width: 26, height: 26, borderRadius: 7 }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                          <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--ink-faint)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 6px',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}
