/* ============================================================
   MUSCUTRACK PRO — Performances : historique poids + export rapport
   ============================================================ */

var perfChartW = null, perfChartV = null;

async function renderPerformances() {
  await buildPerfExSelect();
  await renderPerfCharts();
  await renderPerfTable();
}

async function buildPerfExSelect() {
  var sessions = await DB.getSessions();
  var names = [];
  sessions.forEach(function(s) {
    (s.exercises||[]).forEach(function(e) {
      if (names.indexOf(e.name) === -1) names.push(e.name);
    });
  });
  names.sort();
  var sel = document.getElementById('perf-exercise');
  var cur = sel.value;
  sel.innerHTML = '<option value="">Tous les exercices</option>' +
    names.map(function(n) { return '<option' + (n===cur?' selected':'') + '>' + n + '</option>'; }).join('');
}

async function renderPerfCharts() {
  var exName = document.getElementById('perf-exercise').value;
  var days = parseInt(document.getElementById('perf-period').value);
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  var sessions = (await DB.getSessions())
    .filter(function(s) { return new Date(s.date+'T00:00:00') >= cutoff; })
    .slice().reverse();

  var pts = [];
  sessions.forEach(function(s) {
    (s.exercises||[]).forEach(function(ex) {
      if (exName && ex.name !== exName) return;
      var maxW = 0, vol = 0;
      (ex.sets||[]).forEach(function(st) {
        var w = parseFloat(st.weight)||0, r = parseInt(st.reps)||0;
        if (w > maxW) maxW = w;
        vol += w * r;
      });
      if (maxW > 0) pts.push({date:s.date, name:ex.name, maxW:maxW, vol:vol});
    });
  });

  // Agréger par date (max de tous les exos ce jour)
  var byDate = {};
  pts.forEach(function(p) {
    if (!byDate[p.date]) byDate[p.date] = {maxW:0, vol:0};
    if (p.maxW > byDate[p.date].maxW) byDate[p.date].maxW = p.maxW;
    byDate[p.date].vol += p.vol;
  });

  var dates = Object.keys(byDate).sort();
  var labels = dates.map(function(d) { return fDateS(d); });
  var co = {responsive:true,plugins:{legend:{display:false}},scales:{
    x:{ticks:{color:'#52604f',maxRotation:40,font:{size:10}},grid:{display:false}},
    y:{ticks:{color:'#52604f',font:{size:10}},grid:{color:'#1a2219'},beginAtZero:true}}};

  var c1 = document.getElementById('perf-chart-weight').getContext('2d');
  if (perfChartW) perfChartW.destroy();
  if (dates.length > 0) {
    perfChartW = new Chart(c1, {type:'line',data:{labels:labels,datasets:[{
      data:dates.map(function(d){return byDate[d].maxW;}),
      borderColor:'#3fa66b',backgroundColor:'rgba(63,166,107,.1)',tension:.3,fill:true,
      pointBackgroundColor:'#3fa66b',pointRadius:4}]},options:co});
  }

  var c2 = document.getElementById('perf-chart-volume').getContext('2d');
  if (perfChartV) perfChartV.destroy();
  if (dates.length > 0) {
    perfChartV = new Chart(c2, {type:'bar',data:{labels:labels,datasets:[{
      data:dates.map(function(d){return byDate[d].vol;}),
      backgroundColor:'rgba(134,247,180,.25)',borderColor:'#86f7b4',
      borderWidth:2,borderRadius:5}]},options:co});
  }
}

async function renderPerfTable() {
  var exName = document.getElementById('perf-exercise').value;
  var days = parseInt(document.getElementById('perf-period').value);
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  var sessions = (await DB.getSessions())
    .filter(function(s) { return new Date(s.date+'T00:00:00') >= cutoff; });

  var rows = [];
  sessions.forEach(function(s) {
    (s.exercises||[]).forEach(function(ex) {
      if (exName && ex.name !== exName) return;
      var maxW = 0, vol = 0, setsCount = (ex.sets||[]).length;
      (ex.sets||[]).forEach(function(st) {
        var w = parseFloat(st.weight)||0, r = parseInt(st.reps)||0;
        if (w > maxW) maxW = w;
        vol += w * r;
      });
      if (maxW > 0) rows.push({date:s.date, name:ex.name, sets:setsCount, maxW:maxW, vol:vol});
    });
  });

  var tbody = document.getElementById('perf-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--ink-faint)">Aucune donnée</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(r) {
    return '<tr><td>'+fDate(r.date)+'</td><td>'+r.name+'</td><td>'+r.sets+'</td><td>'+r.maxW+' kg</td><td>'+fW(r.vol)+'</td></tr>';
  }).join('');
}

