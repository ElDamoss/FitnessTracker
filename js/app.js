/* ============================================================
   FITNESSTRACKER — App : Auth flow, Nav, Theme, Dashboard
   ============================================================ */

// ── FORMATTERS ──
function esc(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// SVG icons inline (remplace les emojis)
var ICONS = {
  fire:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c1 2.4-.6 3.6-1.7 4.9-1.3 1.6-2 3-2 4.7a3.7 3.7 0 007.4 0c0-1.1-.3-2-1-3 .2 1.6-.5 2.3-1.2 2.3-1 0-1.4-.9-1.1-1.9.6-2 1.6-3 1.6-5.1 0-.7-.1-1.3-.4-1.9"/></svg>',
  timer:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l3 2"/><path d="M9.5 2.5h5"/></svg>',
  check:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L19 7"/></svg>',
  trash:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>',
  edit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  barbell:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"/><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/></svg>',
  chart:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 2 5-6"/></svg>',
  calendar:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  clipboard:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="4" y="4" width="16" height="18" rx="2"/></svg>',
  trend:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  ruler:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7.5h16M4 5v5M8 6v3M12 5v5M16 6v3M20 5v5"/></svg>',
  comment:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  note:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  trophy:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H3V5h3M18 9h3V5h-3"/><path d="M6 5h12v7a6 6 0 01-12 0V5z"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>',
  star:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  mail:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
  lock:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
  unlock:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.7-2"/></svg>',
  bolt:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  undo:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a5 5 0 010 10H7"/><path d="M3 10l4-4M3 10l4 4"/></svg>',
  pause:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  play:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>',
  flag:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  doc:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
  bug:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="5"/><path d="M12 9V5M5 10l-2-2M19 10l2-2M5 18l-2 2M19 18l2 2M9 14H2M22 14h-7"/></svg>',
  bulb:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>',
  wrench:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.7-3.7a6 6 0 01-7.4 7.4L6 21l-3-3 8-8a6 6 0 017.4-7.4z"/></svg>',
  muscle:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10c0 0-2.5-2-2.5-5S7 2 7 2M17 10c0 0 2.5-2 2.5-5S17 2 17 2"/><path d="M5 10c0 6 7 12 7 12s7-6 7-12"/></svg>',
  x:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  ban:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>',
  sun:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>',
  ribbon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8 2 5 5 5 8c0 4 7 9 7 9s7-5 7-9c0-3-3-6-7-6z"/></svg>',
  stitch:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 16M4 20L20 4M12 2v20M2 12h20"/></svg>',
  save:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>',
};
function ico(name, size) {
  var s = size || 14;
  var svg = ICONS[name] || '';
  if (s !== 14) svg = svg.replace(/width="14"/g, 'width="'+s+'"').replace(/height="14"/g, 'height="'+s+'"');
  return svg;
}

const fDate = s => { if (!s) return ''; const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); };
const fDateS = s => { if (!s) return ''; const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}); };
const fMonth = m => { const [y,mo]=m.split('-'); return new Date(+y,+mo-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); };
const fW = kg => { if (kg<=0) return '0 kg'; if (kg>=1000) return (kg/1000).toFixed(1)+' t'; return (kg%1===0?kg.toFixed(0):kg.toFixed(1))+' kg'; };
const fDur = s => { const m=Math.floor(s/60),sc=s%60; return String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'); };
const initials = n => (n||'').split(' ').slice(0,2).map(w=>(w[0]||'')).join('').toUpperCase().slice(0,2)||'?';
const sesVol = s => { let v=0; (s.exercises||[]).forEach(e=>(e.sets||[]).forEach(st=>{v+=(parseFloat(st.weight)||0)*(parseInt(st.reps)||0);})); return v; };

// ── TOAST ──
function toast(msg, type='info', dur=3200) {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  document.getElementById('toast-area').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, dur);
}

// ── MODALS ──
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) { closeModal(c.dataset.close); return; }
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

