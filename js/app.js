/* ============================================================
   MUSCUTRACK PRO — App : Auth flow, Nav, Theme, Dashboard
   ============================================================ */

// ── FORMATTERS ──
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

// ── THEME ──
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = mode === 'light' ? '🌙' : '☀️';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = mode === 'light' ? '#f4f6f3' : '#07090a';
  localStorage.setItem('mt_theme', mode);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function initTheme() {
  const saved = localStorage.getItem('mt_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme:dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

// ── NAVIGATION ──
let currentPage = 'page-dashboard';
const pageTitles = {
  'page-dashboard':'Tableau de bord','page-programs':'Programmes',
  'page-history':'Historique','page-stats':'Progrès',
  'page-mensuration':'Mensurations','page-exercises':'Exercices'
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
  // Render pages
  if (pageId === 'page-dashboard') renderDashboard();
  if (pageId === 'page-programs') renderPrograms();
  if (pageId === 'page-history') renderHistory();
  if (pageId === 'page-stats') renderStats();
  if (pageId === 'page-mensuration') renderMensuration();
  if (pageId === 'page-exercises') renderExLibrary();
  // Close mobile sidebar
  if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
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

  switchBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    title.textContent = isSignUp ? 'Créer un compte' : 'Connexion';
    sub.textContent = isSignUp ? 'Rejoins MuscuTrack pour suivre ta progression' : 'Entre tes identifiants pour accéder à ton espace';
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

  // Seed defaults
  await seedDefaults();

  // Date topbar
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Navigate to dashboard
  navigate('page-dashboard');
}

// ── DASHBOARD ──
async function renderDashboard() {
  const sessions = await DB.getSessions();
  const now = new Date();

  // Volume semaine
  const wStart = new Date(now); wStart.setDate(now.getDate()-now.getDay()+1); wStart.setHours(0,0,0,0);
  const wVol = sessions.filter(s=>new Date(s.date+'T00:00:00')>=wStart).reduce((a,s)=>a+sesVol(s),0);
  document.getElementById('dash-vol').textContent = wVol>=1000?(wVol/1000).toFixed(1)+'k':wVol.toFixed(0);
  document.getElementById('stat-vol-week').textContent = fW(wVol);

  // Séances mois
  const m = now.toISOString().slice(0,7);
  document.getElementById('dash-sessions').textContent = sessions.filter(s=>s.date.startsWith(m)).length;

  // PRs
  const prs = computePRs(sessions);
  document.getElementById('dash-prs').textContent = Object.keys(prs).length;

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

  // Avg duration
  const wd=sessions.filter(s=>s.duration_sec>0).slice(0,10);
  const avg=wd.length?Math.round(wd.reduce((a,s)=>a+s.duration_sec,0)/wd.length/60):0;
  document.getElementById('stat-dur').textContent=avg?avg+'min':'—';

  // Weekly chart
  renderDashWeekChart(sessions);
  // Today program
  await renderDashToday();
  // Recent
  renderDashRecent(sessions);
  // PRs
  renderDashPRs(prs);
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

async function renderDashToday() {
  const el=document.getElementById('dash-today');
  const progs=await DB.getPrograms();
  if(!progs.length){el.innerHTML='<p class="empty-state">Crée un programme</p>';return;}
  const p=progs[0];
  const days=p.days||[];
  if(!days.length){el.innerHTML='<p class="empty-state">Ajoute des jours</p>';return;}
  const day=days[0];
  el.innerHTML=(day.exercises||[]).slice(0,4).map(ex=>`
    <div class="ex-row">
      <div class="ex-badge">${initials(ex.name)}</div>
      <div class="ex-info"><div class="ex-name">${ex.name}</div><div class="ex-meta">${ex.sets||4}s · ${ex.repsTarget||'8-12'}r · ${ex.restSec||120}s repos</div></div>
    </div>`).join('')+
  `<button class="btn-train" style="margin-top:12px;width:100%;padding:10px" onclick="startWorkout('${p.id}','${day.id}')">▶ ${day.name}</button>`;
}

function renderDashRecent(sessions) {
  const el=document.getElementById('dash-recent');
  const recent=sessions.slice(0,4);
  if(!recent.length){el.innerHTML='<p class="empty-state">Aucune séance</p>';return;}
  el.innerHTML=recent.map(s=>`
    <div class="session-row" onclick="openSessionView('${s.id}')">
      <div class="session-badge">${initials(s.name)}</div>
      <div class="session-info"><div class="session-name">${s.name}</div><div class="session-meta">${fDate(s.date)}${s.duration_sec?' · '+fDur(s.duration_sec):''}</div></div>
      <div class="session-vol"><div class="session-vol-val">${fW(sesVol(s))}</div><div class="session-vol-sub">${(s.exercises||[]).length} ex.</div></div>
    </div>`).join('');
}

function renderDashPRs(prs) {
  const el=document.getElementById('dash-prs-list');
  const entries=Object.entries(prs).sort((a,b)=>b[1].weight-a[1].weight).slice(0,4);
  if(!entries.length){el.innerHTML='<p class="empty-state">Aucun record</p>';return;}
  el.innerHTML=entries.map(([name,pr])=>`
    <div class="pr-row">
      <div class="pr-icon"><svg width="16" height="16"><use href="#ic-spark"/></svg></div>
      <div class="pr-info"><div class="pr-name">${name}</div><div class="pr-meta">${fDate(pr.date)} · ×${pr.reps||'?'}</div></div>
      <div class="pr-val">${pr.weight} kg</div>
    </div>`).join('');
}

// ── BOOT ──
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupAuthUI();

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

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
