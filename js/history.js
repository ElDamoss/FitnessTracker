/* ============================================================
   FITNESSTRACKER — History (avec sélection multi + export)
   ============================================================ */

let viewingSessionId = null;
let selectedSessionIds = [];

async function renderHistory() {
  let sessions = await DB.getSessions();
  const search = (document.getElementById('hist-search').value||'').toLowerCase();
  const mf = document.getElementById('hist-month').value;

  // Populate month select
  const months = [...new Set(sessions.map(s=>s.date.slice(0,7)))].sort().reverse();
  const sel = document.getElementById('hist-month');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tous</option>' + months.map(m=>'<option value="'+m+'"'+(m===cur?' selected':'')+'>'+fMonth(m)+'</option>').join('');

  if (search) sessions = sessions.filter(s => s.name.toLowerCase().includes(search) || (s.exercises||[]).some(e=>e.name.toLowerCase().includes(search)));
  if (mf) sessions = sessions.filter(s => s.date.startsWith(mf));

  const el = document.getElementById('history-list');
  if (!sessions.length) { el.innerHTML = '<p class="empty-state">Aucune séance trouvée</p>'; return; }

  el.innerHTML = sessions.map(function(s) {
    var vol = sesVol(s);
    var tags = (s.exercises||[]).map(function(e){return '<span class="tag">'+esc(e.name)+'</span>';}).join('');
    var checked = selectedSessionIds.indexOf(s.id) > -1 ? ' checked' : '';
    return '<div class="history-card" style="display:flex;align-items:flex-start;gap:10px">' +
      '<input type="checkbox" class="hist-check" data-id="'+s.id+'" style="margin-top:4px;accent-color:var(--green);width:18px;height:18px;flex-shrink:0"'+checked+'/>' +
      '<div style="flex:1;cursor:pointer" onclick="openSessionView(\''+s.id+'\')">' +
        '<div class="history-head"><span class="history-name display">'+esc(s.name)+'</span><span class="history-date">'+fDate(s.date)+'</span></div>' +
        '<div class="history-metas">' +
          '<span class="history-meta">'+ico('barbell')+' '+(s.exercises||[]).length+' ex.</span>' +
          '<span class="history-meta">'+ico('fire')+' '+fW(vol)+'</span>' +
          (s.duration_sec?'<span class="history-meta">'+ico('timer')+' '+fDur(s.duration_sec)+'</span>':'') +
        '</div>' +
        '<div class="tag-row">'+tags+'</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Checkboxes event
  el.querySelectorAll('.hist-check').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var id = cb.dataset.id;
      if (cb.checked) {
        if (selectedSessionIds.indexOf(id) === -1) selectedSessionIds.push(id);
      } else {
        selectedSessionIds = selectedSessionIds.filter(function(x){return x!==id;});
      }
      updateExportBtn();
    });
  });
  updateExportBtn();
}

function updateExportBtn() {
  var btn = document.getElementById('btn-export-history');
  btn.style.display = selectedSessionIds.length > 0 ? 'inline-flex' : 'none';
  btn.innerHTML = ico('doc')+' Exporter ' + selectedSessionIds.length + ' séance(s)';
}

