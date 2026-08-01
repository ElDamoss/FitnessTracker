/* ============================================================
   MUSCUTRACK PRO — Exercises Library
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
        <div><div class="ex-lib-name">${e.name}</div><div class="ex-lib-muscle">${e.muscle}</div></div>
        <div style="display:flex;gap:6px">
          ${e.created_by===getUserId()?`<button class="btn-icon" onclick="openEditEx('${e.id}')">✏️</button><button class="btn-icon" onclick="deleteEx('${e.id}')">🗑</button>`:''}
        </div>
      </div>
      ${e.description?`<div class="ex-lib-desc">${e.description}</div>`:''}
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