// Modal confirm (remplace les confirm() natifs)
function modalConfirm(title, msg) {
  return new Promise(function(resolve) {
    document.getElementById('modal-confirm-title').textContent = title || 'Confirmer';
    document.getElementById('modal-confirm-msg').textContent = msg || '';
    openModal('modal-confirm');

    var okBtn = document.getElementById('modal-confirm-ok');
    var cancelBtn = document.getElementById('modal-confirm-cancel');

    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    function cleanup() {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeModal('modal-confirm');
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// Modal prompt (remplace les prompt() natifs)
function modalPrompt(title, desc, placeholder, defaultVal) {
  return new Promise(function(resolve) {
    document.getElementById('modal-input-title').textContent = title || 'Saisie';
    document.getElementById('modal-input-desc').textContent = desc || '';
    var input = document.getElementById('modal-input-value');
    input.value = defaultVal || '';
    input.placeholder = placeholder || '';
    openModal('modal-input');
    setTimeout(function(){ input.focus(); }, 150);

    var okBtn = document.getElementById('modal-input-ok');
    function onOk() {
      var val = input.value.trim();
      cleanup();
      resolve(val || null);
    }
    function onKey(e) { if (e.key === 'Enter') onOk(); }
    function onCancel() { cleanup(); resolve(null); }
    function cleanup() {
      okBtn.removeEventListener('click', onOk);
      input.removeEventListener('keydown', onKey);
      closeModal('modal-input');
    }
    okBtn.addEventListener('click', onOk);
    input.addEventListener('keydown', onKey);
  });
}

// ── THEME ──
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = mode === 'dark' ? ico('sun') : ico('moon');
  const funBtn = document.getElementById('theme-fun');
  if (funBtn) funBtn.innerHTML = mode === 'girly' ? ico('stitch') : ico('ribbon');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    if (mode === 'light') meta.content = '#f4f6f3';
    else if (mode === 'stitch') meta.content = '#e8f4fd';
    else if (mode === 'girly') meta.content = '#fff5f8';
    else meta.content = '#07090a';
  }
  localStorage.setItem('mt_theme', mode);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function toggleGirly() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'girly' ? 'stitch' : 'girly');
  document.getElementById('theme-fun').innerHTML = (cur === 'girly') ? ico('stitch') : ico('ribbon');
}
function initTheme() {
  const saved = localStorage.getItem('mt_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme:dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

// ── NAVIGATION ──
let currentPage = 'page-home';
const pageTitles = {
  'page-home':'Accueil','page-dashboard':'Tableau de bord','page-programs':'Programmes',
  'page-history':'Historique','page-stats':'Progrès',
  'page-mensuration':'Mensurations','page-cardio':'Cardio & Calories',
  'page-report':'Signaler','page-default-programs':'Programmes par défaut','page-exercises':'Exercices',
  'page-updates':'Mises à jour','page-profile':'Mon profil','page-admin':'Administration'
};

const pageRoutes = {
  '/':'page-home',
  '/accueil':'page-home',
  '/dashboard':'page-dashboard',
  '/programmes':'page-programs',
  '/historique':'page-history',
  '/progres':'page-stats',
  '/mensurations':'page-mensuration',
  '/cardio':'page-cardio',
  '/signaler':'page-report',
  '/programmes-defaut':'page-default-programs',
  '/exercices':'page-exercises',
  '/mises-a-jour':'page-updates',
  '/admin':'page-admin',
  '/profil':'page-profile'
};

const routeFromPage = {
  'page-home':'/',
  'page-dashboard':'/dashboard',
  'page-programs':'/programmes',
  'page-history':'/historique',
  'page-stats':'/progres',
  'page-mensuration':'/mensurations',
  'page-cardio':'/cardio',
  'page-report':'/signaler',
  'page-default-programs':'/programmes-defaut',
  'page-exercises':'/exercices',
  'page-updates':'/mises-a-jour',
  'page-admin':'/admin',
  'page-profile':'/profil'
};

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.mobile-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
  const pg = document.getElementById(pageId);
  if (!pg) return;
  pg.classList.add('active');
  currentPage = pageId;
  document.getElementById('topbar-title').textContent = pageTitles[pageId] || '';

  // Update URL without reload
  const route = routeFromPage[pageId] || '/';
  if (window.location.pathname !== route) {
    history.pushState({page: pageId}, '', route);
  }

  // Render pages
  if (pageId === 'page-dashboard') renderDashboard();
  if (pageId === 'page-programs') renderPrograms();
  if (pageId === 'page-history') renderHistory();
  if (pageId === 'page-stats') renderStats();
  if (pageId === 'page-mensuration') renderMensuration();
  if (pageId === 'page-cardio') renderCardio();
  if (pageId === 'page-report') renderReports();
  if (pageId === 'page-default-programs') renderDefaultPrograms();
  if (pageId === 'page-exercises') renderExLibrary();
  if (pageId === 'page-profile') renderProfile();
  if (pageId === 'page-admin') renderAdmin();
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.page) {
    navigate(e.state.page);
  } else {
    navigateFromURL();
  }
});

