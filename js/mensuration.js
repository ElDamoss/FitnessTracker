/* ============================================================
   FITNESSTRACKER — Mensurations
   ============================================================ */

const DEFAULT_METRICS = [
  {key:'poids',label:'Poids',unit:'kg'},
  {key:'tour_bras_g',label:'Tour biceps gauche',unit:'cm'},
  {key:'tour_bras_d',label:'Tour biceps droit',unit:'cm'},
  {key:'tour_pec',label:'Tour de poitrine',unit:'cm'},
  {key:'tour_taille',label:'Tour de taille',unit:'cm'},
  {key:'tour_hanches',label:'Tour de hanches',unit:'cm'},
  {key:'tour_cuisse_g',label:'Tour cuisse gauche',unit:'cm'},
  {key:'tour_cuisse_d',label:'Tour cuisse droite',unit:'cm'},
  {key:'tour_mollet',label:'Tour de mollet',unit:'cm'},
  {key:'tour_epaules',label:'Tour d\'épaules',unit:'cm'},
];

// Custom metrics stored in localStorage per user
function getCustomMetrics() {
  try { return JSON.parse(localStorage.getItem('mt_custom_metrics') || '[]'); } catch(e) { return []; }
}
function saveCustomMetrics(list) {
  localStorage.setItem('mt_custom_metrics', JSON.stringify(list));
}
function getAllMetrics() {
  return [...DEFAULT_METRICS, ...getCustomMetrics()];
}

// Remplace METRICS par getAllMetrics() partout
var METRICS = getAllMetrics();

let mensChart = null;

async function renderMensuration() {
  METRICS = getAllMetrics();
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
  METRICS = getAllMetrics(); // refresh
  const grid = document.getElementById('mens-form-grid');

  DB.getMensurations().then(function(data) {
    var last = (data && data[0]) ? data[0] : {};
    grid.innerHTML = METRICS.map(function(m) {
      var val = last[m.key] != null ? last[m.key] : '';
      return '<div class="mens-field">' +
        '<label>' + m.label + '</label>' +
        '<input type="number" step="0.1" min="0" id="mens-input-' + m.key + '" value="' + val + '" placeholder="' + m.unit + '"/>' +
        '<span class="mens-unit">' + m.unit + '</span>' +
        '</div>';
    }).join('') +
    '<div class="mens-field" style="display:flex;align-items:flex-end">' +
      '<button class="btn-ghost btn-sm" onclick="addCustomMetricPrompt()" style="width:100%;margin-top:auto">+ Ajouter une zone</button>' +
    '</div>';
  }).catch(function(err) {
    console.error('Erreur chargement mensurations:', err);
    grid.innerHTML = METRICS.map(function(m) {
      return '<div class="mens-field">' +
        '<label>' + m.label + '</label>' +
        '<input type="number" step="0.1" min="0" id="mens-input-' + m.key + '" value="" placeholder="' + m.unit + '"/>' +
        '<span class="mens-unit">' + m.unit + '</span>' +
        '</div>';
    }).join('');
  });

  openModal('modal-mens');
}

function addCustomMetricPrompt() {
  var name = prompt('Nom de la zone (ex: Tour de cou, Avant-bras G)');
  if (!name || !name.trim()) return;
  var unit = prompt('Unité (cm ou kg)', 'cm') || 'cm';
  var key = 'custom_' + name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  var customs = getCustomMetrics();
  if (customs.some(function(c){ return c.key === key; })) { toast('Cette zone existe déjà','info'); return; }
  customs.push({ key: key, label: name.trim(), unit: unit.trim() });
  saveCustomMetrics(customs);
  METRICS = getAllMetrics();
  toast(name.trim() + ' ajouté ✓', 'success');
  openMensModal(); // re-render
}

async function saveMens() {
  const date = document.getElementById('mens-date').value;
  if (!date) { toast('Sélectionne une date','error'); return; }

  // Colonnes connues dans la table Supabase
  const dbColumns = ['poids','tour_bras_g','tour_bras_d','tour_pec','tour_taille','tour_hanches','tour_cuisse_g','tour_cuisse_d','tour_mollet','tour_epaules'];
  const entry = { date: date };
  let hasVal = false;

  // Colonnes standard → vers Supabase
  dbColumns.forEach(function(key) {
    var input = document.getElementById('mens-input-' + key);
    if (input && input.value) {
      entry[key] = parseFloat(input.value);
      hasVal = true;
    }
  });

  // Colonnes custom → on les ignore pour Supabase (pas de colonne)
  // TODO: ajouter une colonne JSONB "custom_data" si besoin plus tard

  if (!hasVal) { toast('Renseigne au moins une mesure','error'); return; }
  try {
    await DB.addMensuration(entry);
  } catch(e) {
    console.error('Erreur sauvegarde mensuration:', e);
    toast('Erreur: ' + (e.message || JSON.stringify(e)),'error');
    return;
  }
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
