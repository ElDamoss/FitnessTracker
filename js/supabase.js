/* ============================================================
   FITNESSTRACKER — Supabase : Auth + CRUD
   ============================================================ */

const SUPABASE_URL = 'https://hxlhdgfxusckralcjhbw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bGhkZ2Z4dXNja3JhbGNqaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODkwODAsImV4cCI6MjEwMTE2NTA4MH0.qRDOb_HQbmtHPaDWftiPJ3W67fV2AyFRuCCfFc1nGXQ';

if (!window.supabase) {
  console.error('Supabase SDK not loaded - check internet connection');
}
var sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
var currentUser = null;

// ── Helpers ──
function getUserId() { return currentUser ? currentUser.id : null; }
function getUserName() {
  if (!currentUser) return '?';
  return (currentUser.user_metadata && currentUser.user_metadata.display_name)
    || currentUser.email.split('@')[0] || '?';
}

// ── AUTH ──
async function authSignUp(email, password, displayName) {
  var result = await sb.auth.signUp({
    email: email, password: password,
    options: {
      data: { display_name: displayName || email.split('@')[0] },
      emailRedirectTo: undefined
    }
  });
  if (result.error) throw result.error;
  // Auto-login après inscription (bypass confirmation)
  if (result.data.session) {
    currentUser = result.data.session.user;
    return result.data;
  }
  // Si pas de session (email confirm activé), on tente un login direct
  var login = await sb.auth.signInWithPassword({ email: email, password: password });
  if (!login.error && login.data.session) {
    currentUser = login.data.session.user;
    return login.data;
  }
  return result.data;
}

async function authSignIn(email, password) {
  var result = await sb.auth.signInWithPassword({ email: email, password: password });
  if (result.error) throw result.error;
  return result.data;
}

async function authSignOut() {
  await sb.auth.signOut();
  currentUser = null;
}

async function authGetSession() {
  var result = await sb.auth.getSession();
  var session = result.data.session;
  if (session) currentUser = session.user;
  return session;
}

if (sb) {
  sb.auth.onAuthStateChange(function(event, session) {
    currentUser = session ? session.user : null;
    // Détecte le retour du lien de réinitialisation
    if (event === 'PASSWORD_RECOVERY') {
      setTimeout(function() { showPasswordResetModal(); }, 500);
    }
  });
}