// Navigate based on current URL
function navigateFromURL() {
  var path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  var pageId = pageRoutes[path] || 'page-home';
  navigate(pageId);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (btn && !btn.closest('#wk-screen')) navigate(btn.dataset.page);
});

// ── AUTH FLOW ──
let isSignUp = false;

function setupAuthUI() {
  const form = document.getElementById('auth-form');
  const switchBtn = document.getElementById('auth-switch-btn');
  const switchTxt = document.getElementById('auth-switch-text');
  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const submit = document.getElementById('auth-submit');
  const nameField = document.getElementById('auth-name-field');

  // Mot de passe oublié
  document.getElementById('auth-forgot-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) { toast('Entre ton email d\'abord', 'error'); return; }
    try {
      var r = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://fitnesstracker.bzh/index.html'
      });
      if (r.error) throw r.error;
      toast(ico('mail')+' Email de réinitialisation envoyé à ' + email, 'success', 5000);
    } catch(e) {
      toast('Erreur: ' + (e.message || e), 'error');
    }
  });

  switchBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    title.textContent = isSignUp ? 'Créer un compte' : 'Connexion';
    sub.textContent = isSignUp ? 'Rejoins FitnessTracker pour suivre ta progression' : 'Entre tes identifiants pour accéder à ton espace';
    submit.textContent = isSignUp ? 'Créer mon compte' : 'Se connecter';
    switchTxt.textContent = isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?';
    switchBtn.textContent = isSignUp ? 'Se connecter' : 'Créer un compte';
    nameField.style.display = isSignUp ? 'block' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';

    try {
      if (isSignUp) {
        const name = document.getElementById('auth-display-name').value.trim();
        await authSignUp(email, password, name);
        toast('Compte créé ! Vérifie tes emails si nécessaire.', 'success');
      } else {
        await authSignIn(email, password);
      }
      await initApp();
    } catch (err) {
      let msg = err.message || 'Erreur inconnue';
      if (msg.includes('Invalid login')) msg = 'Email ou mot de passe incorrect';
      if (msg.includes('already registered')) msg = 'Cet email est déjà utilisé';
      if (msg.includes('Password should be')) msg = 'Mot de passe : 6 caractères minimum';
      errEl.textContent = msg;
    }
  });
}

// ── INIT APP (après auth) ──
async function initApp() {
  const session = await authGetSession();
  if (!session) {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    return;
  }

  // Afficher l'app
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  // User info
  document.getElementById('user-display-name').textContent = getUserName();
  document.getElementById('user-avatar').textContent = initials(getUserName());

  // Show admin nav if admin
  showAdminNav();

  // Seed defaults
  await seedDefaults();

  // Date topbar
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Navigate based on URL
  navigateFromURL();

  // Restaurer une séance en cours si elle existe
  restoreWorkoutIfExists();

  // Init home weekday bubbles
  initHomeWeekdays();
}

// ── DASHBOARD ──
async function renderDashboard() {
  const sessions = await DB.getSessions();
  const now = new Date();

  // Nombre total de séances
  document.getElementById('dash-total-sessions').textContent = sessions.length;

  // Volume semaine
  const wStart = new Date(now); wStart.setDate(now.getDate()-now.getDay()+1); wStart.setHours(0,0,0,0);
  const wVol = sessions.filter(s=>new Date(s.date+'T00:00:00')>=wStart).reduce((a,s)=>a+sesVol(s),0);
  document.getElementById('stat-vol-week').textContent = fW(wVol);

  // Progression vs semaine précédente
  const pStart = new Date(wStart); pStart.setDate(pStart.getDate()-7);
  const pVol = sessions.filter(s=>{const d=new Date(s.date+'T00:00:00');return d>=pStart&&d<wStart;}).reduce((a,s)=>a+sesVol(s),0);
  const prog = pVol>0 ? Math.round((wVol-pVol)/pVol*100) : null;
  const dv = document.getElementById('delta-vol');
  if (prog!=null) { dv.textContent=(prog>=0?'+':'')+prog+'%'; dv.className='stat-delta'+(prog<0?' neutral':''); }
  else { dv.textContent='Nouveau'; dv.className='stat-delta'; }

  // Streak
  let streak=0; const today=new Date(now); today.setHours(0,0,0,0);
  for(let i=0;i<60;i++){
    const d=new Date(today);d.setDate(today.getDate()-i);
    if(sessions.some(s=>s.date===d.toISOString().split('T')[0]))streak++;else if(i>0)break;
  }
  document.getElementById('stat-streak').textContent=streak+'j';
  document.getElementById('delta-streak').textContent=streak>0?'Actif':'—';
  document.getElementById('delta-streak').className='stat-delta'+(streak>0?'':' neutral');

  // Dernier entraînement
  const el = document.getElementById('dash-last-training');
  if (sessions.length > 0) {
    const last = sessions[0];
    const vol = sesVol(last);
    el.innerHTML = `<div style="display:flex;align-items:center;gap:12px">
      <div class="ex-badge">${initials(last.name)}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px">${esc(last.name)}</div>
        <div style="font-size:12px;color:var(--ink-faint)">${fDate(last.date)} · ${(last.exercises||[]).length} exercices · ${fW(vol)}</div>
      </div>
    </div>`;
  } else {
    el.innerHTML = '<p style="color:var(--ink-faint);font-size:13px">Aucune séance enregistrée</p>';
  }

  // Courbe du poids (depuis mensurations)
  renderDashPoidsChart();

  // Évolution mensurations
  renderDashMensurationSummary();

  // Weekly chart
  renderDashWeekChart(sessions);
}

