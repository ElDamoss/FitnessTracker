/* ============================================================
   FITNESSTRACKER — Programmes par défaut
   ============================================================ */

var DEFAULT_PROGRAMS = [
  {
    name: 'Full Body',
    goal: 'Général',
    days: [
      { name: 'Full Body A', weekdays: [1,3,5], exercises: [
        {name:'Squat',muscle:'Jambes',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Développé couché',muscle:'Pectoraux',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Rowing barre',muscle:'Dos',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Développé militaire',muscle:'Épaules',sets:3,repsTarget:'10-12',restSec:90},
        {name:'Curl Biceps',muscle:'Biceps',sets:3,repsTarget:'10-15',restSec:60},
        {name:'Crunch',muscle:'Abdominaux',sets:3,repsTarget:'15-20',restSec:60},
      ]},
      { name: 'Full Body B', weekdays: [2,4], exercises: [
        {name:'Soulevé de terre',muscle:'Dos',sets:4,repsTarget:'6-10',restSec:150},
        {name:'Développé incliné',muscle:'Pectoraux',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Leg press',muscle:'Jambes',sets:4,repsTarget:'10-15',restSec:120},
        {name:'Élévations latérales',muscle:'Épaules',sets:3,repsTarget:'12-15',restSec:60},
        {name:'Dips triceps',muscle:'Triceps',sets:3,repsTarget:'10-12',restSec:90},
        {name:'Gainage',muscle:'Abdominaux',sets:3,repsTarget:'30-60s',restSec:60},
      ]}
    ]
  },
  {
    name: 'Haut du corps / Bas du corps',
    goal: 'Prise de masse',
    days: [
      { name: 'Haut du corps', weekdays: [1,4], exercises: [
        {name:'Développé couché',muscle:'Pectoraux',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Rowing barre',muscle:'Dos',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Développé militaire',muscle:'Épaules',sets:4,repsTarget:'8-12',restSec:90},
        {name:'Tractions',muscle:'Dos',sets:3,repsTarget:'6-10',restSec:120},
        {name:'Curl Biceps',muscle:'Biceps',sets:3,repsTarget:'10-15',restSec:60},
        {name:'Extensions Triceps Poulie Haute',muscle:'Triceps',sets:3,repsTarget:'10-15',restSec:60},
      ]},
      { name: 'Bas du corps', weekdays: [2,5], exercises: [
        {name:'Squat',muscle:'Jambes',sets:4,repsTarget:'8-12',restSec:150},
        {name:'Leg press',muscle:'Jambes',sets:4,repsTarget:'10-15',restSec:120},
        {name:'Leg Curl',muscle:'Jambes',sets:4,repsTarget:'10-15',restSec:90},
        {name:'Leg Extension',muscle:'Jambes',sets:3,repsTarget:'12-15',restSec:90},
        {name:'Hip Thrust',muscle:'Fessiers',sets:4,repsTarget:'10-12',restSec:90},
        {name:'Mollets machine',muscle:'Jambes',sets:4,repsTarget:'12-20',restSec:60},
      ]}
    ]
  },
  {
    name: 'Push / Pull / Legs',
    goal: 'Prise de masse',
    days: [
      { name: 'Push', weekdays: [1,4], exercises: [
        {name:'Développé couché',muscle:'Pectoraux',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Développé incliné',muscle:'Pectoraux',sets:4,repsTarget:'10-12',restSec:120},
        {name:'Développé militaire',muscle:'Épaules',sets:4,repsTarget:'8-12',restSec:90},
        {name:'Élévations latérales',muscle:'Épaules',sets:3,repsTarget:'12-15',restSec:60},
        {name:'Dips triceps',muscle:'Triceps',sets:3,repsTarget:'10-12',restSec:90},
        {name:'Extensions Triceps Poulie Haute',muscle:'Triceps',sets:3,repsTarget:'12-15',restSec:60},
      ]},
      { name: 'Pull', weekdays: [2,5], exercises: [
        {name:'Tractions',muscle:'Dos',sets:4,repsTarget:'6-10',restSec:120},
        {name:'Rowing barre',muscle:'Dos',sets:4,repsTarget:'8-12',restSec:120},
        {name:'Tirage Vertical Poulie Haute',muscle:'Dos',sets:3,repsTarget:'10-12',restSec:90},
        {name:'Curl Biceps',muscle:'Biceps',sets:4,repsTarget:'10-15',restSec:60},
        {name:'Curl haltères',muscle:'Biceps',sets:3,repsTarget:'10-12',restSec:60},
        {name:'Extensions Banc Lombaire',muscle:'Dos',sets:3,repsTarget:'12-15',restSec:60},
      ]},
      { name: 'Legs', weekdays: [3,6], exercises: [
        {name:'Squat',muscle:'Jambes',sets:4,repsTarget:'8-12',restSec:150},
        {name:'Leg press',muscle:'Jambes',sets:4,repsTarget:'10-15',restSec:120},
        {name:'Leg Curl',muscle:'Jambes',sets:4,repsTarget:'10-15',restSec:90},
        {name:'Leg Extension',muscle:'Jambes',sets:3,repsTarget:'12-15',restSec:90},
        {name:'Hip Thrust',muscle:'Fessiers',sets:4,repsTarget:'10-12',restSec:90},
        {name:'Mollets machine',muscle:'Jambes',sets:4,repsTarget:'15-20',restSec:60},
      ]}
    ]
  }
];

function renderDefaultPrograms() {
  var el = document.getElementById('default-programs-list');
  if (!el) return;
  el.innerHTML = DEFAULT_PROGRAMS.map(function(prog, idx) {
    var dayNames = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
    return '<div class="prog-card">' +
      '<div class="prog-card-head" style="cursor:default">' +
        '<div><div class="prog-name display">' + esc(prog.name) + '</div><div class="prog-goal">' + esc(prog.goal) + '</div></div>' +
        '<button class="btn-primary btn-sm" onclick="copyDefaultProgram(' + idx + ')">'+ico('clipboard')+' Copier</button>' +
      '</div>' +
      '<div class="prog-days-wrap" style="display:block">' +
        prog.days.map(function(day) {
          var dayBubbles = (day.weekdays||[]).map(function(d){return '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--green-soft);color:var(--green-bright);font-size:10px;font-weight:600;align-items:center;justify-content:center">' + dayNames[d] + '</span>';}).join('');
          return '<div class="day-row">' +
            '<div><div class="day-name">' + esc(day.name) + '</div><div class="day-excount">' + day.exercises.length + ' exercice(s) ' + dayBubbles + '</div></div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');
}

async function copyDefaultProgram(idx) {
  var prog = DEFAULT_PROGRAMS[idx];
  if (!prog) return;

  // Mapper les exercices avec leurs IDs depuis la base
  var exs = await DB.getExercises();
  var days = prog.days.map(function(day) {
    return {
      id: crypto.randomUUID(),
      name: day.name,
      weekdays: day.weekdays || [],
      exercises: day.exercises.map(function(ex) {
        var found = exs.find(function(e){return e.name === ex.name;});
        return {
          id: found ? found.id : crypto.randomUUID(),
          name: ex.name, muscle: ex.muscle,
          sets: ex.sets, repsTarget: ex.repsTarget, restSec: ex.restSec,
          note: ''
        };
      })
    };
  });

  try {
    await DB.addProgram({
      name: prog.name + ' (copie)',
      goal: prog.goal,
      day_type: 'named',
      days: days
    });
    toast('Programme "' + prog.name + '" copié dans tes programmes perso ! ✓', 'success');
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // On render au navigate
});
