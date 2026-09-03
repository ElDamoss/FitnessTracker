import { useState } from 'react'
import { TiltCard } from '../components/TiltCard'
import { supabase } from '../lib/supabase'

interface ProgramExercise {
  name: string
  muscle: string
  sets: number
  repsTarget: string
  restSec: number
  tempo?: string
}

interface ProgramDay {
  name: string
  weekdays: number[]
  exercises: ProgramExercise[]
}

interface DefaultProgram {
  name: string
  goal: string
  days: ProgramDay[]
}

const DEFAULT_PROGRAMS: DefaultProgram[] = [
  {
    name: 'PPL — Push Pull Legs',
    goal: 'Prise de masse',
    days: [
      { name: 'Push', weekdays: [1, 4], exercises: [
        { name: 'Développé couché', muscle: 'Pectoraux', sets: 4, repsTarget: '8-12', restSec: 120, tempo: '3-0-1' },
        { name: 'Développé incliné haltères', muscle: 'Pectoraux', sets: 4, repsTarget: '10-12', restSec: 90 },
        { name: 'Écarté poulie', muscle: 'Pectoraux', sets: 3, repsTarget: '12-15', restSec: 60 },
        { name: 'Développé militaire', muscle: 'Épaules', sets: 4, repsTarget: '8-12', restSec: 120 },
        { name: 'Élévations latérales', muscle: 'Épaules', sets: 4, repsTarget: '12-15', restSec: 60 },
        { name: 'Dips', muscle: 'Triceps', sets: 3, repsTarget: '10-12', restSec: 90 },
      ]},
      { name: 'Pull', weekdays: [2, 5], exercises: [
        { name: 'Tractions', muscle: 'Dos', sets: 4, repsTarget: '6-10', restSec: 120 },
        { name: 'Rowing barre', muscle: 'Dos', sets: 4, repsTarget: '8-12', restSec: 120 },
        { name: 'Tirage vertical', muscle: 'Dos', sets: 3, repsTarget: '10-12', restSec: 90 },
        { name: 'Curl barre', muscle: 'Biceps', sets: 3, repsTarget: '10-12', restSec: 60 },
        { name: 'Curl haltères', muscle: 'Biceps', sets: 3, repsTarget: '12-15', restSec: 60 },
      ]},
      { name: 'Legs', weekdays: [3, 6], exercises: [
        { name: 'Squat barre', muscle: 'Cuisses', sets: 4, repsTarget: '6-10', restSec: 180, tempo: '3-1-1' },
        { name: 'Presse', muscle: 'Cuisses', sets: 4, repsTarget: '10-12', restSec: 120 },
        { name: 'Leg Extension', muscle: 'Cuisses', sets: 3, repsTarget: '12-15', restSec: 90 },
        { name: 'Hip Thrust', muscle: 'Fessiers', sets: 4, repsTarget: '10-12', restSec: 90 },
        { name: 'Mollets machine', muscle: 'Mollets', sets: 4, repsTarget: '12-20', restSec: 60 },
      ]},
    ]
  },
  {
    name: 'Full Body — 3 jours',
    goal: 'Remise en forme / polyvalence',
    days: [
      { name: 'Jour A', weekdays: [1, 3, 5], exercises: [
        { name: 'Squat barre', muscle: 'Cuisses', sets: 4, repsTarget: '8-10', restSec: 150 },
        { name: 'Développé couché', muscle: 'Pectoraux', sets: 4, repsTarget: '8-10', restSec: 120 },
        { name: 'Rowing barre', muscle: 'Dos', sets: 4, repsTarget: '8-10', restSec: 120 },
        { name: 'Développé militaire', muscle: 'Épaules', sets: 3, repsTarget: '10-12', restSec: 90 },
        { name: 'Curl barre', muscle: 'Biceps', sets: 3, repsTarget: '10-12', restSec: 60 },
        { name: 'Dips', muscle: 'Triceps', sets: 3, repsTarget: '10-12', restSec: 60 },
      ]},
    ]
  },
  {
    name: 'Upper / Lower — 4 jours',
    goal: 'Force & hypertrophie',
    days: [
      { name: 'Upper A', weekdays: [1, 4], exercises: [
        { name: 'Développé couché', muscle: 'Pectoraux', sets: 4, repsTarget: '6-8', restSec: 150 },
        { name: 'Rowing barre', muscle: 'Dos', sets: 4, repsTarget: '6-8', restSec: 150 },
        { name: 'Développé militaire', muscle: 'Épaules', sets: 3, repsTarget: '8-10', restSec: 120 },
        { name: 'Tractions', muscle: 'Dos', sets: 3, repsTarget: '8-10', restSec: 120 },
        { name: 'Curl haltères', muscle: 'Biceps', sets: 3, repsTarget: '10-12', restSec: 60 },
        { name: 'Extensions triceps', muscle: 'Triceps', sets: 3, repsTarget: '10-12', restSec: 60 },
      ]},
      { name: 'Lower A', weekdays: [2, 5], exercises: [
        { name: 'Squat barre', muscle: 'Cuisses', sets: 4, repsTarget: '6-8', restSec: 180 },
        { name: 'Soulevé de terre roumain', muscle: 'Ischios', sets: 4, repsTarget: '8-10', restSec: 150 },
        { name: 'Presse', muscle: 'Cuisses', sets: 3, repsTarget: '10-12', restSec: 120 },
        { name: 'Leg Curl', muscle: 'Ischios', sets: 3, repsTarget: '10-12', restSec: 90 },
        { name: 'Hip Thrust', muscle: 'Fessiers', sets: 3, repsTarget: '10-12', restSec: 90 },
        { name: 'Mollets machine', muscle: 'Mollets', sets: 4, repsTarget: '12-20', restSec: 60 },
      ]},
    ]
  },
]