async function exportSelectedSessions() {
  if (!selectedSessionIds.length) { toast('Sélectionne au moins une séance','info'); return; }
  var allSessions = await DB.getSessions();
  var selected = allSessions.filter(function(s) { return selectedSessionIds.indexOf(s.id) > -1; });

  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  var themeCSS = '';
  if (theme==='light') themeCSS='body{background:#f4f6f3;color:#141a12;} .accent{color:#2d8f56;} table{border-color:#dde3db;} th{background:#f0f3ef;color:#4a5e47;} td{border-color:#e8ede7;} .day-sep{border-color:#dde3db;}';
  else if (theme==='stitch') themeCSS='body{background:#e8f4fd;color:#1a3a5c;} .accent{color:#2196f3;} table{border-color:#a8d4f0;} th{background:#d0e8f8;color:#3d6a8f;} td{border-color:#bde0f5;} .day-sep{border-color:#a8d4f0;}';
  else if (theme==='girly') themeCSS='body{background:#fff5f8;color:#4a1942;} .accent{color:#e84b8a;} table{border-color:#ffd1e0;} th{background:#ffe8f0;color:#8b3a7a;} td{border-color:#ffe4ee;} .day-sep{border-color:#ffd1e0;}';
  else themeCSS='body{background:#07090a;color:#eef1ec;} .accent{color:#86f7b4;} table{border-color:#1f2921;} th{background:#151b14;color:#92a599;} td{border-color:#171f19;} .day-sep{border-color:#1f2921;}';

  var totalVol = 0, totalSets = 0;
  selected.forEach(function(s) {
    (s.exercises||[]).forEach(function(ex) {
      totalSets += (ex.sets||[]).length;
      (ex.sets||[]).forEach(function(st) { totalVol += (parseFloat(st.weight)||0)*(parseInt(st.reps)||0); });
    });
  });

  var userName = getUserName();
  var now = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});

  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>';
  html += '<title>Rapport FitnessTracker — '+userName+'</title>';
  html += '<style>*{box-sizing:border-box;margin:0;padding:0;}';
  html += 'body{font-family:Inter,system-ui,sans-serif;padding:32px;max-width:900px;margin:0 auto;}';
  html += themeCSS;
  html += 'h1{font-size:24px;margin-bottom:4px;} .sub{font-size:13px;opacity:.6;margin-bottom:24px;}';
  html += '.stats{display:flex;gap:24px;margin-bottom:28px;} .stat{text-align:center;}';
  html += '.stat-val{font-size:28px;font-weight:700;} .stat-label{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;}';
  html += '.day-sep{border:none;border-top:2px solid;margin:28px 0 20px;} .day-title{font-size:18px;font-weight:700;margin-bottom:4px;} .day-meta{font-size:12px;opacity:.6;margin-bottom:14px;}';
  html += 'table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;}';
  html += 'th{padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;}';
  html += 'td{padding:8px 10px;border-top:1px solid;} .ex-title{font-size:14px;font-weight:700;margin:12px 0 6px;}';
  html += '.note{font-style:italic;opacity:.7;margin-bottom:12px;font-size:13px;}';
  html += '.footer{margin-top:32px;font-size:11px;opacity:.5;text-align:center;}';
  html += '.accent{font-weight:700;}';
  html += '.mannequin-wrap{display:flex;justify-content:center;gap:32px;margin:24px 0 28px;}';
  html += '.mannequin-label{text-align:center;font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.08em;margin-top:8px;}';
  html += '</style></head><body>';
  html += '<h1>' + ico('chart',18) + ' Rapport d\'entraînement</h1>';
  html += '<div class="sub">'+userName+' · '+now+' · '+selected.length+' séance(s)</div>';
  html += '<div class="stats">';
  html += '<div class="stat"><div class="stat-val accent">'+selected.length+'</div><div class="stat-label">Séances</div></div>';
  html += '<div class="stat"><div class="stat-val accent">'+fW(totalVol)+'</div><div class="stat-label">Volume total</div></div>';
  html += '</div>';

  // Collecter les muscles travaillés
  var workedMuscles = {};
  selected.forEach(function(s) {
    (s.exercises||[]).forEach(function(ex) {
      if (ex.muscle) workedMuscles[ex.muscle] = true;
    });
  });

  // Mannequin SVG (face + dos)
  html += buildMannequinHTML(workedMuscles, themeCSS.indexOf('background:#07090a')>-1 || themeCSS.indexOf('background:#e8f4fd')>-1);

  selected.forEach(function(s, idx) {
    if (idx > 0) html += '<hr class="day-sep"/>';
    var vol = sesVol(s);
    html += '<div class="day-title">'+esc(s.name)+'</div>';
    html += '<div class="day-meta">'+fDate(s.date)+(s.duration_sec?' · '+fDur(s.duration_sec):'')+' · '+fW(vol)+'</div>';
    if (s.notes) html += '<div class="note">"'+s.notes+'"</div>';
    (s.exercises||[]).forEach(function(ex) {
      html += '<div class="ex-title">'+esc(ex.name)+' <span style="font-size:11px;opacity:.6">('+ex.muscle+')</span></div>';
      html += '<table><thead><tr><th>Poids</th><th>Reps</th><th>RPE</th><th>Volume</th></tr></thead><tbody>';
      (ex.sets||[]).forEach(function(st) {
        var v = (parseFloat(st.weight)||0)*(parseInt(st.reps)||0);
        html += '<tr><td>'+(st.weight?st.weight+' kg':'—')+'</td><td>'+(st.reps||'—')+'</td><td>'+(st.rpe||'—')+'</td><td>'+(v>0?fW(v):'—')+'</td></tr>';
      });
      html += '</tbody></table>';
    });
  });

  html += '<div class="footer">Généré par FitnessTracker · '+now+'</div>';
  html += '</body></html>';

  var blob = new Blob([html], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'rapport-fitnesstracker-'+new Date().toISOString().split('T')[0]+'.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(ico('doc')+' Rapport exporté','success');
  selectedSessionIds = [];
  updateExportBtn();
}

