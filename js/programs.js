/* ============================================================
   FITNESSTRACKER — Programs + Days + Workout Engine
   ============================================================ */

// ── PROGRAMS RENDER ──
async function renderPrograms() {
  const progs = await DB.getPrograms();
  const el = document.getElementById('programs-list');
  if (!progs.length) {
    el.innerHTML = '<p class="empty-state">Aucun programme — crée le tien !</p>';
    return;
  }
  el.innerHTML = progs.map(p => `
    <div class="prog-card" id="pc-${p.id}">
      <div class="prog-card-head" onclick="toggleProg('${p.id}')">
        <div><div class="prog-name display">${esc(p.name)}</div><div class="prog-goal">${esc(p.goal)||''}</div></div>
        <div style="display:flex;gap:8px" onclick="event.stopPropagation()">
          <button class="btn-icon" onclick="openEditProg('${p.id}')">${ico('edit')}</button>
          <button class="btn-icon" onclick="deleteProg('${p.id}')">${ico('trash')}</button>
        </div>
      </div>
      <div class="prog-days-wrap" id="pd-${p.id}" style="display:none">
        ${(p.days||[]).map(day => `
          <div class="day-row">
            <div><div class="day-name">${esc(day.name)}</div><div class="day-excount">${(day.exercises||[]).length} exercice(s)</div></div>
            <div class="day-actions">
              <button class="btn-icon" onclick="openEditDay('${p.id}','${day.id}')">${ico('edit')}</button>
              <button class="btn-train" onclick="startWorkout('${p.id}','${day.id}')">${ico('play')} Start</button>
            </div>
          </div>`).join('')}
        <div class="add-day-row" onclick="openNewDay('${p.id}')">+ Ajouter un jour</div>
      </div>
    </div>`).join('');
}

function toggleProg(id) {
  const el = document.getElementById('pd-'+id);
  if (el) el.style.display = el.style.display==='none' ? 'block' : 'none';
}

// ── PROGRAM CRUD ──
function openNewProg() {
  document.getElementById('modal-prog-title').textContent = 'Nouveau programme';
  document.getElementById('prog-name').value = '';
  document.getElementById('prog-goal').value = 'Prise de masse';
  document.getElementById('prog-edit-id').value = '';
  document.getElementById('btn-save-prog').textContent = 'Créer';
  openModal('modal-prog');
  setTimeout(()=>document.getElementById('prog-name').focus(),150);
}
function openEditProg(id) {
  const run = async () => {
    const progs = await DB.getPrograms();
    const p = progs.find(x=>x.id===id); if(!p) return;
    document.getElementById('modal-prog-title').textContent = 'Modifier';
    document.getElementById('prog-name').value = p.name;
    document.getElementById('prog-goal').value = p.goal||'Général';
    document.getElementById('prog-edit-id').value = p.id;
    document.getElementById('btn-save-prog').textContent = 'Sauvegarder';
    openModal('modal-prog');
  }; run();
}
async function saveProg() {
  const name = document.getElementById('prog-name').value.trim();
  const goal = document.getElementById('prog-goal').value;
  const id = document.getElementById('prog-edit-id').value;
  if (!name) { toast('Nom obligatoire','error'); return; }
  try {
    if (id) { await DB.updateProgram(id, {name,goal}); toast('Modifié ✓','success'); }
    else { await DB.addProgram({name,goal,day_type:'named',days:[]}); toast(ico('muscle')+' Programme créé','success'); }
  } catch(e) { toast(e.message,'error'); return; }
  closeModal('modal-prog'); renderPrograms();
  if (currentPage==='page-dashboard') renderDashboard();
}
async function deleteProg(id) {
  const progs = await DB.getPrograms();
  const p = progs.find(x=>x.id===id); if(!p) return;
  if (!confirm('Supprimer "'+p.name+'" ?')) return;
  await DB.deleteProgram(id); renderPrograms(); toast('Supprimé','info');
}

// ── DAY CRUD ──
let editingDayExercises = [];
let editingDayWeekdays = [];
let editingDayWarmup = [];

function addDayWarmup() {
  var input = document.getElementById('day-warmup-input');
  var val = input.value.trim();
  if (!val) return;
  editingDayWarmup.push(val);
  input.value = '';
  renderDayWarmupList();
}

function renderDayWarmupList() {
  var el = document.getElementById('day-warmup-list');
  if (!el) return;
  el.innerHTML = editingDayWarmup.map(function(item, i) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-raised);border-radius:6px;border:1px solid var(--line-soft)">' +
      '<span style="flex:1;font-size:12px">' + esc(item) + '</span>' +
      '<button class="day-ex-remove" onclick="editingDayWarmup.splice('+i+',1);renderDayWarmupList()">✕</button>' +
    '</div>';
  }).join('');
} // jours de la semaine sélectionnés [0-6]

function initWeekdayBubbles() {
  document.querySelectorAll('#day-weekdays .weekday-bubble').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var day = parseInt(btn.dataset.day);
      btn.classList.toggle('selected');
      if (btn.classList.contains('selected')) {
        if (editingDayWeekdays.indexOf(day) === -1) editingDayWeekdays.push(day);
      } else {
        editingDayWeekdays = editingDayWeekdays.filter(function(d){return d!==day;});
      }
    });
  });
}