// ── EXPORT RAPPORT HTML ──
async function exportReport() {
  var exName = document.getElementById('perf-exercise').value;
  var days = parseInt(document.getElementById('perf-period').value);
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  var sessions = (await DB.getSessions())
    .filter(function(s) { return new Date(s.date+'T00:00:00') >= cutoff; });

  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  var themeCSS = '';
  if (theme === 'light') themeCSS = 'body{background:#f4f6f3;color:#141a12;} .accent{color:#2d8f56;} table{border-color:#dde3db;} th{background:#f0f3ef;color:#4a5e47;} td{border-color:#e8ede7;}';
  else if (theme === 'stitch') themeCSS = 'body{background:#e8f4fd;color:#1a3a5c;} .accent{color:#2196f3;} table{border-color:#a8d4f0;} th{background:#d0e8f8;color:#3d6a8f;} td{border-color:#bde0f5;}';
  else themeCSS = 'body{background:#07090a;color:#eef1ec;} .accent{color:#86f7b4;} table{border-color:#1f2921;} th{background:#151b14;color:#92a599;} td{border-color:#171f19;}';

  var rows = [];
  var totalVol = 0, totalSets = 0;
  sessions.forEach(function(s) {
    (s.exercises||[]).forEach(function(ex) {
      if (exName && ex.name !== exName) return;
      var maxW = 0, vol = 0;
      (ex.sets||[]).forEach(function(st) {
        var w = parseFloat(st.weight)||0, r = parseInt(st.reps)||0;
        if (w > maxW) maxW = w;
        vol += w * r;
      });
      if (maxW > 0) {
        rows.push({date:s.date, name:ex.name, sets:(ex.sets||[]).length, maxW:maxW, vol:vol});
        totalVol += vol; totalSets += (ex.sets||[]).length;
      }
    });
  });

  var periodLabel = days < 9999 ? days + ' derniers jours' : 'Toutes les données';
  var filterLabel = exName || 'Tous les exercices';
  var userName = getUserName();
  var now = new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'});

  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>';
  html += '<title>Rapport MuscuTrack — ' + userName + '</title>';
  html += '<style>*{box-sizing:border-box;margin:0;padding:0;}';
  html += 'body{font-family:Inter,system-ui,sans-serif;padding:32px;max-width:900px;margin:0 auto;}';
  html += themeCSS;
  html += 'h1{font-size:24px;margin-bottom:4px;} .sub{font-size:13px;opacity:.6;margin-bottom:24px;}';
  html += '.stats{display:flex;gap:24px;margin-bottom:24px;} .stat{text-align:center;}';
  html += '.stat-val{font-size:28px;font-weight:700;} .stat-label{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;}';
  html += 'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;}';
  html += 'th{padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;}';
  html += 'td{padding:10px 12px;border-top:1px solid;}';
  html += '.footer{margin-top:32px;font-size:11px;opacity:.5;text-align:center;}';
  html += '.accent{font-weight:700;}';
  html += '</style></head><body>';
  html += '<h1>📊 Rapport de performances</h1>';
  html += '<div class="sub">' + userName + ' · ' + now + ' · ' + periodLabel + ' · ' + filterLabel + '</div>';
  html += '<div class="stats">';
  html += '<div class="stat"><div class="stat-val accent">' + rows.length + '</div><div class="stat-label">Entrées</div></div>';
  html += '<div class="stat"><div class="stat-val accent">' + totalSets + '</div><div class="stat-label">Séries</div></div>';
  html += '<div class="stat"><div class="stat-val accent">' + fW(totalVol) + '</div><div class="stat-label">Volume total</div></div>';
  html += '</div>';
  html += '<table><thead><tr><th>Date</th><th>Exercice</th><th>Séries</th><th>Charge max</th><th>Volume</th></tr></thead><tbody>';
  rows.forEach(function(r) {
    html += '<tr><td>'+fDate(r.date)+'</td><td>'+r.name+'</td><td>'+r.sets+'</td><td>'+r.maxW+' kg</td><td>'+fW(r.vol)+'</td></tr>';
  });
  html += '</tbody></table>';
  html += '<div class="footer">Généré par MuscuTrack Pro · ' + now + '</div>';
  html += '</body></html>';

  // Télécharger le fichier
  var blob = new Blob([html], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'rapport-muscutrack-' + new Date().toISOString().split('T')[0] + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Rapport exporté 📄', 'success');
}

// ── EVENT LISTENERS ──
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('perf-exercise').addEventListener('change', function() { renderPerfCharts(); renderPerfTable(); });
  document.getElementById('perf-period').addEventListener('change', function() { renderPerfCharts(); renderPerfTable(); });
  document.getElementById('btn-export-report').addEventListener('click', exportReport);
});
