/* ============================================================
   FITNESSTRACKER — Exercises Library
   ============================================================ */

let muscleF = 'all';

async function renderExLibrary() {
  const search = (document.getElementById('ex-search').value||'').toLowerCase();
  let exs = await DB.getExercises();
  if (muscleF !== 'all') exs = exs.filter(e => e.muscle === muscleF);
  if (search) exs = exs.filter(e => e.name.toLowerCase().includes(search) || e.muscle.toLowerCase().includes(search));
  exs.sort((a,b) => a.name.localeCompare(b.name));
  const el = document.getElementById('ex-library');
  if (!exs.length) { el.innerHTML = '<p class="empty-state">Aucun exercice trouvé</p>'; return; }
  el.innerHTML = exs.map(e => `
    <div class="ex-lib-card">
      <div class="ex-lib-head">
        <div><div class="ex-lib-name">${esc(e.name)}</div><div class="ex-lib-muscle">${esc(e.muscle)}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn-icon ex-info-btn" onclick="showExInfo('${e.id}')" title="Info">${ico('bulb')}</button>
          ${e.created_by===getUserId()?`<button class="btn-icon" onclick="openEditEx('${e.id}')">${ico('edit')}</button><button class="btn-icon" onclick="deleteEx('${e.id}')">${ico('trash')}</button>`:''}
        </div>
      </div>
      ${e.description?`<div class="ex-lib-desc">${esc(e.description)}</div>`:''}
    </div>`).join('');
}

function openNewEx() {
  document.getElementById('modal-ex-title').textContent = 'Nouvel exercice';
  document.getElementById('ex-name').value = '';
  document.getElementById('ex-muscle').value = 'Pectoraux';
  document.getElementById('ex-desc').value = '';
  document.getElementById('ex-edit-id').value = '';
  openModal('modal-ex');
  setTimeout(()=>document.getElementById('ex-name').focus(),150);
}

async function openEditEx(id) {
  const exs = await DB.getExercises();
  const ex = exs.find(e=>e.id===id); if(!ex) return;
  document.getElementById('modal-ex-title').textContent = 'Modifier';
  document.getElementById('ex-name').value = ex.name;
  document.getElementById('ex-muscle').value = ex.muscle;
  document.getElementById('ex-desc').value = ex.description||'';
  document.getElementById('ex-edit-id').value = ex.id;
  openModal('modal-ex');
}

async function saveEx() {
  const name = document.getElementById('ex-name').value.trim();
  const muscle = document.getElementById('ex-muscle').value;
  const description = document.getElementById('ex-desc').value.trim();
  const id = document.getElementById('ex-edit-id').value;
  if (!name) { toast('Nom obligatoire','error'); return; }
  try {
    if (id) { await DB.updateExercise(id, {name,muscle,description}); toast('Modifié ✓','success'); }
    else { await DB.addExercise({name,muscle,description}); toast('Exercice créé ✓','success'); }
  } catch(e) { toast(e.message,'error'); return; }
  closeModal('modal-ex'); renderExLibrary();
}

async function deleteEx(id) {
  if (!confirm('Supprimer cet exercice ?')) return;
  try { await DB.deleteExercise(id); } catch(e) { toast(e.message,'error'); return; }
  renderExLibrary(); toast('Supprimé','info');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-ex').addEventListener('click', openNewEx);
  document.getElementById('btn-save-ex').addEventListener('click', saveEx);
  document.getElementById('ex-search').addEventListener('input', () => renderExLibrary());
  document.querySelectorAll('.chip[data-muscle]').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      muscleF = c.dataset.muscle;
      renderExLibrary();
    });
  });
});

// ── EXERCISE INFO MODAL (image + description) ──
async function showExInfo(id) {
  var exs = await DB.getExercises();
  var ex = exs.find(function(e) { return e.id === id; });
  if (!ex) return;

  document.getElementById('ex-info-title').textContent = ex.name;

  // Chercher une image via l'API wger (libre, gratuite, exercices fitness)
  var imgHtml = '<div class="ex-info-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--ink-faint)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="15.5" r=".8" fill="currentColor"/></svg><p style="margin-top:8px;font-size:12px;color:var(--ink-faint)">Pas d\'image disponible</p></div>';

  try {
    var searchName = ex.name.split(' ').slice(0,2).join(' ');
    var resp = await fetch('https://wger.de/api/v2/exercise/search/?term=' + encodeURIComponent(searchName) + '&language=fr&format=json');
    if (resp.ok) {
      var data = await resp.json();
      var suggestions = data.suggestions || [];
      if (suggestions.length > 0) {
        var exId = suggestions[0].data.id;
        var imgResp = await fetch('https://wger.de/api/v2/exerciseimage/?exercise_base=' + exId + '&format=json');
        if (imgResp.ok) {
          var imgData = await imgResp.json();
          if (imgData.results && imgData.results.length > 0) {
            imgHtml = '<img src="' + imgData.results[0].image + '" alt="' + ex.name + '" class="ex-info-img"/>';
          }
        }
      }
    }
  } catch(e) {
    // Pas grave, on garde le placeholder
  }

  var html = imgHtml;
  html += '<div class="ex-info-details">';
  html += '<div class="ex-info-muscle"><span class="muscle-badge">' + ex.muscle + '</span></div>';
  if (ex.description) {
    html += '<p class="ex-info-desc">' + ex.description + '</p>';
  }
  html += '</div>';

  document.getElementById('ex-info-body').innerHTML = html;
  openModal('modal-ex-info');
}
