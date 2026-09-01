import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

interface Report {
  id: string
  user_id: string
  type: 'bug' | 'suggestion' | 'amelioration'
  message: string
  response: string | null
  created_at: string
}

const TYPE_OPTIONS = [
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'suggestion', label: 'Suggestion', icon: '💡' },
  { value: 'amelioration', label: 'Amélioration', icon: '🔧' },
] as const

export default function PageReport() {
  const [reports, setReports] = useState<Report[]>([])
  const [type, setType] = useState<'bug' | 'suggestion' | 'amelioration'>('bug')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('reports').insert({ user_id: user.id, type, message: message.trim() })
    setMessage('')
    setSending(false)
    fetchReports()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce signalement ?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('reports').delete().match({ id, user_id: user.id })
    fetchReports()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getTypeInfo = (t: string) => TYPE_OPTIONS.find(o => o.value === t) || TYPE_OPTIONS[0]

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Signaler</h2>
      </div>

      {/* Submit form */}
      <TiltCard style={{ padding: 20, marginBottom: 20 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6, display: 'block' }}>Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as 'bug' | 'suggestion' | 'amelioration')}
              className="select-sm"
              style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6, display: 'block' }}>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Décris ton signalement..."
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                background: 'var(--bg-raised)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                color: 'var(--ink)',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={sending || !message.trim()}
            style={{ width: '100%' }}
          >
            {sending ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </form>
      </TiltCard>

      {/* Reports list */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-faint)' }}>
          Mes signalements ({reports.length})
        </span>
      </div>

      {loading && <div className="empty-state">Chargement…</div>}

      {!loading && reports.length === 0 && (
        <TiltCard style={{ padding: 24 }}>
          <div className="empty-state">Aucun signalement envoyé</div>
        </TiltCard>
      )}

      {reports.map(report => {
        const info = getTypeInfo(report.type)
        return (
          <TiltCard key={report.id} style={{ marginBottom: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{info.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)' }}>{info.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(report.created_at)}</span>
                {report.response ? (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(63,166,107,0.12)', color: '#3fa66b', fontWeight: 600,
                  }}>Répondu</span>
                ) : (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: 'var(--bg-raised)', color: 'var(--ink-faint)', fontWeight: 600,
                  }}>En attente</span>
                )}
                <button
                  onClick={() => handleDelete(report.id)}
                  className="btn-icon"
                  title="Supprimer"
                  style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  </svg>
                </button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink)', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
              {report.message}
            </p>
            {report.response && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(63,166,107,0.06)', border: '1px solid rgba(63,166,107,0.15)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#3fa66b', marginBottom: 4 }}>
                  Réponse admin :
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
                  {report.response}
                </p>
              </div>
            )}
          </TiltCard>
        )
      })}
    </div>
  )
}
