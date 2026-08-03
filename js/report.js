/* ============================================================
   FITNESSTRACKER — Reports (signalements / retours)
   ============================================================ */

async function renderReports() {
  var el = document.getElementById('report-history');
  if (!el) return;
  try {
    var r = await sb.from('reports').select('*').eq('user_id', getUserId()).order('created_at', { ascending: false });
    var data = r.data || [];
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">Aucun signalement envoyé</p>';
      return;
    }
    el.innerHTML = data.map(function(rep) {
      var typeIcon = rep.type === 'bug' ? ico('bug') : rep.type === 'suggestion' ? ico('bulb') : ico('wrench');
      return '<div class="history-card" style="cursor:default">' +
        '<div class="history-head"><span class="history-name display">' + typeIcon + ' ' + esc(rep.type) + '</span><span class="history-date">' + fDate(rep.created_at.split('T')[0]) + '</span></div>' +
        '<p style="font-size:13px;color:var(--ink-dim)">' + esc(rep.message) + '</p>' +
      '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<p class="empty-state">Erreur chargement</p>';
  }
}

async function sendReport() {
  var type = document.getElementById('report-type').value;
  var message = document.getElementById('report-message').value.trim();
  if (!message) { toast('Écris un message', 'error'); return; }
  try {
    var r = await sb.from('reports').insert({ user_id: getUserId(), type: type, message: message });
    if (r.error) throw r.error;
    toast(ico('mail')+' Signalement envoyé — merci !', 'success');
    document.getElementById('report-message').value = '';
    renderReports();
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('btn-send-report');
  if (btn) btn.addEventListener('click', sendReport);
});
