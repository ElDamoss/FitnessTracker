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

    // Affichage différent pour les séances cardio
    var metas = '';
    if (s.cardio) {
      metas = '<span class="history-meta">'+ico('fire')+' '+(s.calories||0)+' kcal</span>' +
        '<span class="history-meta">'+ico('timer')+' '+(s.duration_min||0)+' min</span>' +
        (s.vitesse ? '<span class="history-meta">'+ico('play')+' '+s.vitesse+' km/h</span>' : '') +
        (s.inclinaison ? '<span class="history-meta">'+ico('trend')+' '+s.inclinaison+'%</span>' : '');
    } else {
      metas = '<span class="history-meta">'+ico('barbell')+' '+(s.exercises||[]).length+' ex.</span>' +
        '<span class="history-meta">'+ico('fire')+' '+fW(vol)+'</span>' +
        (s.duration_sec?'<span class="history-meta">'+ico('timer')+' '+fDur(s.duration_sec)+'</span>':'');
    }

    return '<div class="history-card" style="display:flex;align-items:flex-start;gap:10px">' +
      '<input type="checkbox" class="hist-check" data-id="'+s.id+'" style="margin-top:4px;accent-color:var(--green);width:18px;height:18px;flex-shrink:0"'+checked+'/>' +
      '<div style="flex:1;cursor:pointer" onclick="openSessionView(\''+s.id+'\')">' +
        '<div class="history-head"><span class="history-name display">'+esc(s.name)+'</span><span class="history-date">'+fDate(s.date)+'</span></div>' +
        '<div class="history-metas">' + metas + '</div>' +
        (s.cardio ? '' : '<div class="tag-row">'+tags+'</div>') +
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

  var html = '';

  if (s.cardio) {
    // Vue détail cardio
    html = '<div class="sv-head-metas">' +
      '<span class="sv-meta">'+ico('calendar')+' '+fDate(s.date)+'</span>' +
      '<span class="sv-meta">'+ico('timer')+' '+(s.duration_min||0)+' min</span>' +
    '</div>' +
    '<div class="cardio-card-stats" style="justify-content:center;padding:20px 0">' +
      '<div class="cardio-stat"><div class="cardio-stat-val">'+(s.calories||0)+'</div><div class="cardio-stat-lbl">kcal</div></div>' +
      '<div class="cardio-stat"><div class="cardio-stat-val">'+(s.duration_min||0)+'</div><div class="cardio-stat-lbl">min</div></div>' +
      (s.vitesse ? '<div class="cardio-stat"><div class="cardio-stat-val">'+s.vitesse+'</div><div class="cardio-stat-lbl">km/h</div></div>' : '') +
      (s.inclinaison ? '<div class="cardio-stat"><div class="cardio-stat-val">'+s.inclinaison+'%</div><div class="cardio-stat-lbl">pente</div></div>' : '') +
    '</div>';
  } else {
    // Vue détail muscu
    var vol = sesVol(s);
    html = '<div class="sv-head-metas">' +
      '<span class="sv-meta">'+ico('calendar')+' '+fDate(s.date)+'</span>' +
      (s.duration_sec?'<span class="sv-meta">'+ico('timer')+' '+fDur(s.duration_sec)+'</span>':'') +
      '<span class="sv-meta">'+ico('fire')+' '+fW(vol)+'</span>' +
    '</div>' +
    (s.notes?'<div class="sv-notes-box">"'+esc(s.notes)+'"</div>':'');

    (s.exercises||[]).forEach(function(ex) {
      html += '<div class="sv-ex">' +
        '<div class="sv-ex-head">'+esc(ex.name)+' <span class="muscle-badge">'+(ex.muscle||'')+'</span></div>' +
        '<table class="sv-table"><thead><tr><th>Poids</th><th>Reps</th><th>RPE</th><th>Vol.</th></tr></thead><tbody>';
      (ex.sets||[]).forEach(function(st) {
        var v = (parseFloat(st.weight)||0)*(parseInt(st.reps)||0);
        html += '<tr><td>'+(st.weight?st.weight+' kg':'—')+'</td><td>'+(st.reps||'—')+'</td><td>'+(st.rpe||'—')+'</td><td>'+(v>0?fW(v):'—')+'</td></tr>';
      });
      html += '</tbody></table></div>';
    });

    // Mannequin face + dos côte à côte en bas
    var workedMuscles = {};
    (s.exercises||[]).forEach(function(ex) { if (ex.muscle) workedMuscles[ex.muscle] = true; });
    html += buildMannequinHTML(workedMuscles);
  }

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