export default function PageDefaultPrograms() {
  const [copying, setCopying] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleCopy = async (program: DefaultProgram) => {
    setCopying(program.name)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('programs').insert({
        user_id: user.id,
        name: program.name,
        goal: program.goal,
        days: program.days,
      })

      if (error) {
        console.error('Erreur copie programme:', error)
        alert('Erreur lors de la copie du programme')
      } else {
        setCopied(program.name)
        setTimeout(() => setCopied(null), 2000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCopying(null)
    }
  }

  const weekdayLabel = (wd: number) => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][wd] || ''

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Programmes par défaut</h2>
        <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: '4px 0 16px' }}>
          Copie un programme prêt à l'emploi dans ton espace.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DEFAULT_PROGRAMS.map(program => (
          <TiltCard key={program.name} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{program.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--neon)', fontWeight: 500 }}>{program.goal}</span>
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }}
                onClick={() => handleCopy(program)}
                disabled={copying === program.name}
              >
                {copied === program.name ? '✓ Copié' : copying === program.name ? '...' : 'Copier'}
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 8 }}>
              {program.days.length} jour{program.days.length > 1 ? 's' : ''} — {program.days.map(d => d.name).join(', ')}
            </div>

            <button
              onClick={() => setExpanded(expanded === program.name ? null : program.name)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              {expanded === program.name ? 'Masquer le détail' : 'Voir le détail'}
            </button>

            {expanded === program.name && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {program.days.map((day, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', background: 'var(--bg-inset)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--neon)', marginBottom: 4 }}>
                      {day.name} <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>— {day.weekdays.map(wd => weekdayLabel(wd)).join(', ')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {day.exercises.map((ex, exIdx) => (
                        <div key={exIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink)' }}>
                          <span>{ex.name} <span style={{ color: 'var(--ink-faint)' }}>({ex.muscle})</span></span>
                          <span className="mono" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{ex.sets}×{ex.repsTarget}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TiltCard>
        ))}
      </div>
    </div>
  )
}
