# Configuration du lien de mot de passe oublié

## Problème
Le lien de réinitialisation envoyé par email ne redirige pas correctement vers l'application.

## Solution — Configuration Supabase

### Étape 1 : Ajouter l'URL de redirection
1. Va sur https://supabase.com/dashboard
2. Sélectionne ton projet
3. Menu gauche → **Authentication** → **URL Configuration**
4. Dans **Site URL**, mets : `https://fitnesstracker.bzh`
5. Dans **Redirect URLs**, ajoute :
   - `https://fitnesstracker.bzh/**`
   - `https://fitnesstracker.bzh/index.html`
   - `http://localhost:8080/**` (pour le dev local)
6. Clique **Save**

### Étape 2 : Vérifier le template email
1. Menu gauche → **Authentication** → **Email Templates**
2. Onglet **Reset Password**
3. Vérifie que le lien utilise `{{ .ConfirmationURL }}` (c'est le défaut)
4. Tu peux personnaliser le texte du mail si tu veux

### Étape 3 : Configurer le SMTP (optionnel mais recommandé)
Par défaut, Supabase envoie les mails depuis `noreply@mail.app.supabase.io`.
Pour utiliser ton propre email (`admin@fitnesstracker.bzh`) :
1. Menu gauche → **Project Settings** → **Authentication**
2. Section **SMTP Settings** → Enable Custom SMTP
3. Renseigne :
   - **Sender email** : `admin@fitnesstracker.bzh`
   - **Sender name** : `FitnessTracker`
   - **Host** : ton serveur SMTP (ex: `ssl0.ovh.net` si OVH)
   - **Port** : `465` (SSL) ou `587` (TLS)
   - **Username** : `admin@fitnesstracker.bzh`
   - **Password** : le mot de passe de la boîte mail
4. Clique **Save**

### Étape 4 : Tester
1. Va sur fitnesstracker.bzh
2. Clique "Mot de passe oublié"
3. Entre ton email
4. Ouvre le mail reçu → il doit venir de ton adresse
5. Le lien doit rediriger vers l'app
6. Un modal s'affiche pour saisir le nouveau mot de passe

---

## Configuration de l'email admin pour les signalements

Quand tu auras créé `admin@fitnesstracker.bzh` :
1. Ouvre `pwa/js/report.js`
2. Change la variable `REPORT_ADMIN_EMAIL` par ton email
3. Pour recevoir les signalements par email, il faudra créer une Edge Function Supabase (étape ultérieure)

En attendant, tu peux voir les signalements directement dans Supabase :
- **Table Editor** → table `reports` → tu vois tous les signalements
- Pour répondre : clique sur la ligne → remplis le champ `response` → Save
- L'utilisateur verra ta réponse dans l'app

---

## Suppression d'un compte utilisateur

Le dashboard Supabase peut bugger à la suppression. Utilise le SQL Editor :
```sql
DO $$
DECLARE uid uuid := 'REMPLACE-PAR-UUID';
BEGIN
  DELETE FROM sessions WHERE user_id = uid;
  DELETE FROM programs WHERE user_id = uid;
  DELETE FROM mensurations WHERE user_id = uid;
  DELETE FROM exercises WHERE created_by = uid;
  DELETE FROM reports WHERE user_id = uid;
  DELETE FROM auth.users WHERE id = uid;
END $$;
```
