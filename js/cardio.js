/* ============================================================
   FITNESSTRACKER — Cardio : Course / Marche / Calories
   ============================================================ */

// MET values (Metabolic Equivalent of Task)
// Calories = MET × poids(kg) × durée(h)
var CARDIO_METS = {
  'marche_lente': 2.5,      // 3-4 km/h
  'marche_rapide': 4.3,     // 5-6 km/h
  'marche_sportive': 5.0,   // 7 km/h
  'course_lente': 7.0,      // 7-8 km/h
  'course_moderee': 9.8,    // 9-10 km/h
  'course_rapide': 11.5,    // 11-12 km/h
  'course_intense': 14.5,   // 13-15 km/h
  'fractionne': 12.0,       // HIIT
  'tapis_plat': 8.0,        // tapis 0% inclinaison
  'tapis_incline': 10.0,    // tapis 5-10%
  'tapis_forte_incl': 12.5, // tapis >10%
};

function calcCalories(type, poidsKg, durationMin, vitesse, inclinaison) {
  var met = CARDIO_METS[type] || 7.0;

  // Ajuster le MET si on a la vitesse
  if (vitesse) {
    if (vitesse <= 4) met = 2.5;
    else if (vitesse <= 6) met = 4.3;
    else if (vitesse <= 8) met = 7.0;
    else if (vitesse <= 10) met = 9.8;
    else if (vitesse <= 12) met = 11.5;
    else met = 14.5;
  }

  // Ajuster pour l'inclinaison (tapis)
  if (inclinaison && inclinaison > 0) {
    met += inclinaison * 0.3; // +0.3 MET par % d'inclinaison
  }

  var durationH = durationMin / 60;
  return Math.round(met * poidsKg * durationH);
}

// ── RENDER PAGE CARDIO ──
async function renderCardio() {
  var entries = await getCardioEntries();
  renderCardioHistory(entries);
}

async function getCardioEntries() {
  var sessions = await DB.getSessions();
  return sessions.filter(function(s) { return s.cardio === true; });
}

function renderCardioHistory(entries) {
  var el = document.getElementById('cardio-history');
  if (!el) return;
  if (!entries.length) {
    el.innerHTML = '<p class="empty-state">Aucune activité cardio enregistrée</p>';
    return;
  }
  el.innerHTML = entries.map(function(e) {
    return '<div class="cardio-card">' +
      '<div class="cardio-card-head">' +
        '<span class="cardio-card-name">' + esc(e.name) + '</span>' +
        '<span class="cardio-card-date">' + fDate(e.date) + '</span>' +
      '</div>' +
      '<div class="cardio-card-stats">' +
        '<div class="cardio-stat"><div class="cardio-stat-val">' + (e.calories||0) + '</div><div class="cardio-stat-lbl">kcal</div></div>' +
        '<div class="cardio-stat"><div class="cardio-stat-val">' + (e.duration_min||0) + '</div><div class="cardio-stat-lbl">min</div></div>' +
        (e.vitesse ? '<div class="cardio-stat"><div class="cardio-stat-val">' + e.vitesse + '</div><div class="cardio-stat-lbl">km/h</div></div>' : '') +
        (e.inclinaison ? '<div class="cardio-stat"><div class="cardio-stat-val">' + e.inclinaison + '%</div><div class="cardio-stat-lbl">pente</div></div>' : '') +
      '</div>' +
      '<div style="text-align:right;margin-top:8px"><button class="btn-icon" onclick="deleteCardioSession(\'' + e.id + '\')" title="Supprimer">' + ico('trash') + '</button></div>' +
    '</div>';
  }).join('');
}

