# Requirements — V8.1 (correctifs & améliorations)

Lot de correctifs et améliorations après le déploiement du V8 sur fitnesstracker.bzh.
Projet : `pwa-v2/` (React + TypeScript + Vite + Supabase). Source : `V8.1.txt`.

## Exigence 1 — Navigation des tuiles d'accueil en un seul clic

**User story :** en tant qu'utilisateur, quand je clique sur une tuile de l'accueil
(Programmes, Progrès, etc.), je veux y accéder immédiatement, sans avoir à cliquer
plusieurs fois.

**Critères d'acceptation :**
1. QUAND l'utilisateur clique une fois sur une tuile de l'accueil, LE système SHALL naviguer immédiatement vers la page correspondante.
2. LE composant tuile NE SHALL PAS utiliser un `<button style={display:contents}>` imbriqué qui casse le clic.
3. Toute la surface de la tuile SHALL être cliquable.

## Exigence 2 — Bouton d'édition par ligne de séance dans les programmes

**User story :** en tant qu'utilisateur, je veux un petit bouton (crayon) en face de
chaque séance d'un programme pour l'éditer directement, plutôt qu'un gros bouton
"Éditer les jours" en bas.

**Critères d'acceptation :**
1. CHAQUE ligne de jour/séance (Push, Pull, Legs…) SHALL afficher un bouton d'édition (icône crayon) à côté du bouton "Lancer".
2. QUAND l'utilisateur clique le bouton d'édition d'une ligne, LE système SHALL ouvrir l'éditeur sur cette séance précise.
3. LE style du bouton SHALL être cohérent avec la DA (icône compacte, thème néon).
4. La référence visuelle est `update/editerlesprogrammes.png`.

## Exigence 3 — Barre du haut mobile (safe-area) et panneau du jour non coupé

**User story :** en tant qu'utilisateur mobile, je ne veux pas que le bandeau système
(heure/batterie/wifi) chevauche l'app, ni que le panneau "Séances du [jour]" soit coupé.

**Critères d'acceptation :**
1. LA barre du haut de l'app SHALL respecter la zone sûre (`env(safe-area-inset-top)`) pour ne pas passer sous/derrière le bandeau système.
2. LE panneau "Séances du [jour]" sous les bulles de jours SHALL être entièrement visible (non tronqué).
3. Référence : `update/Barreduhaut.png`.

## Exigence 4 — RPE optionnel (par exercice)

**User story :** en tant qu'utilisateur, si je ne veux pas suivre le RPE, je ne veux pas
que le champ RPE s'affiche pendant l'entraînement pour ne pas surcharger l'écran.

**Référence maquette :** dans `Améliorer le design du site`, la carte d'exercice du
modal de création a une case à cocher **RPE par exercice** (ligne 2), et quand elle est
cochée un champ RPE texte libre apparaît (placeholder "8 · 3-2-1 · @RPE9").

**Critères d'acceptation :**
1. À la création/édition d'un exercice de programme, LE système SHALL proposer une case "RPE" PAR EXERCICE (désactivée par défaut).
2. QUAND le RPE d'un exercice est désactivé, LE Workout_Screen NE SHALL PAS afficher le champ RPE sur les séries de cet exercice.
3. QUAND le RPE d'un exercice est activé, LE champ RPE SHALL s'afficher sur les séries de cet exercice.
4. Le réglage RPE SHALL être stocké avec l'exercice du programme (`rpeEnabled`).

## Exigence 5 — Nom d'exercice entièrement visible en séance

**User story :** en tant qu'utilisateur en entraînement, je veux voir le nom complet de
mon exercice, pas une version tronquée ("Presse Pectora…").

**Critères d'acceptation :**
1. LE Workout_Screen SHALL afficher le nom complet de l'exercice (retour à la ligne autorisé ou largeur suffisante).
2. LES boutons d'action de l'en-tête (horloge, swap, commentaire, monter/descendre) NE SHALL PAS écraser la largeur du nom (les regrouper/compacter ou passer sur une 2e ligne si besoin).
3. Référence : `update/nom dans le programme.png`.

## Exigence 6 — Graphique d'évolution des mensurations avec sélecteur

**User story :** en tant qu'utilisateur, je veux un graphique d'évolution dans les
mensurations, avec une liste de tout ce qui est sélectionnable (poids, tours de bras, etc.).

**Critères d'acceptation :**
1. LA page Mensurations SHALL afficher un graphique d'évolution dans le temps.
2. LE système SHALL proposer un sélecteur listant TOUTES les mesures disponibles : poids, taille, tour_poitrine, tour_bras_g, tour_bras_d, tour_cuisse_g, tour_cuisse_d, tour_mollet_g, tour_mollet_d, tour_taille, tour_hanche.
3. QUAND l'utilisateur sélectionne une mesure, LE graphique SHALL tracer son évolution à partir de l'historique des entrées.
4. SI une mesure n'a pas assez de données, LE système SHALL l'indiquer.

## Exigence 7 — Abdos/cardio : reps OU temps (création + modifiable le jour J)

**User story :** en tant qu'utilisateur, pour les abdos/cardio, je veux choisir à la
création d'un programme si c'est en répétitions ou en temps, voir la bonne case le jour
de l'entraînement, et pouvoir la changer ce jour-là.

**Critères d'acceptation :**
1. À la création/édition d'un exercice de programme, LE système SHALL permettre de choisir le type de mesure : répétitions OU temps (secondes).
2. LE type choisi SHALL être stocké avec l'exercice du programme.
3. QUAND la séance est lancée, LE Workout_Screen SHALL afficher le champ correspondant (reps ou secondes) selon le réglage.
4. LE jour de l'entraînement, l'utilisateur SHALL pouvoir basculer un exercice entre reps et secondes pour cette séance.
5. La valeur saisie SHALL être enregistrée sous la bonne clé (reps ou duration) — cohérent avec l'existant V8.

## Note d'implémentation — maquette de référence

La maquette `Améliorer le design du site` (racine) fournit des patterns d'UI directement
réutilisables pour ce lot :
- **Home** : `TiltCard` avec `onClick` direct (pas de `<button display:contents>`) → règle l'ex. 1.
- **Home** : carte "séance du jour" compacte (jour plein, nom de séance, liste d'exercices à puces, bouton "Lancer la séance").
- **Modal création programme en 2 étapes** : par exercice, un toggle **Reps / Temps** (pills) + une case **RPE** avec champ texte → règle ex. 4 et 7.
- **WorkoutScreen** : header épuré (`flex:1, minWidth:0` sur le nom), bouton unique "Dernière séance" au lieu d'une rangée d'icônes → règle l'ex. 5 ; le mode `time` affiche l'unité "s"/"sec" → règle l'ex. 7.

## Exigence 8 — Cohérence avec la DA existante

**User story :** en tant qu'utilisateur, je veux que les changements V8.1 restent
cohérents avec le design actuel.

**Critères d'acceptation :**
1. LES nouveaux éléments d'UI SHALL utiliser la DA existante (accent néon par thème via `--neon`/`--neon-rgb`, titres Barlow Condensed, panneaux TiltCard).
2. LE dossier `archive/design-references/Améliorer le design du site` SHALL servir de référence (base déjà utilisée, PAS une refonte).
3. LES 4 thèmes (dark, light, stitch, girly) SHALL rester fonctionnels et cohérents.
