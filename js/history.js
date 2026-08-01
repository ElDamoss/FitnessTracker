/* ============================================================
   MUSCUTRACK PRO — History
   ============================================================ */

let viewingSessionId = null;

async function renderHistory() {
  let sessions = await DB.getSessions();
  const search = (document.getElementById('hist-search').value||'').toLowerCase();
  const mf = document.getElementById('hist-month').value;

  // Populate month select
  const months = [...new Set(sessions.map(s=>s.date.slice(0,7)))].sort().reverse();
  const sel = document.getElementById('hist-month');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tous</option>' + months.map(m=>`<option value="${m}"${m===cur?' selected':''}>${fMonth(m)}</option>`).join('');

  if (search) sessions = sessions.filter(s => s.name.toLowerCase().includes(search) || (s.exercises||[]).some(e=>e.name.toLowerCase().includes(search)));
  if (mf) sessions = sessions.filter(s => s.date.startsWith(mf));

  const el = document.getElementById('history-list');
  if (!sessions.length) { el.innerHTML = '<p class="empty-state">Aucune séance trouvée</p>'; return; }
  el.innerHTML = sessions.map(s => {
    const vol = sesVol(s);
    const tags = (s.exercises||[]).map(e=>`<span class="tag">${e.name}</span>`).join('');
    return `<div class="history-card" onclick="openSessionView('${s.id}')">
      <div class="history-head"><span class="history-name display">${s.name}</span><span class="history-date">${fDate(s.date)}</span></div>
      <div class="history-metas">
        <span class="history-meta">🏋️ ${(s.exercises||[]).length} ex.</span>
        <span class="history-meta">⚖️ ${fW(vol)}</span>
        ${s.duration_sec?`<span class="history-meta">⏱ ${fDur(s.duration_sec)}</span>`:''}
      </div>
      <div class="tag-row">${tags}</div>
    </div>`;
  }).join('');
}

async function openSessionView(id) {
  const sessions = await DB.getSessions();
  const s = sessions.find(x=>x.id===id); if(!s) return;
  viewingSessionId = id;
  document.getElementById('sv-title').textContent = s.name;
  const vol = sesVol(s);
  let html = `<div class="sv-head-metas">
    <span class="sv-meta">📅 ${fDate(s.date)}</span>
    ${s.duration_sec?`<span class="sv-meta">⏱ ${fDur(s.duration_sec)}</span>`:''}
    <span class="sv-meta">⚖️ ${fW(vol)}</span>
  </div>
  ${s.notes?`<div class="sv-notes-box">"${s.notes}"</div>`:''}`;
  (s.exercises||[]).forEach(ex => {
    html += `<div class="sv-ex">
      <div class="sv-ex-head">${ex.name} <span class="muscle-badge">${ex.muscle}</span></div>
      <table class="sv-table"><thead><tr><th>#</th><th>Poids</th><th>Reps</th><th>RPE</th><th>Vol.</th></tr></thead>
      <tbody>${(ex.sets||[]).map((st,i)=>{
        const v=(parseFloat(st.weight)||0)*(parseInt(st.reps)||0);
        return `<tr><td>${i+1}</td><td>${st.weight?st.weight+' kg':'—'}</td><td>${st.reps||'—'}</td><td>${st.rpe||'—'}</td><td>${v>0?fW(v):'—'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  });
  document.getElementById('sv-body').innerHTML = html;
  openModal('modal-sv');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hist-search').addEventListener('input', ()=>renderHistory());
  document.getElementById('hist-month').addEventListener('change', ()=>renderHistory());
  document.getElementById('sv-delete').addEventListener('click', async () => {
    if (!viewingSessionId) return;
    if (!confirm('Supprimer cette séance ?')) return;
    try { await DB.deleteSession(viewingSessionId); } catch(e) { toast(e.message,'error'); return; }
    closeModal('modal-sv'); toast('Supprimée','info');
    if (currentPage==='page-history') renderHistory();
    if (currentPage==='page-dashboard') renderDashboard();
  });
});