// ── MODAL AJOUT CARDIO ──
function openCardioModal() {
  document.getElementById('cardio-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('cardio-type').value = 'course_moderee';
  document.getElementById('cardio-duration').value = '';
  document.getElementById('cardio-vitesse').value = '';
  document.getElementById('cardio-inclinaison').value = '';
  document.getElementById('cardio-calories-preview').textContent = '—';
  document.getElementById('cardio-tapis-fields').classList.add('hidden');
  openModal('modal-cardio');
}

function onCardioTypeChange() {
  var type = document.getElementById('cardio-type').value;
  var tapisFields = document.getElementById('cardio-tapis-fields');
  if (type.startsWith('tapis')) {
    tapisFields.classList.remove('hidden');
  } else {
    tapisFields.classList.add('hidden');
  }
  previewCardioCalories();
}

function previewCardioCalories() {
  var type = document.getElementById('cardio-type').value;
  var duration = parseFloat(document.getElementById('cardio-duration').value) || 0;
  var vitesse = parseFloat(document.getElementById('cardio-vitesse').value) || 0;
  var inclinaison = parseFloat(document.getElementById('cardio-inclinaison').value) || 0;

  // Poids de l'user (dernière mensuration ou 70kg par défaut)
  var poids = parseFloat(localStorage.getItem('mt_user_poids')) || 70;

  if (duration > 0) {
    var cal = calcCalories(type, poids, duration, vitesse, inclinaison);
    document.getElementById('cardio-calories-preview').textContent = cal + ' kcal';
  } else {
    document.getElementById('cardio-calories-preview').textContent = '—';
  }
}

async function saveCardio() {
  var date = document.getElementById('cardio-date').value;
  var type = document.getElementById('cardio-type').value;
  var duration = parseFloat(document.getElementById('cardio-duration').value) || 0;
  var vitesse = parseFloat(document.getElementById('cardio-vitesse').value) || 0;
  var inclinaison = parseFloat(document.getElementById('cardio-inclinaison').value) || 0;

  if (!date) { toast('Sélectionne une date', 'error'); return; }
  if (duration <= 0) { toast('Renseigne la durée', 'error'); return; }

  var poids = parseFloat(localStorage.getItem('mt_user_poids')) || 70;
  var calories = calcCalories(type, poids, duration, vitesse, inclinaison);

  var typeLabels = {
    'marche_lente':'Marche lente','marche_rapide':'Marche rapide','marche_sportive':'Marche sportive',
    'course_lente':'Course lente','course_moderee':'Course modérée','course_rapide':'Course rapide',
    'course_intense':'Course intense','fractionne':'Fractionné',
    'tapis_plat':'Tapis plat','tapis_incline':'Tapis incliné','tapis_forte_incl':'Tapis forte inclinaison'
  };

  var session = {
    name: typeLabels[type] || 'Cardio',
    date: date,
    duration_sec: Math.round(duration * 60),
    duration_min: duration,
    notes: '',
    exercises: [],
    cardio: true,
    cardio_type: type,
    vitesse: vitesse || null,
    inclinaison: inclinaison || null,
    calories: calories
  };

  try {
    await DB.addSession(session);
    toast(ico('fire')+' ' + calories + ' kcal enregistrées !', 'success');
    closeModal('modal-cardio');
    if (currentPage === 'page-cardio') renderCardio();
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

// Mettre à jour le poids user depuis les mensurations
async function updateUserPoids() {
  try {
    var data = await DB.getMensurations();
    if (data && data.length > 0 && data[0].poids) {
      localStorage.setItem('mt_user_poids', data[0].poids);
    }
  } catch(e) {}
}

async function deleteCardioSession(id) {
  var ok = await modalConfirm('Supprimer', 'Supprimer cette séance cardio ?');
  if (!ok) return;
  try {
    await DB.deleteSession(id);
    toast(ico('check') + ' Supprimée', 'info');
    renderCardio();
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  var addBtn = document.getElementById('btn-add-cardio');
  if (addBtn) addBtn.addEventListener('click', openCardioModal);

  var saveBtn = document.getElementById('btn-save-cardio');
  if (saveBtn) saveBtn.addEventListener('click', saveCardio);

  var typeSelect = document.getElementById('cardio-type');
  if (typeSelect) typeSelect.addEventListener('change', onCardioTypeChange);

  // Preview calories en temps réel
  ['cardio-duration', 'cardio-vitesse', 'cardio-inclinaison'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', previewCardioCalories);
  });

  // Mettre à jour le poids au boot
  setTimeout(updateUserPoids, 2000);
});