// ── STORY INSTAGRAM (1080x1920) — Design impactant ──
async function generateStory() {
  if (!viewingSessionId) return;
  var sessions = await DB.getSessions();
  var s = sessions.find(function(x){return x.id===viewingSessionId;});
  if (!s || s.cardio) { toast('Story disponible pour les séances muscu', 'info'); return; }

  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  var themes = {
    dark: { accent:'#5dff9f', bg:'#080808', text:'#ffffff', dim:'#999', isLight:false },
    light: { accent:'#00c853', bg:'#ffffff', text:'#111111', dim:'#555', isLight:true },
    stitch: { accent:'#00bfff', bg:'#f5f9ff', text:'#0a1929', dim:'#4a7a9a', isLight:true },
    girly: { accent:'#ff4081', bg:'#fff5f8', text:'#1a0010', dim:'#a04060', isLight:true }
  };
  var c = themes[theme] || themes.dark;

  var W = 1080, H = 1920;
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');

  // ─── 1. Background: very dark + diagonal scratches + vignette ───
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // Dark diagonal streaks/scratches
  ctx.strokeStyle = c.isLight ? '#cccccc' : '#333333';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.08;
  var scratches = [
    [50,0,300,H],[200,0,500,H],[400,0,650,H],[600,0,900,H],[800,0,1050,H],
    [0,100,W,300],[0,500,W,700],[0,900,W,1100],[0,1300,W,1500],[0,1600,W,1800],
    [100,0,400,H],[700,0,950,H],[0,200,W,450],[0,800,W,1050],[0,1400,W,1650]
  ];
  scratches.forEach(function(sc) {
    ctx.beginPath();
    ctx.moveTo(sc[0], sc[1]);
    ctx.lineTo(sc[2], sc[3]);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Subtle vignette (darker corners)
  var vigGrad = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, c.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);

  // ─── Geometric pattern lines (behind everything) ───
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = c.isLight ? 0.12 : 0.06;
  
  // Large geometric triangles
  ctx.beginPath();
  ctx.moveTo(80, 300); ctx.lineTo(300, 150); ctx.lineTo(200, 500); ctx.closePath();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(W-100, 400); ctx.lineTo(W-250, 200); ctx.lineTo(W-50, 250); ctx.closePath();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(150, 1000); ctx.lineTo(50, 800); ctx.lineTo(300, 850); ctx.closePath();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(W-80, 1200); ctx.lineTo(W-300, 1100); ctx.lineTo(W-150, 1350); ctx.closePath();
  ctx.stroke();
  
  // Hexagon shapes
  function drawHexagon(cx, cy, r) {
    ctx.beginPath();
    for (var hi = 0; hi < 6; hi++) {
      var angle = Math.PI / 3 * hi - Math.PI / 6;
      var hx = cx + r * Math.cos(angle);
      var hy = cy + r * Math.sin(angle);
      if (hi === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }
  drawHexagon(120, 600, 60);
  drawHexagon(W-100, 700, 45);
  drawHexagon(200, 1400, 70);
  drawHexagon(W-150, 1500, 55);
  drawHexagon(W/2, 1700, 40);
  
  // Connecting lines between geometric shapes
  ctx.beginPath(); ctx.moveTo(120, 600); ctx.lineTo(300, 500); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W-100, 700); ctx.lineTo(W-200, 850); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(200, 1400); ctx.lineTo(350, 1300); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W-150, 1500); ctx.lineTo(W-80, 1350); ctx.stroke();
  
  // Small circles at intersection points
  var geoCircles = [
    {x:300,y:500,r:5},{x:W-200,y:850,r:4},{x:350,y:1300,r:5},
    {x:W-80,y:1350,r:4},{x:80,y:300,r:3},{x:W-50,y:250,r:3},
    {x:50,y:800,r:4},{x:W-300,y:1100,r:3}
  ];
  geoCircles.forEach(function(gc) {
    ctx.beginPath();
    ctx.arc(gc.x, gc.y, gc.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  
  // Thin straight lines crossing the image
  ctx.beginPath(); ctx.moveTo(0, 500); ctx.lineTo(W, 450); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1100); ctx.lineTo(W, 1050); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1600); ctx.lineTo(W, 1650); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W/2-200, 0); ctx.lineTo(W/2-100, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W/2+200, 0); ctx.lineTo(W/2+100, H); ctx.stroke();
  
  ctx.globalAlpha = 1;

  // ─── 2. TOP SECTION: Session name banner (y: 40-180) ───
  var sessionName = s.name;
  if (sessionName.indexOf(' \u2014 ') > -1) {
    sessionName = sessionName.split(' \u2014 ')[0];
  }

  // Black banner with neon green left border
  ctx.fillStyle = c.isLight ? '#f0f0f0' : '#000000';
  ctx.fillRect(40, 45, W - 80, 85);
  ctx.fillStyle = c.accent;
  ctx.fillRect(40, 45, 4, 85);

  // Red glowing circle (REC dot)
  ctx.save();
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(90, 88, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Session name MASSIVE bold
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 62px Impact, Arial Black, sans-serif';
  ctx.fillStyle = c.text;
  ctx.shadowColor = c.accent;
  ctx.shadowBlur = 8;
  ctx.fillText(sessionName.toUpperCase(), 120, 110);
  ctx.restore();

  // Subtitle banner below
  var workedMuscles = {};
  var muscles = [];
  (s.exercises || []).forEach(function(ex) {
    if (ex.muscle) {
      workedMuscles[ex.muscle] = true;
      if (muscles.indexOf(ex.muscle) === -1) muscles.push(ex.muscle);
    }
  });
  var subtitleText = muscles.map(function(m){return m.toUpperCase();}).join(' \u2022 ') + ' \u2022 ' + fDate(s.date).toUpperCase();

  ctx.fillStyle = c.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.8)';
  ctx.fillRect(40, 140, W - 80, 45);
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px Impact, Arial Black, sans-serif';
  ctx.fillStyle = c.text;
  ctx.fillText(subtitleText, W / 2, 170);

  // ─── 3. MANNEQUIN SECTION (y: 200-850) ───
  var mannH = 550;
  var mannW = Math.round(mannH * 0.6);
  var mannY = 220;
  var mannGap = 80;
  var mannLeftX = W / 2 - mannW - mannGap / 2;
  var mannRightX = W / 2 + mannGap / 2;

  // Neon glow behind worked muscles
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.shadowColor = c.accent;
  ctx.shadowBlur = 40;
  ctx.fillStyle = c.accent;
  muscles.forEach(function(m, i) {
    var glowX = (i % 2 === 0) ? mannLeftX + mannW / 2 : mannRightX + mannW / 2;
    var glowY = mannY + 100 + (i * 80);
    ctx.beginPath();
    ctx.arc(glowX, Math.min(glowY, mannY + mannH - 50), 40, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  var mannColors = getMannequinColors();
  mannColors.accent = c.accent;
  drawAnatomicalOnCanvas(ctx, workedMuscles, mannLeftX, mannY, mannW, mannH, true, mannColors);
  drawAnatomicalOnCanvas(ctx, workedMuscles, mannRightX, mannY, mannW, mannH, false, mannColors);



  // ─── 4. STATS SECTION (y: 870-1250) ───
  var vol = sesVol(s);
  var volText = fW(vol);
  var dur = s.duration_sec ? fDur(s.duration_sec) : '\u2014';

  // Volume - MASSIVE neon green left
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 120px Impact, Arial Black, sans-serif';
  ctx.shadowColor = c.accent;
  ctx.shadowBlur = 25;
  ctx.fillStyle = c.accent;
  ctx.fillText(volText, W / 2 - 200, 980);
  ctx.restore();

  // Duration - MASSIVE neon green right
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 120px Impact, Arial Black, sans-serif';
  ctx.shadowColor = c.accent;
  ctx.shadowBlur = 25;
  ctx.fillStyle = c.accent;
  ctx.fillText(dur, W / 2 + 200, 980);
  ctx.restore();

  // Sub-labels below numbers
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px Impact, Arial Black, sans-serif';
  ctx.fillStyle = c.text;
  ctx.fillText('VOLUME TOTAL', W / 2 - 200, 1030);
  ctx.fillText('DUR\u00c9E EXPLOSÉE', W / 2 + 200, 1030);

  // Neon green underline bars
  ctx.fillStyle = c.accent;
  ctx.fillRect(W / 2 - 200 - 40, 1045, 80, 4);
  ctx.fillRect(W / 2 + 200 - 40, 1045, 80, 4);

  // ─── 5. BRANDING (y: 1300-1450) ───
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Impact, Arial Black, sans-serif';
  ctx.fillStyle = c.text;
  ctx.shadowColor = c.accent;
  ctx.shadowBlur = 10;
  ctx.fillText('FITNESSTRACKER.BZH', W / 2, 1380);
  ctx.restore();

  // ─── 6. BOTTOM BUTTON (y: 1500-1650) ───
  var btnW = 700, btnH = 100, btnX = (W - btnW) / 2, btnY = 1520;
  ctx.save();
  ctx.fillStyle = c.accent;
  roundRect(ctx, btnX, btnY, btnW, btnH, 30);
  ctx.fill();
  ctx.restore();

  // Instagram camera icon (rounded square + circle + dot)
  var iconX = btnX + 70, iconY = btnY + btnH / 2;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  roundRect(ctx, iconX - 18, iconY - 18, 36, 36, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(iconX, iconY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(iconX + 11, iconY - 11, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  // Button text line 1
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px Impact, Arial Black, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('\ud83d\udc49 PARTAGER SUR INSTA', W / 2 + 20, btnY + 45);

  // Button text line 2
  ctx.font = 'bold 26px Impact, Arial Black, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('& D\u00c9FIER TES POTES !', W / 2 + 20, btnY + 80);

  // ─── Download as PNG ───
  canvas.toBlob(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'story-fitnesstracker-' + s.date + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(ico('check') + ' Story t\u00e9l\u00e9charg\u00e9e !', 'success');
  }, 'image/png');
}

// Helper: rectangle arrondi (pour la story)
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