function setWeekdayBubbles(days) {
  editingDayWeekdays = days || [];
  document.querySelectorAll('#day-weekdays .weekday-bubble').forEach(function(btn) {
    var day = parseInt(btn.dataset.day);
    btn.classList.toggle('selected', editingDayWeekdays.indexOf(day) > -1);
  });
}

function openNewDay(progId) {
  document.getElementById('modal-day-title').textContent = 'Nouveau jour';
  document.getElementById('day-name').value = '';
  document.getElementById('day-edit-id').value = '';
  document.getElementById('day-prog-id').value = progId;
  editingDayExercises = [];
  setWeekdayBubbles([]);
  editingDayWarmup = [];
  renderDayWarmupList();
  renderDayExList();
  openModal('modal-day');
  setTimeout(()=>document.getElementById('day-name').focus(),150);
}

function openEditDay(progId, dayId) {
  const run = async () => {
    const progs = await DB.getPrograms();
    const p = progs.find(x=>x.id===progId); if(!p) return;
    const day = (p.days||[]).find(d=>d.id===dayId); if(!day) return;
    document.getElementById('modal-day-title').textContent = 'Modifier le jour';
    document.getElementById('day-name').value = day.name;
    document.getElementById('day-edit-id').value = dayId;
    document.getElementById('day-prog-id').value = progId;
    editingDayExercises = JSON.parse(JSON.stringify(day.exercises||[]));
    setWeekdayBubbles(day.weekdays || []);
    editingDayWarmup = day.warmup ? JSON.parse(JSON.stringify(day.warmup)) : [];
    renderDayWarmupList();
    renderDayExList();
    openModal('modal-day');
  }; run();
}

function renderDayExList() {
  const el = document.getElementById('day-ex-list');
  if (!editingDayExercises.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--ink-faint);padding:8px 0">Aucun exercice</p>';
    return;
  }
  el.innerHTML = editingDayExercises.map((ex,i) => {
    var isCardio = (ex.muscle === 'Cardio');
    var inputsHTML = '';
    if (isCardio) {
      inputsHTML = `
        <div class="day-ex-inputs">
          <div class="mini-field"><div class="mini-label">Durée (min)</div><input type="number" class="mini-input" value="${ex.duration||30}" min="1" onchange="editingDayExercises[${i}].duration=+this.value"/></div>
          <div class="mini-field"><div class="mini-label">Vitesse km/h</div><input type="number" class="mini-input" value="${ex.vitesse||''}" min="0" step="0.5" onchange="editingDayExercises[${i}].vitesse=+this.value" placeholder="—"/></div>
          <div class="mini-field"><div class="mini-label">Inclinaison %</div><input type="number" class="mini-input" value="${ex.inclinaison||''}" min="0" step="0.5" onchange="editingDayExercises[${i}].inclinaison=+this.value" placeholder="—"/></div>
        </div>`;
    } else {
      inputsHTML = `
        <div class="day-ex-inputs">
          <div class="mini-field"><div class="mini-label">Séries</div><input type="number" class="mini-input" value="${ex.sets||4}" min="1" max="20" onchange="editingDayExercises[${i}].sets=+this.value"/></div>
          <div class="mini-field"><div class="mini-label">Reps</div><input type="text" class="mini-input" value="${ex.repsTarget||'8-12'}" style="width:70px" onchange="editingDayExercises[${i}].repsTarget=this.value"/></div>
          <div class="mini-field"><div class="mini-label">Repos(s)</div><input type="number" class="mini-input" value="${ex.restSec||120}" min="0" step="15" onchange="editingDayExercises[${i}].restSec=+this.value"/></div>
        </div>`;
    }
    return `
    <div class="day-ex-item" data-idx="${i}">
      <div class="day-ex-handle" title="Glisser pour réorganiser">⠿</div>
      <div class="day-ex-infos">
        <div class="day-ex-nm">${esc(ex.name)}</div>
        <div class="day-ex-ms">${esc(ex.muscle)}</div>
        ${inputsHTML}
        <div class="day-ex-note-wrap">
          <input type="text" class="day-ex-note" placeholder="Note / commentaire…" value="${ex.note||''}" onchange="editingDayExercises[${i}].note=this.value"/>
        </div>
      </div>
      <button class="day-ex-remove" onclick="editingDayExercises.splice(${i},1);renderDayExList()">✕</button>
    </div>`;
  }).join('');
  initDayExDragDrop();
}