async function openSessionView(id) {
  var sessions = await DB.getSessions();
  var s = sessions.find(function(x){return x.id===id;}); if(!s) return;
  viewingSessionId = id;
  document.getElementById('sv-title').textContent = s.name;
  var vol = sesVol(s);
  var html = '<div class="sv-head-metas">' +
    '<span class="sv-meta">'+ico('calendar')+' '+fDate(s.date)+'</span>' +
    (s.duration_sec?'<span class="sv-meta">'+ico('timer')+' '+fDur(s.duration_sec)+'</span>':'') +
    '<span class="sv-meta">'+ico('fire')+' '+fW(vol)+'</span>' +
  '</div>' +
  (s.notes?'<div class="sv-notes-box">"'+s.notes+'"</div>':'');

  (s.exercises||[]).forEach(function(ex) {
    html += '<div class="sv-ex">' +
      '<div class="sv-ex-head">'+esc(ex.name)+' <span class="muscle-badge">'+(ex.muscle||'')+'</span></div>' +
      '<table class="sv-table"><thead><tr><th>#</th><th>Poids</th><th>Reps</th><th>RPE</th><th>Vol.</th></tr></thead><tbody>';
    (ex.sets||[]).forEach(function(st, i) {
      var v = (parseFloat(st.weight)||0)*(parseInt(st.reps)||0);
      html += '<tr><td>'+(i+1)+'</td><td>'+(st.weight?st.weight+' kg':'—')+'</td><td>'+(st.reps||'—')+'</td><td>'+(st.rpe||'—')+'</td><td>'+(v>0?fW(v):'—')+'</td></tr>';
    });
    html += '</tbody></table></div>';
  });
  document.getElementById('sv-body').innerHTML = html;
  openModal('modal-sv');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('hist-search').addEventListener('input', function(){renderHistory();});
  document.getElementById('hist-month').addEventListener('change', function(){renderHistory();});
  document.getElementById('btn-export-history').addEventListener('click', exportSelectedSessions);
  document.getElementById('sv-delete').addEventListener('click', async function() {
    if (!viewingSessionId) return;
    var ok = await modalConfirm('Supprimer la séance', 'Supprimer définitivement cette séance de l\'historique ?');
    if (!ok) return;
    try { await DB.deleteSession(viewingSessionId); } catch(e) { toast(e.message,'error'); return; }
    closeModal('modal-sv'); toast('Supprimée','info');
    if (currentPage==='page-history') renderHistory();
    if (currentPage==='page-dashboard') renderDashboard();
  });
});