function showPasswordResetModal() {
  var html = '<div class="modal-overlay" id="modal-pw-reset" style="z-index:9999">' +
    '<div class="modal"><div class="modal-head"><span>Nouveau mot de passe</span><button class="modal-close" data-close="modal-pw-reset">&times;</button></div>' +
    '<div class="modal-body">' +
      '<p style="font-size:13px;color:var(--ink-dim);margin-bottom:14px">Choisis ton nouveau mot de passe (6 caractères minimum).</p>' +
      '<input type="password" id="pw-reset-new" placeholder="Nouveau mot de passe" style="width:100%;margin-bottom:10px;padding:12px;font-size:16px;border-radius:8px;border:1px solid var(--line);background:var(--bg-panel);color:var(--ink)"/>' +
      '<input type="password" id="pw-reset-confirm" placeholder="Confirmer le mot de passe" style="width:100%;margin-bottom:14px;padding:12px;font-size:16px;border-radius:8px;border:1px solid var(--line);background:var(--bg-panel);color:var(--ink)"/>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn-primary" onclick="submitNewPassword()">Enregistrer</button></div>' +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function submitNewPassword() {
  var pw = document.getElementById('pw-reset-new').value;
  var pw2 = document.getElementById('pw-reset-confirm').value;
  if (!pw || pw.length < 6) { toast('6 caractères minimum', 'error'); return; }
  if (pw !== pw2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
  try {
    var r = await sb.auth.updateUser({ password: pw });
    if (r.error) throw r.error;
    toast(ico('check')+' Mot de passe mis à jour !', 'success');
    var modal = document.getElementById('modal-pw-reset');
    if (modal) modal.remove();
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

// ── DB CRUD ──
var DB = {
  getExercises: async function() {
    var r = await sb.from('exercises').select('*').order('name');
    return r.data || [];
  },
  addExercise: async function(ex) {
    var r = await sb.from('exercises')
      .insert(Object.assign({}, ex, { created_by: getUserId(), is_default: false }))
      .select().single();
    if (r.error) throw r.error;
    return r.data;
  },
  updateExercise: async function(id, u) {
    var r = await sb.from('exercises').update(u).eq('id', id);
    if (r.error) throw r.error;
  },
  deleteExercise: async function(id) {
    var r = await sb.from('exercises').delete().eq('id', id);
    if (r.error) throw r.error;
  },
  getPrograms: async function() {
    var r = await sb.from('programs').select('*')
      .eq('user_id', getUserId()).order('created_at', { ascending: false });
    return r.data || [];
  },
  addProgram: async function(p) {
    var r = await sb.from('programs')
      .insert(Object.assign({}, p, { user_id: getUserId() }))
      .select().single();
    if (r.error) throw r.error;
    return r.data;
  },
  updateProgram: async function(id, u) {
    u.updated_at = new Date().toISOString();
    var r = await sb.from('programs').update(u).eq('id', id);
    if (r.error) throw r.error;
  },
  deleteProgram: async function(id) {
    var r = await sb.from('programs').delete().eq('id', id);
    if (r.error) throw r.error;
  },
  getSessions: async function() {
    var r = await sb.from('sessions').select('*')
      .eq('user_id', getUserId()).order('date', { ascending: false });
    return r.data || [];
  },
  addSession: async function(s) {
    var r = await sb.from('sessions')
      .insert(Object.assign({}, s, { user_id: getUserId() }))
      .select().single();
    if (r.error) throw r.error;
    return r.data;
  },
  deleteSession: async function(id) {
    var r = await sb.from('sessions').delete().eq('id', id);
    if (r.error) throw r.error;
  },
  getMensurations: async function() {
    var r = await sb.from('mensurations').select('*')
      .eq('user_id', getUserId()).order('date', { ascending: false });
    return r.data || [];
  },
  addMensuration: async function(e) {
    var uid = getUserId();
    if (!uid) throw new Error('Non connecté — impossible de sauvegarder');
    var payload = Object.assign({}, e, { user_id: uid });
    // Nettoyer les valeurs null/undefined/vides
    Object.keys(payload).forEach(function(k) {
      if (payload[k] === '' || payload[k] === null || payload[k] === undefined) delete payload[k];
    });
    // Garder user_id et date obligatoires
    payload.user_id = uid;
    if (!payload.date) throw new Error('Date manquante');
    var r = await sb.from('mensurations').insert(payload);
    if (r.error) throw r.error;
    return r.data;
  },
  deleteMensuration: async function(id) {
    var r = await sb.from('mensurations').delete().eq('id', id);
    if (r.error) throw r.error;
  }
};

// ── SEED DEFAULTS ──
async function seedDefaults() {
  // Seed exercises — ajoute les manquants
  var defaults = [
    {name:'Presse Pectoraux',muscle:'Pectoraux',description:'Machine presse pectoraux'},
    {name:'Presse Pectoraux Inclinée',muscle:'Pectoraux',description:'Machine presse inclinée'},
    {name:'Pecfly',muscle:'Pectoraux',description:'Écarté machine'},
    {name:'Extensions Triceps Poulie Haute',muscle:'Triceps',description:'Câble poulie haute'},
    {name:'Élévations Latérales Haltères',muscle:'Épaules',description:'Isolation deltoïdes'},
    {name:'Crunch Swiss Ball',muscle:'Abdominaux',description:'Crunch ballon suisse'},
    {name:'Tirage Horizontal Guidé',muscle:'Dos',description:'Rowing machine guidée'},
    {name:'Tirage Vertical Poulie Haute',muscle:'Dos',description:'Lat pulldown'},
    {name:'Rowing Coude Ouvert Banc Arrondi',muscle:'Dos',description:'Rowing haltère'},
    {name:'Curl Biceps',muscle:'Biceps',description:'Curl barre ou haltères'},
    {name:'Curl Biceps Poulie Basse',muscle:'Biceps',description:'Curl câble poulie basse'},
    {name:'Extensions Banc Lombaire',muscle:'Dos',description:'Hyperextensions'},
    {name:'V Squat',muscle:'Jambes',description:'Squat machine en V'},
    {name:'Presse Horizontale Unilatérale',muscle:'Jambes',description:'Presse unilatérale'},
    {name:'Leg Extension',muscle:'Jambes',description:'Extension quadriceps'},
    {name:'Leg Curl',muscle:'Jambes',description:'Flexion ischio-jambiers'},
    {name:'Machine Abduction',muscle:'Jambes',description:'Abducteurs machine'},
    {name:'Machine Adduction',muscle:'Jambes',description:'Adducteurs machine'},
    {name:'Presse Épaules',muscle:'Épaules',description:'Presse militaire machine'},
    {name:'Gainage',muscle:'Abdominaux',description:'Planche isométrique'},
    {name:'Développé couché',muscle:'Pectoraux',description:'Banc plat'},
    {name:'Développé incliné',muscle:'Pectoraux',description:'Banc incliné'},
    {name:'Tractions',muscle:'Dos',description:'Pronation ou supination'},
    {name:'Rowing barre',muscle:'Dos',description:'Buste penché'},
    {name:'Soulevé de terre',muscle:'Dos',description:'Compound complet'},
    {name:'Développé militaire',muscle:'Épaules',description:'Barre ou haltères'},
    {name:'Curl haltères',muscle:'Biceps',description:'Alternés ou simultanés'},
    {name:'Dips triceps',muscle:'Triceps',description:'Barres parallèles'},
    {name:'Squat',muscle:'Jambes',description:'Barre sur les épaules'},
    {name:'Leg press',muscle:'Jambes',description:'Presse à cuisses'},
    {name:'Fentes',muscle:'Jambes',description:'Avant, arrière, latérales'},
    {name:'Mollets machine',muscle:'Jambes',description:'Debout ou assis'},
    {name:'Crunch',muscle:'Abdominaux',description:'Au sol ou machine'},
    {name:'Planche',muscle:'Abdominaux',description:'Gainage iso'},
    {name:'Abduction avec élastique',muscle:'Fessiers',description:'Travail fessiers et abducteurs avec élastique'},
    {name:'Abduction debout avec élastique',muscle:'Fessiers',description:'Galbe extérieur haut de jambe et fessier'},
    {name:'Abduction allongée avec élastique',muscle:'Fessiers',description:'Isolation fessiers position allongée'},
    {name:'Donkey Kick',muscle:'Fessiers',description:'Exercice au sol ciblant les fessiers'},
    {name:'Élévations latérales jambes tendues',muscle:'Fessiers',description:'Allongé sur le côté, lever la jambe'},
    {name:'Hip Thrust',muscle:'Fessiers',description:'Référence pour muscler les fessiers'},
    {name:'Hip Thrust barre',muscle:'Fessiers',description:'Hip thrust lesté à la barre'},
    {name:'TRX Hip Thrust',muscle:'Fessiers',description:'Hip thrust pieds dans les sangles TRX'},
    {name:'Marche',muscle:'Cardio',description:'Marche à pied — endurance'},
    {name:'Course à pied',muscle:'Cardio',description:'Running outdoor ou tapis'},
    {name:'Fractionné',muscle:'Cardio',description:'HIIT — alternance effort/repos'},
    {name:'Tapis de course',muscle:'Cardio',description:'Course sur tapis — vitesse et inclinaison'},
    {name:'5 min cardio léger',muscle:'Échauffement',description:'Vélo, rameur ou marche rapide'},
    {name:'Rotations poignets',muscle:'Échauffement',description:'15 rotations dans chaque sens'},
    {name:'Rotations coudes',muscle:'Échauffement',description:'15 rotations dans chaque sens'},
    {name:'Rotations épaules',muscle:'Échauffement',description:'15 rotations avant et arrière'},
    {name:'Rotations cervicales',muscle:'Échauffement',description:'10 rotations douces'},
    {name:'Flexion-extension colonne',muscle:'Échauffement',description:'Cat-cow, 5 mouvements lents'},
    {name:'Squats à vide',muscle:'Échauffement',description:'10 squats sans charge'},
    {name:'Pompes légères',muscle:'Échauffement',description:'10 pompes au sol ou sur banc'},
  ];

  // Récupérer les exercices existants
  var existing = await DB.getExercises();
  var existingNames = existing.map(function(e) { return e.name.toLowerCase(); });

  // Filtrer les manquants
  var missing = defaults.filter(function(d) {
    return existingNames.indexOf(d.name.toLowerCase()) === -1;
  });

  if (missing.length > 0) {
    var rows = missing.map(function(d) {
      return Object.assign({}, d, { created_by: getUserId(), is_default: true });
    });
    await sb.from('exercises').insert(rows);
  }

  // (Programme par défaut retiré — l'utilisateur crée le sien)
}
