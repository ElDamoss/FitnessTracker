/* ============================================================
   FITNESSTRACKER — Profil & Sécurité
   ============================================================ */

// ── TAB SWITCH ──
function switchProfileTab(tab) {
  document.getElementById('section-profile').classList.toggle('hidden', tab !== 'profile');
  document.getElementById('section-security').classList.toggle('hidden', tab !== 'security');
  document.getElementById('tab-profile').classList.toggle('active', tab === 'profile');
  document.getElementById('tab-security').classList.toggle('active', tab === 'security');
}

// ── RENDER PROFILE ──
function renderProfile() {
  if (!currentUser) return;
  document.getElementById('profile-email').textContent = currentUser.email || '—';
  document.getElementById('profile-name-input').value = getUserName() || '';
  document.getElementById('profile-phone-input').value = currentUser.user_metadata?.phone || '';
  checkMfaStatus();
}

// ── SAVE NAME ──
async function saveProfileName() {
  var name = document.getElementById('profile-name-input').value.trim();
  if (!name) { toast('Entre un nom', 'error'); return; }
  try {
    var r = await sb.auth.updateUser({ data: { display_name: name } });
    if (r.error) throw r.error;
    document.getElementById('user-display-name').textContent = name;
    document.getElementById('user-avatar').textContent = name.slice(0,2).toUpperCase();
    toast('Nom mis à jour ✓', 'success');
  } catch(e) { toast('Erreur: ' + (e.message||e), 'error'); }
}

// ── SAVE PHONE ──
async function saveProfilePhone() {
  var phone = document.getElementById('profile-phone-input').value.trim();
  try {
    var r = await sb.auth.updateUser({ data: { phone: phone } });
    if (r.error) throw r.error;
    toast('Téléphone enregistré ✓', 'success');
  } catch(e) { toast('Erreur: ' + (e.message||e), 'error'); }
}

// ── RESET PASSWORD ──
async function resetPassword() {
  if (!currentUser || !currentUser.email) { toast('Email introuvable', 'error'); return; }
  try {
    var r = await sb.auth.resetPasswordForEmail(currentUser.email, {
      redirectTo: 'https://fitnesstracker.bzh/index.html'
    });
    if (r.error) throw r.error;
    toast('📧 Email de réinitialisation envoyé à ' + currentUser.email, 'success', 5000);
  } catch(e) { toast('Erreur: ' + (e.message||e), 'error'); }
}

// ── DELETE ACCOUNT ──
async function deleteAccount() {
  if (!confirm('⚠️ ATTENTION : Supprimer ton compte est IRRÉVERSIBLE.\n\nToutes tes données (séances, programmes, mensurations) seront perdues.\n\nContinuer ?')) return;
  var code = prompt('Pour confirmer, tape "SUPPRIMER" :');
  if (code !== 'SUPPRIMER') { toast('Suppression annulée', 'info'); return; }

  try {
    // Supprimer les données de l'user
    var uid = getUserId();
    await sb.from('sessions').delete().eq('user_id', uid);
    await sb.from('programs').delete().eq('user_id', uid);
    await sb.from('mensurations').delete().eq('user_id', uid);
    await sb.from('exercises').delete().eq('created_by', uid).eq('is_default', false);

    // Note: la suppression du compte auth nécessite un edge function côté serveur
    // Pour l'instant on déconnecte et on informe
    await authSignOut();
    toast('Données supprimées. Contacte l\'admin pour supprimer le compte auth.', 'info', 8000);
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
  } catch(e) { toast('Erreur: ' + (e.message||e), 'error'); }
}

// ── MFA ──
async function checkMfaStatus() {
  var el = document.getElementById('mfa-status');
  try {
    var r = await sb.auth.mfa.listFactors();
    if (r.data && r.data.totp && r.data.totp.length > 0) {
      var factor = r.data.totp[0];
      if (factor.status === 'verified') {
        el.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="color:var(--green-bright);font-weight:600">✅ MFA activée</span></div>';
        document.getElementById('btn-enable-mfa').textContent = '🔓 Désactiver la MFA';
        document.getElementById('btn-enable-mfa').onclick = disableMfa;
        return;
      }
    }
    el.innerHTML = '<span style="color:var(--ink-faint);font-size:13px">MFA non activée</span>';
    document.getElementById('btn-enable-mfa').textContent = '🔐 Activer la MFA';
    document.getElementById('btn-enable-mfa').onclick = enableMfa;
  } catch(e) {
    el.innerHTML = '<span style="color:var(--ink-faint);font-size:13px">MFA non disponible</span>';
  }
}

async function enableMfa() {
  try {
    var r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'FitnessTracker' });
    if (r.error) throw r.error;
    var factor = r.data;
    // Afficher le QR code
    document.getElementById('mfa-qr').innerHTML =
      '<img src="' + factor.totp.qr_code + '" style="width:200px;height:200px;border-radius:12px;border:1px solid var(--line)"/>' +
      '<p style="font-size:11px;color:var(--ink-faint);margin-top:8px">Scanne ce QR code avec ton app authenticator</p>';
    document.getElementById('mfa-setup').classList.remove('hidden');
    // Stocker le factorId pour la vérification
    window._mfaFactorId = factor.id;
  } catch(e) { toast('Erreur MFA: ' + (e.message||e), 'error'); }
}

async function verifyMfa() {
  var code = document.getElementById('mfa-code').value.trim();
  if (!code || code.length !== 6) { toast('Code à 6 chiffres requis', 'error'); return; }
  try {
    var challengeR = await sb.auth.mfa.challenge({ factorId: window._mfaFactorId });
    if (challengeR.error) throw challengeR.error;
    var verifyR = await sb.auth.mfa.verify({
      factorId: window._mfaFactorId,
      challengeId: challengeR.data.id,
      code: code
    });
    if (verifyR.error) throw verifyR.error;
    toast('✅ MFA activée avec succès !', 'success');
    document.getElementById('mfa-setup').classList.add('hidden');
    checkMfaStatus();
  } catch(e) { toast('Code invalide: ' + (e.message||e), 'error'); }
}

async function disableMfa() {
  if (!confirm('Désactiver la MFA ?')) return;
  try {
    var r = await sb.auth.mfa.listFactors();
    if (r.data && r.data.totp && r.data.totp.length > 0) {
      await sb.auth.mfa.unenroll({ factorId: r.data.totp[0].id });
      toast('MFA désactivée', 'info');
      checkMfaStatus();
    }
  } catch(e) { toast('Erreur: ' + (e.message||e), 'error'); }
}

// ── EVENT LISTENERS ──
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-save-profile-name').addEventListener('click', saveProfileName);
  document.getElementById('btn-save-profile-phone').addEventListener('click', saveProfilePhone);
  document.getElementById('btn-reset-password').addEventListener('click', resetPassword);
  document.getElementById('btn-delete-account').addEventListener('click', deleteAccount);
  document.getElementById('btn-enable-mfa').addEventListener('click', enableMfa);
  document.getElementById('btn-verify-mfa').addEventListener('click', verifyMfa);
});