async function renderDashPoidsChart() {
  const data = await DB.getMensurations();
  const pts = data.slice().reverse().filter(d=>d.poids).map(d=>({date:d.date, val:parseFloat(d.poids)}));
  const ctx = document.getElementById('dash-chart-poids').getContext('2d');
  if (window._dashPoidsChart) window._dashPoidsChart.destroy();
  if (!pts.length) { return; }
  window._dashPoidsChart = new Chart(ctx, {
    type:'line',
    data:{labels:pts.map(p=>fDateS(p.date)), datasets:[{
      data:pts.map(p=>p.val),
      borderColor:'#3fa66b',backgroundColor:'rgba(63,166,107,.1)',
      tension:.35,fill:true,pointBackgroundColor:'#3fa66b',pointRadius:4
    }]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{
      x:{ticks:{color:'#52604f',maxRotation:40,font:{size:10}},grid:{display:false}},
      y:{ticks:{color:'#52604f',font:{size:10},callback:function(v){return v+' kg';}},grid:{color:'#1a2219'},beginAtZero:false}
    }}
  });
}

async function renderDashMensurationSummary() {
  const data = await DB.getMensurations();
  const el = document.getElementById('dash-mensuration-summary');
  if (!data.length) { el.innerHTML='<p style="color:var(--ink-faint);font-size:13px">Aucune donnée</p>'; return; }
  const latest = data[0];
  const prev = data.length>1 ? data[1] : null;
  const keys = [
    {key:'poids',label:'Poids',unit:'kg'},
    {key:'tour_bras_d',label:'Bras D',unit:'cm'},
    {key:'tour_pec',label:'Poitrine',unit:'cm'},
    {key:'tour_taille',label:'Taille',unit:'cm'},
  ];
  el.innerHTML = keys.filter(k=>latest[k.key]).map(function(k) {
    const v = parseFloat(latest[k.key])||0;
    const pv = prev ? parseFloat(prev[k.key])||0 : 0;
    const delta = prev ? (v-pv).toFixed(1) : null;
    const cls = delta>0?'color:#22c55e':delta<0?'color:var(--danger)':'color:var(--ink-faint)';
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line-soft)">' +
      '<span style="font-size:13px">' + k.label + '</span>' +
      '<span style="font-family:IBM Plex Mono,monospace;font-size:13px;font-weight:600">' + v + ' ' + k.unit +
      (delta!=null ? ' <span style="font-size:11px;'+cls+'">' + (delta>0?'+'+delta:delta) + '</span>' : '') +
      '</span></div>';
  }).join('');
}

function computePRs(sessions) {
  const prs = {};
  (sessions||[]).forEach(s=>(s.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(st=>{
    const w=parseFloat(st.weight)||0;
    if(w>0&&(!prs[ex.name]||w>prs[ex.name].weight))
      prs[ex.name]={weight:w,reps:st.reps,date:s.date};
  })));
  return prs;
}

