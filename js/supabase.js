/* ============================================================
   MUSCUTRACK PRO — Supabase : Auth + CRUD
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
    options: { data: { display_name: displayName || email.split('@')[0] } }
  });
  if (result.error) throw result.error;
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
  sb.auth.onAuthStateChange(function(_e, session) {
    currentUser = session ? session.user : null;
  });
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
    var r = await sb.from('mensurations')
      .insert(Object.assign({}, e, { user_id: getUserId() }))
      .select().single();
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
  // Seed exercises
  var exCheck = await sb.from('exercises').select('id').eq('is_default', true).limit(1);
  if (!exCheck.data || exCheck.data.length === 0) {
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
    ];
    var rows = defaults.map(function(d) {
      return Object.assign({}, d, { created_by: getUserId(), is_default: true });
    });
    await sb.from('exercises').insert(rows);
  }

  // Seed programme Vigouroux
  var progs = await DB.getPrograms();
  if (progs.length === 0) {
    var exs = await DB.getExercises();
    var find = function(n) { return exs.find(function(e){return e.name===n;}); };
    var ex = function(n,s,r,rest) {
      var found = find(n);
      return { id: found?found.id:n, name:n, muscle:found?found.muscle:'Autre', sets:s, repsTarget:r, restSec:rest };
    };
    await DB.addProgram({
      name:'Programme Vigouroux', goal:'Prise de masse', day_type:'named',
      days:[
        {id:crypto.randomUUID(),name:'Push',exercises:[ex('Presse Pectoraux',4,'8-12',150),ex('Presse Pectoraux Inclinée',4,'10-15',150),ex('Pecfly',4,'12-18',120),ex('Extensions Triceps Poulie Haute',4,'12-15',120),ex('Élévations Latérales Haltères',4,'12-15',60),ex('Crunch Swiss Ball',4,'10-15',60)]},
        {id:crypto.randomUUID(),name:'Pull',exercises:[ex('Tirage Horizontal Guidé',4,'8-12',150),ex('Tirage Vertical Poulie Haute',4,'10-15',120),ex('Rowing Coude Ouvert Banc Arrondi',4,'10-15',120),ex('Curl Biceps',6,'10-15',90),ex('Extensions Banc Lombaire',3,'10-15',60)]},
        {id:crypto.randomUUID(),name:'Bas du corps',exercises:[ex('V Squat',4,'8-12',150),ex('Presse Horizontale Unilatérale',4,'12-15',120),ex('Leg Extension',4,'12-15',90),ex('Leg Curl',4,'12-15',90),ex('Machine Abduction',3,'12-15',60),ex('Machine Adduction',3,'12-15',60),ex('Extensions Banc Lombaire',3,'max',30)]},
        {id:crypto.randomUUID(),name:'Haut du corps',exercises:[ex('Presse Pectoraux',4,'10-15',120),ex('Presse Épaules',4,'10-15',120),ex('Tirage Vertical Poulie Haute',4,'10-15',120),ex('Tirage Horizontal Guidé',4,'10-15',120),ex('Curl Biceps Poulie Basse',4,'10-15',90),ex('Extensions Triceps Poulie Haute',4,'10-15',90),ex('Gainage',3,'max',30)]}
      ]
    });
  }
}
