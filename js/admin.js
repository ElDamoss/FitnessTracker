/* ============================================================
   FITNESSTRACKER — Admin Panel
   Visible uniquement pour l'admin (dams2994@gmail.com)
   ============================================================ */

var ADMIN_EMAIL = 'dams2994@gmail.com';

function isAdmin() {
  return currentUser && currentUser.email === ADMIN_EMAIL;
}

function showAdminNav() {
  var nav = document.getElementById('admin-nav-item');
  if (nav) nav.classList.toggle('hidden', !isAdmin());
}

async function renderAdmin() {
  if (!isAdmin()) {
    document.getElementById('admin-content').innerHTML = '<p class="empty-state">'+ico('ban')+' Accès refusé</p>';
    return;
  }

  var el = document.getElementById('admin-content');
  el.innerHTML = '<p style="color:var(--ink-faint);font-size:13px">Chargement...</p>';

  try {
    // Récupérer tous les users via la table auth (nécessite service_role ou admin API)
    // Workaround : on liste les sessions/programmes/mensurations groupés par user_id
    var sessions = await sb.from('sessions').select('user_id, name, date').order('date', {ascending:false});
    var programs = await sb.from('programs').select('user_id, name');
    var mensurations = await sb.from('mensurations').select('user_id, date, poids');
    var reports = await sb.from('reports').select('*').order('created_at', {ascending:false});

    // Grouper par user_id
    var users = {};
    function addUser(uid) {
      if (!users[uid]) users[uid] = {id:uid, sessions:0, programs:0, mensurations:0, lastSession:null};
    }

    if (sessions.data) sessions.data.forEach(function(s) {
      addUser(s.user_id);
      users[s.user_id].sessions++;
      if (!users[s.user_id].lastSession) users[s.user_id].lastSession = s.date;
    });
    if (programs.data) programs.data.forEach(function(p) {
      addUser(p.user_id);
      users[p.user_id].programs++;
    });
    if (mensurations.data) mensurations.data.forEach(function(m) {
      addUser(m.user_id);
      users[m.user_id].mensurations++;
    });

    var userList = Object.values(users);

    var html = '<div class="section-label">Utilisateurs (' + userList.length + ')</div>';
    html += '<div style="overflow-x:auto"><table class="perf-table"><thead><tr><th>User ID</th><th>Séances</th><th>Programmes</th><th>Mensur.</th><th>Dernière séance</th><th>Actions</th></tr></thead><tbody>';
    userList.forEach(function(u) {
      html += '<tr>';
      html += '<td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis">' + u.id.slice(0,8) + '…</td>';
      html += '<td>' + u.sessions + '</td>';
      html += '<td>' + u.programs + '</td>';
      html += '<td>' + u.mensurations + '</td>';
      html += '<td>' + (u.lastSession ? fDate(u.lastSession) : '—') + '</td>';
      html += '<td><button class="btn-danger btn-sm" onclick="adminDeleteUser(\'' + u.id + '\')">Suppr.</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Reports
    if (reports.data && reports.data.length > 0) {
      html += '<div class="section-label" style="margin-top:20px">'+ico('mail')+' Signalements (' + reports.data.length + ')</div>';
      html += reports.data.map(function(r) {
        var icon = r.type === 'bug' ? ico('bug') : r.type === 'suggestion' ? ico('bulb') : ico('wrench');
        return '<div class="history-card" style="cursor:default;margin-bottom:8px">' +
          '<div class="history-head"><span class="history-name display">' + icon + ' ' + esc(r.type) + '</span><span class="history-date">' + fDate(r.created_at.split('T')[0]) + '</span></div>' +
          '<p style="font-size:13px;color:var(--ink-dim)">' + esc(r.message) + '</p>' +
          '<p style="font-size:10px;color:var(--ink-faint);margin-top:4px">User: ' + r.user_id.slice(0,8) + '…</p>' +
        '</div>';
      }).join('');
    }

    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<p class="empty-state">Erreur: ' + esc(e.message||'') + '</p>';
  }
}

async function adminDeleteUser(uid) {
  var ok = await modalConfirm('Supprimer les données', 'Supprimer TOUTES les données (séances, programmes, mensurations, exercices perso, signalements) de cet utilisateur ?\n\nNote : le compte auth Supabase ne peut pas être supprimé depuis le client. Utilisez le dashboard Supabase pour supprimer le compte.');
  if (!ok) return;
  try {
    var r1 = await sb.from('sessions').delete().eq('user_id', uid);
    var r2 = await sb.from('programs').delete().eq('user_id', uid);
    var r3 = await sb.from('mensurations').delete().eq('user_id', uid);
    var r4 = await sb.from('exercises').delete().eq('created_by', uid).eq('is_default', false);
    var r5 = await sb.from('reports').delete().eq('user_id', uid);
    // Vérifier erreurs
    var errors = [r1,r2,r3,r4,r5].filter(function(r){return r.error;});
    if (errors.length > 0) {
      toast(ico('wrench')+' Données partiellement supprimées ('+errors.length+' erreur(s))', 'error');
    } else {
      toast(ico('check')+' Données utilisateur supprimées', 'success');
    }
    renderAdmin();
  } catch(e) {
    toast('Erreur: ' + (e.message||e), 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Afficher le nav admin après login
  setTimeout(showAdminNav, 2000);
});
