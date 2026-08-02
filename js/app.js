/* ============================================================
   FITNESSTRACKER — App : Auth flow, Nav, Theme, Dashboard
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
  if (btn) btn.textContent = mode === 'dark' ? '☀️' : '🌙';
  const funBtn = document.getElementById('theme-fun');
  if (funBtn) funBtn.textContent = mode === 'girly' ? '🧵' : '🎀';
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
  document.getElementById('theme-fun').textContent = (cur === 'girly') ? '🧵' : '🎀';
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
  document.getElementById('sidebar').classList.remove('open');
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

  // Seed defaults
  await seedDefaults();

  // Date topbar
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Navigate to home
  navigate('page-home');
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
        <div style="font-weight:600;font-size:14px">${last.name}</div>
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
  document.getElementById('btn-dash-note').addEventListener('click', function() {
    var note = prompt('Note rapide :');
    if (note && note.trim()) toast('📝 Note : ' + note.trim(), 'info', 5000);
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