// ── MANNEQUIN SVG (face + dos) ──
// Mapping muscles → zones du corps
function buildMannequinHTML(workedMuscles) {
  var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#86f7b4';
  var baseColor = 'rgba(128,128,128,.15)';

  function mc(muscles) {
    for (var i = 0; i < muscles.length; i++) {
      if (workedMuscles[muscles[i]]) return accentColor;
    }
    return baseColor;
  }

  // Couleurs par zone
  var chest = mc(['Pectoraux']);
  var shoulders = mc(['Épaules']);
  var biceps = mc(['Biceps']);
  var triceps = mc(['Triceps']);
  var abs = mc(['Abdos']);
  var legs = mc(['Jambes']);
  var glutes = mc(['Fessiers']);
  var back = mc(['Dos']);
  var forearms = mc(['Biceps','Triceps']);

  // SVG Face (vue de devant)
  var front = '<svg width="120" height="260" viewBox="0 0 120 260" xmlns="http://www.w3.org/2000/svg">';
  // Tête
  front += '<ellipse cx="60" cy="24" rx="14" ry="16" fill="'+baseColor+'" stroke="currentColor" stroke-width="1"/>';
  // Cou
  front += '<rect x="54" y="38" width="12" height="10" fill="'+baseColor+'"/>';
  // Épaules
  front += '<ellipse cx="34" cy="56" rx="12" ry="8" fill="'+shoulders+'"/>';
  front += '<ellipse cx="86" cy="56" rx="12" ry="8" fill="'+shoulders+'"/>';
  // Pectoraux
  front += '<ellipse cx="47" cy="72" rx="14" ry="12" fill="'+chest+'"/>';
  front += '<ellipse cx="73" cy="72" rx="14" ry="12" fill="'+chest+'"/>';
  // Abdos
  front += '<rect x="46" y="86" width="28" height="36" rx="4" fill="'+abs+'"/>';
  // Biceps
  front += '<ellipse cx="28" cy="85" rx="7" ry="18" fill="'+biceps+'"/>';
  front += '<ellipse cx="92" cy="85" rx="7" ry="18" fill="'+biceps+'"/>';
  // Avant-bras
  front += '<ellipse cx="24" cy="115" rx="5" ry="16" fill="'+forearms+'"/>';
  front += '<ellipse cx="96" cy="115" rx="5" ry="16" fill="'+forearms+'"/>';
  // Quadriceps (jambes)
  front += '<ellipse cx="47" cy="150" rx="10" ry="28" fill="'+legs+'"/>';
  front += '<ellipse cx="73" cy="150" rx="10" ry="28" fill="'+legs+'"/>';
  // Tibias
  front += '<ellipse cx="47" cy="205" rx="7" ry="26" fill="'+legs+'"/>';
  front += '<ellipse cx="73" cy="205" rx="7" ry="26" fill="'+legs+'"/>';
  front += '</svg>';

  // SVG Dos (vue arrière)
  var back_svg = '<svg width="120" height="260" viewBox="0 0 120 260" xmlns="http://www.w3.org/2000/svg">';
  // Tête
  back_svg += '<ellipse cx="60" cy="24" rx="14" ry="16" fill="'+baseColor+'" stroke="currentColor" stroke-width="1"/>';
  // Cou
  back_svg += '<rect x="54" y="38" width="12" height="10" fill="'+baseColor+'"/>';
  // Trapèzes / épaules
  back_svg += '<ellipse cx="34" cy="56" rx="12" ry="8" fill="'+shoulders+'"/>';
  back_svg += '<ellipse cx="86" cy="56" rx="12" ry="8" fill="'+shoulders+'"/>';
  // Dos (grand dorsal)
  back_svg += '<path d="M38 60 L60 60 L60 120 L42 115 Z" fill="'+back+'"/>';
  back_svg += '<path d="M82 60 L60 60 L60 120 L78 115 Z" fill="'+back+'"/>';
  // Triceps
  back_svg += '<ellipse cx="28" cy="85" rx="7" ry="18" fill="'+triceps+'"/>';
  back_svg += '<ellipse cx="92" cy="85" rx="7" ry="18" fill="'+triceps+'"/>';
  // Avant-bras
  back_svg += '<ellipse cx="24" cy="115" rx="5" ry="16" fill="'+forearms+'"/>';
  back_svg += '<ellipse cx="96" cy="115" rx="5" ry="16" fill="'+forearms+'"/>';
  // Lombaires
  back_svg += '<rect x="46" y="100" width="28" height="22" rx="4" fill="'+back+'"/>';
  // Fessiers
  back_svg += '<ellipse cx="47" cy="132" rx="12" ry="10" fill="'+glutes+'"/>';
  back_svg += '<ellipse cx="73" cy="132" rx="12" ry="10" fill="'+glutes+'"/>';
  // Ischio-jambiers (jambes arrière)
  back_svg += '<ellipse cx="47" cy="160" rx="10" ry="24" fill="'+legs+'"/>';
  back_svg += '<ellipse cx="73" cy="160" rx="10" ry="24" fill="'+legs+'"/>';
  // Mollets
  back_svg += '<ellipse cx="47" cy="208" rx="7" ry="22" fill="'+legs+'"/>';
  back_svg += '<ellipse cx="73" cy="208" rx="7" ry="22" fill="'+legs+'"/>';
  back_svg += '</svg>';

  return '<div class="mannequin-wrap">' +
    '<div><div style="text-align:center">' + front + '</div><div class="mannequin-label">Face</div></div>' +
    '<div><div style="text-align:center">' + back_svg + '</div><div class="mannequin-label">Dos</div></div>' +
  '</div>';
}
