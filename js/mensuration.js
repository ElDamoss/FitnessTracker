/* ============================================================
   MUSCUTRACK PRO — Mensurations
   ============================================================ */

const METRICS = [
  {key:'poids',label:'Poids',unit:'kg'},
  {key:'tour_bras_g',label:'Bras gauche',unit:'cm'},
  {key:'tour_bras_d',label:'Bras droit',unit:'cm'},
  {key:'tour_pec',label:'Poitrine',unit:'cm'},
  {key:'tour_taille',label:'Taille',unit:'cm'},
  {key:'tour_hanches',label:'Hanches',unit:'cm'},
  {key:'tour_cuisse_g',label:'Cuisse G',unit:'cm'},
  {key:'tour_cuisse_d',label:'Cuisse D',unit:'cm'},
  {key:'tour_mollet',label:'Mollet',unit:'cm'},
  {key:'tour_epaules',label:'Épaules',unit:'cm'},
];

let mensChart = null;

async function renderMensuration() {
  const data = await DB.getMensurations();
  renderMensSummary(data);
  renderMensChartUI(data);
  renderMensTable(data);
}

function renderMensSummary(data) {
  const el = document.getElementById('mens-summary');
  if (!data.length) { el.innerHTML='<p class="empty-state" style="grid-column:1/-1">Clique "Saisir" pour commencer</p>'; return; }
  const latest = data[0];
  const prev = data.length>1 ? data[1] : null;
  el.innerHTML = METRICS.filter(m=>latest[m.key]).map(m => {
    const val = parseFloat(latest[m.key])||0;
    const pv = prev ? parseFloat(prev[m.key])||0 : 0;
    const delta = prev ? (val-pv).toFixed(1) : null;
    const cls = delta>0?'up':delta<0?'down':'neutral';
    return `<div class="mens-summary-card">
      <div class="mens-card-label">${m.label}</div>
      <div class="mens-card-val">${val} <span style="font-size:12px;color:var(--ink-faint)">${m.unit}</span></div>
      ${delta!=null?`<div class="mens-card-delta ${cls}">${delta>0?'+'+delta:delta} ${m.unit}</div>`:''}
      <div class="mens-card-date">${fDate(latest.date)}</div>
    </div>`;
  }).join('');
}

function renderMensChartUI(data) {
  const sel = document.getElementById('mens-metric');
  if (sel.options.length <= 1) {
    sel.innerHTML = METRICS.map(m=>`<option value="${m.key}">${m.label} (${m.unit})</option>`).join('');
  }
  renderMensChartData(data);
}

function renderMensChartData(data) {
  const chosen = document.getElementById('mens-metric').value || 'poids';
  const pts = data.slice().reverse().filter(d=>d[chosen]).map(d=>({date:d.date, val:parseFloat(d[chosen])||0}));
  const ctx = document.getElementById('mens-chart').getContext('2d');
  if (mensChart) mensChart.destroy();
  if (!pts.length) return;
  const metricInfo = METRICS.find(m=>m.key===chosen);
  mensChart = new Chart(ctx, {
    type:'line',
    data:{labels:pts.map(p=>fDateS(p.date)), datasets:[{
      data:pts.map(p=>p.val),
      borderColor:'#3fa66b',backgroundColor:'rgba(63,166,107,.1)',
      tension:.35,fill:true,pointBackgroundColor:'#3fa66b',pointRadius:5
    }]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{
      x:{ticks:{color:'#52604f',maxRotation:40,font:{size:10}},grid:{display:false}},
      y:{ticks:{color:'#52604f',font:{size:10},callback:v=>v+' '+metricInfo.unit},grid:{color:'#1a2219'},beginAtZero:false}
    }}
  });
}

function renderMensTable(data) {
  const thead = document.getElementById('mens-thead');
  const tbody = document.getElementById('mens-tbody');
  if (!data.length) {
    thead.innerHTML=''; tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--ink-faint)">Aucune donnée</td></tr>';
    return;
  }
  thead.innerHTML = `<tr><th>Date</th>${METRICS.map(m=>`<th>${m.label}</th>`).join('')}<th></th></tr>`;
  tbody.innerHTML = data.map((entry,idx) => {
    const prev = data[idx+1]||null;
    return `<tr>
      <td style="font-family:'Inter',sans-serif;font-weight:600">${fDate(entry.date)}</td>
      ${METRICS.map(m => {
        const v = entry[m.key] ? parseFloat(entry[m.key]) : null;
        if (v==null) return '<td style="color:var(--ink-faint)">—</td>';
        const pv = prev ? parseFloat(prev[m.key])||null : null;
        let dHtml = '';
        if (pv!=null) { const d=(v-pv).toFixed(1); const cls=d>0?'up':d<0?'down':''; dHtml=` <span class="td-delta ${cls}">${d>0?'+'+d:d}</span>`; }
        return `<td>${v}${dHtml}</td>`;
      }).join('')}
      <td><button class="mens-del-btn" onclick="deleteMensEntry('${entry.id}')">🗑</button></td>
    </tr>`;
  }).join('');
}

function openMensModal() {
  document.getElementById('mens-date').value = new Date().toISOString().split('T')[0];
  const grid = document.getElementById('mens-form-grid');
  // Pre-fill with latest values
  DB.getMensurations().then(data => {
    const last = data[0] || {};
    grid.innerHTML = METRICS.map(m => `
      <div class="mens-field">
        <label>${m.label}</label>
        <input type="number" step="0.1" min="0" id="mens-input-${m.key}" value="${last[m.key]||''}" placeholder="${m.unit}"/>
        <span class="mens-unit">${m.unit}</span>
      </div>`).join('');
  });
  openModal('modal-mens');
}

async function saveMens() {
  const date = document.getElementById('mens-date').value;
  if (!date) { toast('Sélectionne une date','error'); return; }
  const entry = { date };
  let hasVal = false;
  METRICS.forEach(m => {
    const v = document.getElementById('mens-input-'+m.key).value;
    if (v) { entry[m.key] = parseFloat(v); hasVal = true; }
  });
  if (!hasVal) { toast('Renseigne au moins une mesure','error'); return; }
  try { await DB.addMensuration(entry); } catch(e) { toast(e.message,'error'); return; }
  closeModal('modal-mens'); toast('Mensurations sauvegardées ✓','success');
  renderMensuration();
}

async function deleteMensEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  try { await DB.deleteMensuration(id); } catch(e) { toast(e.message,'error'); return; }
  toast('Supprimé','info'); renderMensuration();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-add-mens').addEventListener('click', openMensModal);
  document.getElementById('btn-save-mens').addEventListener('click', saveMens);
  document.getElementById('mens-metric').addEventListener('change', async () => {
    const data = await DB.getMensurations();
    renderMensChartData(data);
  });
});