function renderDashWeekChart(sessions) {
  const now=new Date();
  const dayNames=['Di','Lu','Ma','Me','Je','Ve','Sa'];
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date(now);d.setDate(now.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    const vol=sessions.filter(s=>s.date===ds).reduce((a,s)=>a+sesVol(s),0);
    days.push({label:dayNames[d.getDay()],vol,today:i===0});
  }
  const max=Math.max(1,...days.map(d=>d.vol));
  document.getElementById('chart-week-wrap').innerHTML=days.map(d=>`
    <div class="chart-col">
      <div class="chart-bar-wrap">
        <div class="chart-bar${d.today?' today':''}" style="height:${Math.max(4,d.vol/max*100)}%">
          ${d.vol>0?`<span class="chart-bar-val">${d.vol>=1000?(d.vol/1000).toFixed(1)+'k':d.vol.toFixed(0)}</span>`:''}
        </div>
      </div>
      <span class="chart-day${d.today?' today':''}">${d.label}</span>
    </div>`).join('');
}


// (anciennes fonctions dash supprimées — remplacées par le nouveau dashboard)


// ── HOME WEEKDAYS ──
function initHomeWeekdays() {
  var today = new Date().getDay(); // 0=dimanche, 1=lundi...
  var bubbles = document.querySelectorAll('.home-day-bubble');
  bubbles.forEach(function(btn) {
    var day = parseInt(btn.dataset.day);
    if (day === today) btn.classList.add('today');
    btn.addEventListener('click', function() {
      bubbles.forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      showHomeDaySessions(day);
    });
  });
  // Au chargement, marquer les jours qui ont une séance programmée
  markHomeDaysWithSessions();
  // Cliquer sur aujourd'hui par défaut
  var todayBtn = document.querySelector('.home-day-bubble[data-day="'+today+'"]');
  if (todayBtn) todayBtn.click();
}

async function markHomeDaysWithSessions() {
  var progs = await DB.getPrograms();
  var daysWithSession = [];
  progs.forEach(function(p) {
    (p.days||[]).forEach(function(day) {
      (day.weekdays||[]).forEach(function(wd) {
        if (daysWithSession.indexOf(wd) === -1) daysWithSession.push(wd);
      });
    });
  });
  document.querySelectorAll('.home-day-bubble').forEach(function(btn) {
    var day = parseInt(btn.dataset.day);
    if (daysWithSession.indexOf(day) > -1) btn.classList.add('has-session');
  });
}

async function showHomeDaySessions(dayNum) {
  var el = document.getElementById('home-day-sessions');
  if (!el) return;
  var progs = await DB.getPrograms();
  var sessionsForDay = [];

  progs.forEach(function(p) {
    (p.days||[]).forEach(function(day) {
      if ((day.weekdays||[]).indexOf(dayNum) > -1) {
        sessionsForDay.push({progId:p.id, dayId:day.id, dayName:day.name, progName:p.name, exCount:(day.exercises||[]).length});
      }
    });
  });

  if (!sessionsForDay.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--ink-faint);text-align:center;padding:8px 0">Aucune séance programmée ce jour</p>';
    return;
  }

  el.innerHTML = sessionsForDay.map(function(s) {
    return '<div class="home-day-session-card" onclick="startWorkout(\''+s.progId+'\',\''+s.dayId+'\')">' +
      '<div style="font-weight:700;font-size:14px">' + esc(s.dayName) + '</div>' +
      '<div style="font-size:12px;color:var(--ink-faint);margin-top:2px">' + esc(s.progName) + ' — ' + s.exCount + ' exercice(s)</div>' +
    '</div>';
  }).join('');
}

// ── BOOT ──
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupAuthUI();

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('theme-fun').addEventListener('click', toggleGirly);

  // Dashboard buttons
  document.getElementById('btn-dash-last-recap').addEventListener('click', async function() {
    var sessions = await DB.getSessions();
    if (sessions.length > 0) openSessionView(sessions[0].id);
    else toast('Aucune séance enregistrée', 'info');
  });
  document.getElementById('btn-dash-note').addEventListener('click', async function() {
    var note = await modalPrompt('Prise de note', 'Note rapide', 'Ta note ici...');
    if (note) toast(ico('note')+' Note : ' + note, 'info', 5000);
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (!confirm('Se déconnecter ?')) return;
    await authSignOut();
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    toast('Déconnecté', 'info');
  });

  // Menu burger mobile
  const btnMenu = document.getElementById('btn-menu');
  const updateMenu = () => { btnMenu.style.display = window.innerWidth<=900 ? 'flex' : 'none'; };
  updateMenu();
  window.addEventListener('resize', updateMenu);

  // Try auto-login
  await initApp();
});