function initDayExDragDrop() {
  var container = document.getElementById('day-ex-list');
  var items = container.querySelectorAll('.day-ex-item');
  var dragIdx = -1;

  items.forEach(function(item) {
    var handle = item.querySelector('.day-ex-handle');
    if (!handle) return;

    // TOUCH
    handle.addEventListener('touchstart', function(e) {
      e.preventDefault();
      dragIdx = parseInt(item.dataset.idx);
      item.classList.add('dragging');
    }, {passive:false});

    handle.addEventListener('touchmove', function(e) {
      e.preventDefault();
      var touch = e.touches[0];
      var el = document.elementFromPoint(touch.clientX, touch.clientY);
      var over = el ? el.closest('.day-ex-item') : null;
      if (over && over !== item) {
        var overIdx = parseInt(over.dataset.idx);
        if (overIdx !== dragIdx) {
          swapDayExAnimated(dragIdx, overIdx);
          dragIdx = overIdx;
        }
      }
    }, {passive:false});

    handle.addEventListener('touchend', function() {
      item.classList.remove('dragging');
      dragIdx = -1;
    });

    // MOUSE
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dragIdx = parseInt(item.dataset.idx);
      item.classList.add('dragging');
      function onMove(ev) {
        var el = document.elementFromPoint(ev.clientX, ev.clientY);
        var over = el ? el.closest('.day-ex-item') : null;
        if (over && over !== item) {
          var overIdx = parseInt(over.dataset.idx);
          if (overIdx !== dragIdx) {
            swapDayExAnimated(dragIdx, overIdx);
            dragIdx = overIdx;
          }
        }
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        dragIdx = -1;
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function swapDayExAnimated(fromIdx, toIdx) {
  // Swap dans le tableau
  var temp = editingDayExercises[fromIdx];
  editingDayExercises[fromIdx] = editingDayExercises[toIdx];
  editingDayExercises[toIdx] = temp;
  // Re-render
  renderDayExList();
  // Ajouter animation sur l'item déplacé
  var container = document.getElementById('day-ex-list');
  var items = container.querySelectorAll('.day-ex-item');
  var movedItem = items[toIdx];
  if (movedItem) {
    var animClass = toIdx > fromIdx ? 'move-down' : 'move-up';
    movedItem.classList.add(animClass);
    setTimeout(function() { movedItem.classList.remove(animClass); }, 260);
  }
}

function moveDayEx(index, direction) {
  var newIdx = index + direction;
  if (newIdx < 0 || newIdx >= editingDayExercises.length) return;
  var temp = editingDayExercises[index];
  editingDayExercises[index] = editingDayExercises[newIdx];
  editingDayExercises[newIdx] = temp;
  renderDayExList();
}

async function saveDay() {
  const name = document.getElementById('day-name').value.trim();
  const dayId = document.getElementById('day-edit-id').value;
  const progId = document.getElementById('day-prog-id').value;
  if (!name) { toast('Nom obligatoire','error'); return; }
  const progs = await DB.getPrograms();
  const p = progs.find(x=>x.id===progId); if(!p) return;
  const days = JSON.parse(JSON.stringify(p.days||[]));
  if (dayId) {
    const idx = days.findIndex(d=>d.id===dayId);
    if (idx>-1) days[idx] = {...days[idx], name, exercises:editingDayExercises, weekdays:editingDayWeekdays, warmup:editingDayWarmup};
  } else {
    days.push({id:crypto.randomUUID(), name, exercises:editingDayExercises, weekdays:editingDayWeekdays, warmup:editingDayWarmup});
  }
  await DB.updateProgram(progId, {days});
  closeModal('modal-day'); renderPrograms();
  toast('Jour "'+name+'" sauvegardé','success');
}

// ── DAY PICKER ──
function openDayPicker() {
  document.getElementById('day-picker-search').value = '';
  document.getElementById('day-picker-quick').classList.add('hidden');
  renderDayPickerList('');
  openModal('modal-day-picker');
  setTimeout(()=>document.getElementById('day-picker-search').focus(),150);
}
async function renderDayPickerList(q) {
  const exs = (await DB.getExercises()).filter(e =>
    e.name.toLowerCase().includes(q.toLowerCase()) ||
    e.muscle.toLowerCase().includes(q.toLowerCase())
  );
  const quick = document.getElementById('day-picker-quick');
  const exact = exs.some(e=>e.name.toLowerCase()===q.toLowerCase());
  if (q.length>=2 && !exact) { quick.classList.remove('hidden'); document.getElementById('day-picker-qname').textContent=q; }
  else quick.classList.add('hidden');
  const el = document.getElementById('day-picker-list');
  if (!exs.length) { el.innerHTML='<p class="empty-state">Aucun résultat</p>'; return; }
  el.innerHTML = exs.map(e=>`
    <div class="picker-item" onclick="addExToDay('${e.id}','${e.name.replace(/'/g,"\\'")}','${e.muscle}')">
      <div><div class="picker-nm">${e.name}</div><div class="picker-ms">${e.muscle}</div></div>
      <span class="picker-add">+</span>
    </div>`).join('');
}
function addExToDay(id, name, muscle) {
  if (editingDayExercises.some(e=>e.id===id)) { toast('Déjà ajouté','info'); return; }
  editingDayExercises.push({id, name, muscle, sets:4, repsTarget:'8-12', restSec:120});
  closeModal('modal-day-picker'); renderDayExList(); toast(name+' ajouté','success');
}
async function dayPickerCreateAdd() {
  const name = document.getElementById('day-picker-search').value.trim();
  const muscle = document.getElementById('day-picker-muscle').value;
  if (!name) return;
  const exs = await DB.getExercises();
  const existing = exs.find(e=>e.name.toLowerCase()===name.toLowerCase());
  if (existing) { addExToDay(existing.id, existing.name, existing.muscle); return; }
  try {
    const newEx = await DB.addExercise({name, muscle, description:''});
    addExToDay(newEx.id, newEx.name, newEx.muscle);
  } catch(e) { toast(e.message,'error'); }
}

// ── WORKOUT ENGINE ──
let wkState = null;

async function startWorkout(progId, dayId) {
  const progs = await DB.getPrograms();
  const p = progs.find(x=>x.id===progId); if(!p) return;
  const day = (p.days||[]).find(d=>d.id===dayId); if(!day) return;

  // Chercher la dernière séance avec le même nom de jour (match strict au début)
  const sessions = await DB.getSessions();
  const dayNameLower = day.name.toLowerCase();
  const lastSame = sessions.find(function(s) {
    if (!s.name) return false;
    var sNameLower = s.name.toLowerCase();
    return sNameLower.startsWith(dayNameLower) || sNameLower === dayNameLower;
  });

  if (lastSame) {
    // Afficher le récap de la dernière séance identique
    var html = '<div style="margin-bottom:16px;font-size:13px;color:var(--ink-faint)">Dernière séance <strong style="color:var(--ink)">' + day.name + '</strong> — ' + fDate(lastSame.date) + '</div>';
    (lastSame.exercises||[]).forEach(function(ex) {
      html += '<div class="sv-ex" style="margin-bottom:12px">';
      html += '<div class="sv-ex-head">' + ex.name + ' <span class="muscle-badge">' + (ex.muscle||'') + '</span></div>';
      html += '<table class="sv-table"><thead><tr><th>#</th><th>Poids</th><th>Reps</th></tr></thead><tbody>';
      (ex.sets||[]).forEach(function(st, i) {
        html += '<tr><td>' + (i+1) + '</td><td>' + (st.weight ? st.weight+' kg' : '—') + '</td><td>' + (st.reps||'—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    });
    html += '<div style="display:flex;gap:10px;margin-top:16px">';
    html += '<button class="btn-ghost" style="flex:1" onclick="closeModal(\'modal-last-session\')">Annuler</button>';
    html += '<button class="btn-primary" style="flex:1" onclick="closeModal(\'modal-last-session\');launchWorkout(\'' + progId + '\',\'' + dayId + '\')">' + ico('play') + ' Lancer la séance</button>';
    html += '</div>';
    document.getElementById('last-session-body').innerHTML = html;
    document.getElementById('last-session-title').textContent = '';
    document.getElementById('last-session-title').innerHTML = ico('clipboard') + ' Dernière séance : ' + esc(day.name);
    openModal('modal-last-session');
  } else {
    // Pas de séance précédente, lancer directement
    launchWorkout(progId, dayId);
  }
}

async function launchWorkout(progId, dayId) {
  const progs = await DB.getPrograms();
  const p = progs.find(x=>x.id===progId); if(!p) return;
  const day = (p.days||[]).find(d=>d.id===dayId); if(!day) return;

  // Vérifier s'il y a une séance en cours sauvegardée
  var savedKey = 'wk_session_' + getUserId();
  var saved = localStorage.getItem(savedKey);
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      if (parsed.dayId === dayId && parsed.exercises) {
        wkState = parsed;
        wkState.startTs = Date.now() - (parsed.elapsedSec||0)*1000;
        wkState.timer = null;
      }
    } catch(e) {}
  }

  if (!wkState || wkState.dayId !== dayId) {
    // Séparer les exercices muscu des exercices cardio
    var muscuExercises = (day.exercises||[]).filter(function(ex) { return ex.muscle !== 'Cardio'; });
    var cardioExercises = (day.exercises||[]).filter(function(ex) { return ex.muscle === 'Cardio'; });

    // Notifier les exercices cardio prévus
    if (cardioExercises.length > 0) {
      var cardioNames = cardioExercises.map(function(ex) { return ex.name; }).join(', ');
      setTimeout(function() {
        toast(ico('fire')+' Cardio prévu aujourd\'hui : ' + cardioNames, 'info', 5000);
      }, 1500);
    }

    wkState = {
      progId, dayId, dayName: day.name, progName: p.name,
      startTs: Date.now(), timer: null,
      _dayWarmup: day.warmup || [],
      exercises: muscuExercises.map(ex => ({
        id:ex.id, name:ex.name, muscle:ex.muscle, restSec:ex.restSec||120, note:ex.note||'',
        sets: Array.from({length:ex.sets||4}, ()=>({weight:'',reps:'',rpe:'',done:false,restTimer:null,restLeft:0,doneTs:0}))
      }))
    };
  }

  document.getElementById('wk-day-name').textContent = day.name;
  document.getElementById('wk-prog-name').textContent = p.name;
  document.getElementById('wk-chrono').textContent = '00:00';
  renderWorkoutBody();
  document.getElementById('wk-screen').classList.remove('hidden');

  wkState.timer = setInterval(() => {
    const e = Math.floor((Date.now()-wkState.startTs)/1000);
    document.getElementById('wk-chrono').textContent = fDur(e);
    // Auto-save toutes les 5 secondes
    if (e % 5 === 0) saveWorkoutToLocal();
  }, 1000);
}

function saveWorkoutToLocal() {
  if (!wkState) return;
  var key = 'wk_session_' + getUserId();
  var toSave = JSON.parse(JSON.stringify(wkState));
  toSave.elapsedSec = Math.floor((Date.now()-wkState.startTs)/1000);
  // Supprimer les timers (non sérialisables)
  toSave.timer = null;
  toSave.exercises.forEach(function(ex) {
    ex.sets.forEach(function(s) { s.restTimer = null; });
  });
  localStorage.setItem(key, JSON.stringify(toSave));
}

function clearWorkoutLocal() {
  var key = 'wk_session_' + getUserId();
  localStorage.removeItem(key);
}

function restoreWorkoutIfExists() {
  var uid = getUserId();
  if (!uid) return;
  var key = 'wk_session_' + uid;
  var saved = localStorage.getItem(key);
  if (!saved) return;

  try {
    var parsed = JSON.parse(saved);
    if (!parsed || !parsed.exercises || !parsed.dayName) return;

    // Restaurer le wkState
    wkState = parsed;
    wkState.startTs = Date.now() - (parsed.elapsedSec || 0) * 1000;
    wkState.timer = null;

    // Nettoyer les restTimers (non sérialisables)
    wkState.exercises.forEach(function(ex) {
      ex.sets.forEach(function(s) { s.restTimer = null; });
    });

    // Afficher le workout screen
    document.getElementById('wk-day-name').textContent = wkState.dayName;
    document.getElementById('wk-prog-name').textContent = wkState.progName;
    renderWorkoutBody();
    document.getElementById('wk-screen').classList.remove('hidden');

    // Relancer le chrono
    wkState.timer = setInterval(function() {
      var e = Math.floor((Date.now() - wkState.startTs) / 1000);
      document.getElementById('wk-chrono').textContent = fDur(e);
      if (e % 5 === 0) saveWorkoutToLocal();
    }, 1000);

    toast(ico('muscle')+' Séance en cours restaurée', 'info', 2000);
  } catch(e) {
    // Données corrompues, on supprime
    localStorage.removeItem(key);
  }
}

function renderWorkoutBody() {
  if (!wkState) return;
  document.getElementById('wk-body').innerHTML =
    renderWarmupSection() +
    wkState.exercises.map((ex,ei) => {
      return `
      <div class="wk-ex-block">
        <div class="wk-ex-head">
          <input type="text" class="wk-ex-name-input" value="${esc(ex.name)}" onchange="wkState.exercises[${ei}].name=this.value;saveWorkoutToLocal()" title="Clic pour renommer (cette séance uniquement)"/>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <span class="muscle-badge">${esc(ex.muscle)}</span>
            <button class="btn-ghost btn-sm" onclick="showExComment(${ei})" style="font-size:11px;padding:4px 8px">${ico('comment')}</button>
            <button class="btn-ghost btn-sm" onclick="markExDone(${ei})" style="font-size:11px;padding:4px 8px;color:var(--green)">${ico('check')}</button>
          </div>
        </div>
        ${ex.note?'<div style="padding:6px 14px;font-size:12px;color:var(--ink-faint);font-style:italic;border-bottom:1px solid var(--line-soft)">'+ico('note')+' '+esc(ex.note)+'</div>':''}
        <div id="wk-ex-comment-${ei}" class="hidden" style="padding:8px 14px;border-bottom:1px solid var(--line-soft)">
          <input type="text" id="wk-comment-input-${ei}" placeholder="Commentaire (ex: mettre 5kg de plus...)" style="font-size:12px;padding:8px 10px" onchange="wkState.exercises[${ei}].endComment=this.value"/>
        </div>
        <div style="padding:6px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line-soft)">
          <label style="font-size:11px;color:var(--ink-faint);display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" style="accent-color:var(--green);width:16px;height:16px" onchange="wkState.exercises[${ei}].unilateral=this.checked"/> Unilatéral
          </label>
        </div>
        <div class="wk-sets" id="wk-sets-${ei}">
          ${ex.sets.map((s,si) => renderSetHTML(ei,si,s,ex.restSec)).join('')}
          <div class="add-set-row" onclick="wkAddSet(${ei})">+ Ajouter une série</div>
        </div>
      </div>`;
    }).join('');
}

function renderSetHTML(ei, si, set, restSec) {
  if (set.done && set.restLeft > 0) {
    var pauseIcon = set.restPaused ? ico('play') : ico('pause');
    var pauseTitle = set.restPaused ? 'Reprendre' : 'Pause';
    return `<div class="wk-set-row" id="sr-${ei}-${si}">
      <div class="set-num done">${si+1}</div>
      <div class="set-done-info">${set.weight||'—'} kg × ${set.reps||'—'}${set.rpe?' · RPE '+set.rpe:''}</div>
      <div class="rest-badge${set.restPaused?' paused':''}"><span class="rest-dot${set.restPaused?' paused':''}"></span> ${fDur(set.restLeft)}</div>
      <button class="adj" onclick="wkPauseTimer(${ei},${si})" title="${pauseTitle}" style="margin-left:4px">${pauseIcon}</button>
      <button class="adj" onclick="wkStopTimer(${ei},${si})" title="Stop" style="margin-left:2px;color:var(--danger)">✕</button>
    </div>`;
  }
  if (set.done) {
    return `<div class="wk-set-row" id="sr-${ei}-${si}">
      <div class="set-num done">${si+1}</div>
      <div class="set-done-info">${set.weight||'—'} kg × ${set.reps||'—'}${set.rpe?' · RPE '+set.rpe:''}</div>
      <button class="btn-ghost btn-sm" onclick="undoSet(${ei},${si},${restSec})" style="font-size:11px;padding:4px 8px" title="Modifier">${ico('undo')}</button>
      <span style="color:var(--green-bright);font-size:16px">${ico('check')}</span>
    </div>`;
  }
  const lastDone = wkState.exercises[ei].sets.reduce((a,s,i)=>s.done?i:a,-1);
  const isNext = si === lastDone+1;
  return `<div class="wk-set-row" id="sr-${ei}-${si}" style="${isNext?'background:rgba(63,166,107,.06);border-radius:8px;padding:6px 4px;':''}">
    <div class="set-num">${si+1}</div>
    <div class="wk-input-grp">
      <button class="adj" onclick="wkAdj(${ei},${si},'weight',-2.5)">−</button>
      <input class="wk-num" id="wi-${ei}-${si}" type="number" min="0" step="0.5" value="${set.weight||''}" placeholder="kg" oninput="wkState.exercises[${ei}].sets[${si}].weight=this.value;saveWorkoutToLocal()"/>
      <button class="adj" onclick="wkAdj(${ei},${si},'weight',2.5)">+</button>
    </div>
    <div class="wk-input-grp">
      <button class="adj" onclick="wkAdj(${ei},${si},'reps',-1)">−</button>
      <input class="wk-num" id="ri-${ei}-${si}" type="number" min="0" step="1" value="${set.reps||''}" placeholder="reps" oninput="wkState.exercises[${ei}].sets[${si}].reps=this.value;saveWorkoutToLocal()"/>
      <button class="adj" onclick="wkAdj(${ei},${si},'reps',1)">+</button>
    </div>
    <button class="done-set-btn" onclick="wkDoneSet(${ei},${si},${restSec})">✓</button>
  </div>`;
}

var DEFAULT_WARMUP = [];

function renderWarmupSection() {
  if (!wkState) return '';
  // Utiliser l'échauffement personnalisé du jour si disponible
  if (!wkState.warmup) {
    if (wkState._dayWarmup && wkState._dayWarmup.length > 0) {
      wkState.warmup = wkState._dayWarmup.map(function(label) { return {label:label, done:false}; });
    } else {
      // Pas d'échauffement par défaut — l'user doit les configurer dans son programme
      return '';
    }
  }
  if (wkState.warmup.length === 0) return '';
  return '<div class="warmup-box">' +
    '<div class="warmup-title">' + ico('bolt') + ' Échauffement</div>' +
    '<div class="warmup-checklist">' +
    wkState.warmup.map(function(item, i) {
      var checked = item.done ? ' checked' : '';
      var doneClass = item.done ? ' style="text-decoration:line-through;opacity:.5"' : '';
      return '<label class="warmup-item"' + doneClass + '>' +
        '<input type="checkbox"' + checked + ' onchange="toggleWarmup(' + i + ',this.checked)" style="accent-color:var(--green);width:18px;height:18px;flex-shrink:0"/>' +
        '<span>' + esc(item.label) + '</span>' +
      '</label>';
    }).join('') +
    '</div></div>';
}

function toggleWarmup(idx, checked) {
  if (wkState && wkState.warmup && wkState.warmup[idx]) {
    wkState.warmup[idx].done = checked;
    // Re-render juste le style
    var labels = document.querySelectorAll('.warmup-item');
    if (labels[idx]) {
      labels[idx].style.textDecoration = checked ? 'line-through' : 'none';
      labels[idx].style.opacity = checked ? '.5' : '1';
    }
  }
}

function markExDone(ei) {
  if (!wkState || !wkState.exercises[ei]) return;
  // Toggle : si déjà completed, on dévalide
  var isCompleted = wkState.exercises[ei].completed;
  wkState.exercises[ei].completed = !isCompleted;
  saveWorkoutToLocal();

  var block = document.querySelectorAll('.wk-ex-block')[ei];
  if (!isCompleted) {
    toast(ico('check')+' ' + esc(wkState.exercises[ei].name) + ' terminé', 'success', 1500);
    if (block) { block.style.opacity = '0.5'; block.style.borderColor = 'var(--green)'; }
  } else {
    toast(ico('undo')+' ' + esc(wkState.exercises[ei].name) + ' réouvert', 'info', 1500);
    if (block) { block.style.opacity = '1'; block.style.borderColor = ''; }
  }
}

function showExComment(ei) {
  var el = document.getElementById('wk-ex-comment-' + ei);
  if (el) {
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
      var input = document.getElementById('wk-comment-input-' + ei);
      if (input) input.focus();
    }
  }
}

function undoSet(ei, si, restSec) {
  var set = wkState.exercises[ei].sets[si];
  // Arrêter le timer repos si actif
  if (set.restTimer) { clearInterval(set.restTimer); set.restTimer = null; }
  // Remettre en mode non-validé
  set.done = false;
  set.restLeft = 0;
  set.doneTs = 0;
  set.restPaused = false;
  saveWorkoutToLocal();
  // Re-render la ligne
  var row = document.getElementById('sr-'+ei+'-'+si);
  if (row) row.outerHTML = renderSetHTML(ei, si, set, restSec);
  toast(ico('undo')+' Série réouverte — corrige tes valeurs', 'info', 1500);
}

function wkAdj(ei, si, field, delta) {
  const set = wkState.exercises[ei].sets[si];
  const cur = parseFloat(set[field]) || 0;
  const val = Math.max(0, cur + delta);
  set[field] = field==='weight' ? (val%1===0?val.toFixed(0):val.toFixed(1)) : String(Math.round(val));
  const inp = document.getElementById((field==='weight'?'wi':'ri')+'-'+ei+'-'+si);
  if (inp) inp.value = set[field];
  saveWorkoutToLocal();
}

function wkDoneSet(ei, si, restSec) {
  const set = wkState.exercises[ei].sets[si];
  const wi = document.getElementById('wi-'+ei+'-'+si);
  const ri = document.getElementById('ri-'+ei+'-'+si);
  if (wi) set.weight = wi.value;
  if (ri) set.reps = ri.value;
  set.done = true; set.doneTs = Date.now(); set.restLeft = restSec;
  set.restPaused = false;
  saveWorkoutToLocal();

  // Stop any other running timer first
  wkState.exercises.forEach(function(ex, exi) {
    ex.sets.forEach(function(s, ssi) {
      if (s.restTimer && !(exi===ei && ssi===si)) {
        clearInterval(s.restTimer); s.restTimer = null; s.restLeft = 0;
        var oldRow = document.getElementById('sr-'+exi+'-'+ssi);
        if (oldRow) oldRow.outerHTML = renderSetHTML(exi, ssi, s, ex.restSec);
      }
    });
  });

  toast('✓ Série validée', 'success', 1500);

  // Rest timer
  set.restTimer = setInterval(function() {
    if (set.restPaused) return;
    set.restLeft = Math.max(0, restSec - Math.floor((Date.now()-set.doneTs)/1000));
    var row = document.getElementById('sr-'+ei+'-'+si);
    if (row) row.outerHTML = renderSetHTML(ei, si, set, restSec);
    if (set.restLeft <= 0) {
      clearInterval(set.restTimer); set.restTimer = null;
      if (navigator.vibrate) navigator.vibrate([150,80,150]);
      toast(ico('timer')+' Repos terminé !', 'success', 2500);
    }
  }, 1000);

  var row = document.getElementById('sr-'+ei+'-'+si);
  if (row) row.outerHTML = renderSetHTML(ei, si, set, restSec);
}

function wkPauseTimer(ei, si) {
  var set = wkState.exercises[ei].sets[si];
  if (!set.restTimer) return;
  if (set.restPaused) {
    // Resume: adjust doneTs to account for paused time
    set.doneTs = Date.now() - ((wkState.exercises[ei].restSec - set.restLeft) * 1000);
    set.restPaused = false;
    toast(ico('play')+' Repos repris', 'info', 1200);
  } else {
    set.restPaused = true;
    toast(ico('pause')+' Repos en pause', 'info', 1200);
  }
  var row = document.getElementById('sr-'+ei+'-'+si);
  if (row) row.outerHTML = renderSetHTML(ei, si, set, wkState.exercises[ei].restSec);
}

function wkStopTimer(ei, si) {
  var set = wkState.exercises[ei].sets[si];
  if (set.restTimer) { clearInterval(set.restTimer); set.restTimer = null; }
  set.restLeft = 0;
  var row = document.getElementById('sr-'+ei+'-'+si);
  if (row) row.outerHTML = renderSetHTML(ei, si, set, wkState.exercises[ei].restSec);
}

function wkAddSet(ei) {
  const ex = wkState.exercises[ei];
  const last = ex.sets.slice(-1)[0] || {};
  ex.sets.push({weight:last.weight||'',reps:last.reps||'',rpe:'',done:false,restTimer:null,restLeft:0,doneTs:0});
  const container = document.getElementById('wk-sets-'+ei);
  if (container) {
    const newSi = ex.sets.length-1;
    const addRow = container.querySelector('.add-set-row');
    const div = document.createElement('div');
    div.innerHTML = renderSetHTML(ei, newSi, ex.sets[newSi], ex.restSec);
    container.insertBefore(div.firstElementChild, addRow);
  }
}

function endWorkout() {
  if (!wkState) return;
  clearInterval(wkState.timer);
  wkState.exercises.forEach(ex => ex.sets.forEach(s => { if(s.restTimer) clearInterval(s.restTimer); }));
  const elapsed = Math.floor((Date.now()-wkState.startTs)/1000);
  showRecap(elapsed);
}

// ── RECAP ──
let pendingSession = null;

function showRecap(elapsedSec) {
  const exs = wkState.exercises.map(ex => ({
    name: ex.name, muscle: ex.muscle,
    sets: ex.sets.filter(s=>s.done&&(parseFloat(s.weight)||0)>0)
      .map(s=>({weight:s.weight, reps:s.reps, rpe:s.rpe||''}))
  })).filter(ex=>ex.sets.length>0);

  const totVol = exs.reduce((a,ex)=>a+ex.sets.reduce((b,s)=>b+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0),0);
  const totSets = exs.reduce((a,ex)=>a+ex.sets.length, 0);

  document.getElementById('recap-time').textContent = fDur(elapsedSec);
  let html = `<div class="recap-banner">
    <div class="recap-fig"><span class="recap-fig-val">${fW(totVol)}</span><span class="recap-fig-lbl">Volume</span></div>
    <div class="recap-fig"><span class="recap-fig-val">${fDur(elapsedSec)}</span><span class="recap-fig-lbl">Durée</span></div>
    <div class="recap-fig"><span class="recap-fig-val">${totSets}</span><span class="recap-fig-lbl">Séries</span></div>
  </div>`;

  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);margin-bottom:10px">Détail</div>';
  exs.forEach(ex => {
    html += `<div class="sv-ex">
      <div class="sv-ex-head">${esc(ex.name)} <span class="muscle-badge">${ex.muscle}</span></div>
      <table class="sv-table"><thead><tr><th>#</th><th>Poids</th><th>Reps</th><th>RPE</th><th>Vol.</th></tr></thead>
      <tbody>${ex.sets.map((s,i)=>{
        const v=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0);
        return `<tr><td>${i+1}</td><td>${s.weight} kg</td><td>${s.reps}</td><td>${s.rpe||'—'}</td><td>${fW(v)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  });

  document.getElementById('recap-body').innerHTML = html;
  pendingSession = {
    name: wkState.dayName + ' — ' + wkState.progName,
    date: new Date().toISOString().split('T')[0],
    duration_sec: elapsedSec,
    notes: '',
    exercises: exs
  };
  openModal('modal-recap');
}

async function saveRecap() {
  if (!pendingSession) return;
  var comment = document.getElementById('recap-comment').value.trim();
  if (comment) pendingSession.notes = comment;
  try {
    await DB.addSession(pendingSession);
    toast(ico('muscle')+' Séance sauvegardée !', 'success');
  } catch(e) { toast('Erreur: '+e.message, 'error'); return; }
  pendingSession = null;
  document.getElementById('recap-comment').value = '';
  closeModal('modal-recap');
  document.getElementById('wk-screen').classList.add('hidden');
  clearWorkoutLocal();
  wkState = null;
  navigate('page-history');
}

async function discardRecap() {
  var ok = await modalConfirm('Abandonner ?', 'La séance ne sera pas sauvegardée.');
  if (!ok) return;
  pendingSession = null;
  closeModal('modal-recap');
  document.getElementById('wk-screen').classList.add('hidden');
  clearWorkoutLocal();
  wkState = null;
}

// ── EVENT LISTENERS (programs) ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-prog').addEventListener('click', openNewProg);
  document.getElementById('btn-save-prog').addEventListener('click', saveProg);
  document.getElementById('btn-day-add-ex').addEventListener('click', openDayPicker);
  document.getElementById('btn-save-day').addEventListener('click', saveDay);
  initWeekdayBubbles();
  document.getElementById('day-picker-search').addEventListener('input', e => renderDayPickerList(e.target.value));
  document.getElementById('day-picker-search').addEventListener('keydown', e => { if(e.key==='Enter') dayPickerCreateAdd(); });
  document.getElementById('btn-day-picker-create').addEventListener('click', dayPickerCreateAdd);
  document.getElementById('btn-end-workout').addEventListener('click', async () => {
    var ok = await modalConfirm('Terminer la séance ?', 'Ton récap sera affiché et tu pourras sauvegarder.');
    if (ok) endWorkout();
  });
  document.getElementById('btn-quit-workout').addEventListener('click', async () => {
    var ok = await modalConfirm('Quitter la séance ?', 'Ta progression est sauvegardée, tu pourras reprendre plus tard.');
    if (ok) {
      clearInterval(wkState.timer);
      wkState.exercises.forEach(ex => ex.sets.forEach(s => { if(s.restTimer) clearInterval(s.restTimer); }));
      saveWorkoutToLocal();
      document.getElementById('wk-screen').classList.add('hidden');
    }
  });
  document.getElementById('btn-recap-save').addEventListener('click', saveRecap);
  document.getElementById('btn-recap-discard').addEventListener('click', discardRecap);
});
