import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

export default function PageProfile() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setEmail(user.email || '')
      setDisplayName(user.user_metadata?.display_name || '')
      setGender(user.user_metadata?.gender || '')
    }
  }

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSaveName = async () => {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } })
    if (error) showMessage('Erreur : ' + error.message)
    else showMessage('Nom mis à jour !')
    setSaving(false)
  }

  const handleSaveGender = async (value: string) => {
    setGender(value)
    const { error } = await supabase.auth.updateUser({ data: { gender: value } })
    if (error) showMessage('Erreur : ' + error.message)
    else showMessage('Genre mis à jour !')
  }

  const handleResetPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://fitnesstracker.bzh'
    })
    if (error) showMessage('Erreur : ' + error.message)
    else showMessage('Email de réinitialisation envoyé !')
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Es-tu sûr de vouloir supprimer ton compte ? Cette action est irréversible.')) return
    setDeleting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const tables = ['sessions', 'programs', 'mensurations', 'exercises', 'reports']
    for (const table of tables) {
      await supabase.from(table).delete().eq('user_id', user.id)
    }

    await supabase.auth.signOut()
    setDeleting(false)
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Mon profil</h2>
      </div>

      {message && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 9, background: 'var(--neon-soft)', color: 'var(--neon)', fontSize: 13, fontWeight: 600 }}>
          {message}
        </div>
      )}

      <TiltCard style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          Informations
        </div>

        <div className="profile-field">
          <label>Email</label>
          <div className="profile-value">{email}</div>
        </div>

        <div className="profile-field">
          <label>Nom d'affichage</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Ton prénom ou pseudo"
          />
        </div>

        <button className="btn-primary btn-sm" onClick={handleSaveName} disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Enregistrement…' : 'Enregistrer le nom'}
        </button>
      </TiltCard>

      <TiltCard style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          Genre
        </div>

        <div className="profile-field">
          <label>Genre</label>
          <select value={gender} onChange={e => handleSaveGender(e.target.value)}>
            <option value="">-- Sélectionner --</option>
            <option value="homme">Homme</option>
            <option value="femme">Femme</option>
          </select>
        </div>
      </TiltCard>

      <TiltCard style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          Sécurité
        </div>

        <button className="btn-ghost" onClick={handleResetPassword}>
          Réinitialiser le mot de passe
        </button>
      </TiltCard>

      <TiltCard style={{ padding: 24 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--danger)' }}>
          Zone dangereuse
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 14 }}>
          Supprimer ton compte effacera toutes tes données (séances, programmes, mensurations, exercices, signalements). Cette action est irréversible.
        </p>

        <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
          {deleting ? 'Suppression…' : 'Supprimer mon compte'}
        </button>
      </TiltCard>
    </div>
  )
}
