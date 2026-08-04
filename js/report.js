/* ============================================================
   FITNESSTRACKER — Reports (signalements / retours)
   L'admin reçoit les signalements par email.
   Il peut répondre en éditant la colonne "response" dans Supabase.
   L'utilisateur voit la réponse dans l'app.
   ============================================================ */

// Email admin — à configurer plus tard
var REPORT_ADMIN_EMAIL = 'admin@fitnesstracker.bzh';

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
      var typeLabel = rep.type === 'bug' ? 'Bug' : rep.type === 'suggestion' ? 'Suggestion' : 'Amélioration';
      var statusBadge = rep.response
        ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--green-soft);color:var(--green-bright);font-weight:600">Répondu</span>'
        : '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg-raised);color:var(--ink-faint);font-weight:600">En attente</span>';

      var html = '<div class="report-card">' +
        '<div class="report-card-head">' +
          '<span class="report-card-type">' + typeIcon + ' ' + esc(typeLabel) + '</span>' +
          '<span class="report-card-date">' + fDate(rep.created_at.split('T')[0]) + '</span>' +
        '</div>' +
        '<p class="report-card-msg">' + esc(rep.message) + '</p>' +
        '<div class="report-card-footer">' + statusBadge + '</div>';

      if (rep.response) {
        html += '<div class="report-response">' +
          '<div class="report-response-label">' + ico('mail') + ' Réponse :</div>' +
          '<p class="report-response-text">' + esc(rep.response) + '</p>' +
        '</div>';
      }

      html += '</div>';
      return html;
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
    toast(ico('check')+' Signalement envoyé !', 'success');
    document.getElementById('report-message').value = '';
    renderReports();

    // Envoyer notification par email via Supabase Edge Function (ou webhook)
    sendReportEmail(type, message);
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

// Envoi email notification — utilise une edge function Supabase
// Pour le moment, on prépare l'appel. L'edge function sera créée séparément.
function sendReportEmail(type, message) {
  var userName = getUserName();
  // Appel à une edge function (à déployer plus tard)
  fetch('https://hxlhdgfxusckralcjhbw.supabase.co/functions/v1/send-report-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sb.auth.session()?.access_token },
    body: JSON.stringify({ to: REPORT_ADMIN_EMAIL, type: type, message: message, userName: userName })
  }).catch(function() { /* silencieux si l'edge function n'existe pas encore */ });
}

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('btn-send-report');
  if (btn) btn.addEventListener('click', sendReport);
});
