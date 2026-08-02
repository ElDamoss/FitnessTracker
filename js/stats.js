/* ============================================================
   FITNESSTRACKER — Stats & PRs
   ============================================================ */

let chartMW = null, chartV = null;

async function renderStats() {
  await buildStatsExSel();
  await renderStatCharts();
  await renderPRGrid();
}

async function buildStatsExSel() {
  const sessions = await DB.getSessions();
  const names = [...new Set(sessions.flatMap(s=>(s.exercises||[]).map(e=>e.name)))].sort();
  const sel = document.getElementById('stats-ex');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Exercice…</option>' + names.map(n=>`<option${n===cur?' selected':''}>${n}</option>`).join('');
}

async function renderStatCharts() {
  const exName = document.getElementById('stats-ex').value;
  const days = parseInt(document.getElementById('stats-period').value);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-days);
  const sessions = (await DB.getSessions()).filter(s=>new Date(s.date+'T00:00:00')>=cutoff).slice().reverse();

  if (!exName) { if(chartMW)chartMW.destroy(); if(chartV)chartV.destroy(); return; }

  const pts = [];
  sessions.forEach(s => {
    const exd = (s.exercises||[]).find(e=>e.name===exName); if(!exd) return;
    const maxW = Math.max(0,...(exd.sets||[]).map(st=>parseFloat(st.weight)||0));
    const totalReps = (exd.sets||[]).reduce((a,st)=>a+(parseInt(st.reps)||0),0);
    pts.push({date:s.date, maxW, totalReps});
  });

  const labels = pts.map(p=>fDateS(p.date));
  const co = {responsive:true,plugins:{legend:{display:false}},scales:{
    x:{ticks:{color:'#52604f',maxRotation:40,font:{size:10}},grid:{display:false}},
    y:{ticks:{color:'#52604f',font:{size:10}},grid:{color:'#1a2219'},beginAtZero:true}}};

  const c1 = document.getElementById('chart-maxw').getContext('2d');
  if (chartMW) chartMW.destroy();
  chartMW = new Chart(c1, {type:'line',data:{labels,datasets:[{data:pts.map(p=>p.maxW),
    borderColor:'#3fa66b',backgroundColor:'rgba(63,166,107,.1)',tension:.3,fill:true,
    pointBackgroundColor:'#3fa66b',pointRadius:4}]},options:co});

  const c2 = document.getElementById('chart-vol').getContext('2d');
  if (chartV) chartV.destroy();
  chartV = new Chart(c2, {type:'bar',data:{labels,datasets:[{data:pts.map(p=>p.totalReps),
    backgroundColor:'rgba(134,247,180,.25)',borderColor:'#86f7b4',
    borderWidth:2,borderRadius:5}]},options:co});
}

async function renderPRGrid() {
  const sessions = await DB.getSessions();
  const prs = computePRs(sessions);
  const el = document.getElementById('pr-grid');
  const entries = Object.entries(prs).sort((a,b)=>b[1].weight-a[1].weight);
  if (!entries.length) { el.innerHTML='<p class="empty-state">Aucun record</p>'; return; }
  el.innerHTML = entries.map(([name,pr])=>`
    <div class="pr-card-stat">
      <div class="pr-card-ex">🏆 ${name}</div>
      <div class="pr-card-val">${pr.weight} kg</div>
      <div class="pr-card-meta">× ${pr.reps||'?'} reps · ${fDate(pr.date)}</div>
    </div>`).join('');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('stats-ex').addEventListener('change', ()=>renderStatCharts());
  document.getElementById('stats-period').addEventListener('change', ()=>renderStatCharts());
});
