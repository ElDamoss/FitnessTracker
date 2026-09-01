# Design — V8.1 : adoption fidèle de la maquette dans `pwa-v2`

## Overview

### Objectif
Adopter **à l'identique** la direction artistique (DA) et les patterns UI de la maquette
Figma `Améliorer le design du site/` dans l'application de production `pwa-v2/`
(React + TypeScript + Vite + Supabase, PWA), **tout en conservant intégralement la
logique métier réelle** de `pwa-v2` : authentification Supabase, anti brute-force (V8),
sauvegarde/chargement de séance, historique, mensurations, cardio, export Story,
mannequin.

La maquette est la **source de vérité visuelle**. Ce document décrit, écran par écran,
ce que la maquette affiche et fait (avec les noms de classes, la structure du JSX, les
variables CSS et les comportements exacts), puis mappe chaque élément vers le fichier
`pwa-v2` à modifier et la logique Supabase à préserver.

### Principe directeur (NON négociable)
> L'implémentation doit **COPIER** la structure JSX/CSS de la maquette (mêmes classes,
> même arborescence, mêmes styles inline, mêmes composants), **pas la réinterpréter**.
> Le seul travail d'adaptation autorisé est de **remplacer les données mock de la
> maquette par les données Supabase de `pwa-v2`** et de **brancher les callbacks réels**
> (auth, save, fetch). Aucune simplification, aucune "amélioration" spontanée du layout.

### Contexte des deux bases
- **Maquette** : `Améliorer le design du site/src/App.tsx` (~1848 lignes, monolithe :
  toutes les pages + composants dans un seul fichier) et `src/index.css` (~677 lignes).
  Données 100 % mock (constantes `PROGRAMS`, `EXERCISES`, `RECENT_SESSIONS`,
  `DAY_SESSIONS`, `PROG_DAY`, `LAST_SESSION_DATA`…). Auth factice (`useState(false)`).
  Le dossier `src/imports/` contient les exports Figma bruts : `App.tsx`,
  `MuscuTrack-Pro.html`, `index.html`, `index.css`, `style.css`, `style-1.css`, et
  5 PNG (`image.png`, `image-1.png` … `image-4.png`). Ce sont des **références
  visuelles uniquement**, à ne pas importer dans `pwa-v2`.
- **Prod** : `pwa-v2/src/App.tsx` (shell + auth + reset mdp), `src/index.css`
  (~635 lignes), pages découpées dans `src/pages/*.tsx`, composants dans
  `src/components/*.tsx` (`Icons.tsx`, `TiltCard.tsx`, `WorkoutScreen.tsx`,
  `Mannequin.tsx`, `StoryExport.tsx`), accès données dans `src/lib/supabase.ts`.

### Écarts structurels majeurs (maquette → prod)
1. **Thèmes** : maquette = `dark | light | egirl(rose) | stitch(bleu)` tous **basés
   sombre** sauf light, pilotés par `--neon-rgb` + switcher `‹ Label ›`. Prod =
   `dark | light | stitch | girly` où **stitch et girly sont des thèmes CLAIRS**.
   → mapper `egirl` ⇆ `girly`, et **réaligner les valeurs** (voir table dédiée).
2. **Barre du haut mobile** : maquette a un `<div className="safe-area-top" />` au-dessus
   du `.topbar` (hauteur = `env(safe-area-inset-top)`). Prod **ne l'a pas** → bug de
   chevauchement (Exigence 3).
3. **Tuiles d'accueil** : maquette = `TiltCard` avec `onClick` direct. Prod = `TiltCard`
   qui enveloppe un `<button style={{display:'contents'}}>` → **casse le clic**
   (Exigence 1).
4. **Modal programme** : maquette = modal riche **2 étapes / 3 colonnes** avec pills
   Reps/Temps et case RPE par exercice. Prod = éditeur inline "Éditer les jours" + petit
   modal de création nom/objectif. → adopter le pattern maquette (Exigences 2, 4, 7).
5. **WorkoutScreen** : maquette = header épuré (nom `flex:1`), **1 seul** bouton
   "Dernière séance". Prod = header avec **6 boutons icônes** (🕑 🔄 💬 ▲ ▼ + pastille
   muscle) qui écrasent le nom (Exigence 5). RPE toujours affiché en prod → doit devenir
   conditionnel (Exigence 4).

---

## 1. Système de thèmes — table de mapping

La maquette pilote tout l'accent via `--neon` (couleur) et `--neon-rgb` (triplet pour les
`rgba(var(--neon-rgb), …)`). Le switcher est un groupe `‹ [emoji Label] ›` dans
`.topbar-actions` qui cycle un tableau `THEMES`.

### Variables CSS par thème (valeurs exactes de la maquette)

| Var | dark (`:root`) | light | egirl (rose) | stitch (bleu) |
|---|---|---|---|---|
| `--bg` | `#06080a` | `#eceef2` | `#0f0810` | `#060c14` |
| `--bg-panel` | `#0e1114` | `#f8f9fb` | `#1a0f1e` | `#0c1624` |
| `--bg-raised` | `#161b20` | `#ffffff` | `#221528` | `#121f30` |
| `--line` | `rgba(255,255,255,.06)` | `rgba(0,0,0,.10)` | `rgba(255,100,200,.08)` | `rgba(80,160,255,.08)` |
| `--line-soft` | `rgba(255,255,255,.04)` | `rgba(0,0,0,.06)` | `rgba(255,100,200,.04)` | `rgba(80,160,255,.04)` |
| `--ink` | `#dfe5ec` | `#0e1520` | `#f5dff8` | `#d8e8ff` |
| `--ink-dim` | `#8496a8` | `#2d3a4a` | `#c084d0` | `#7aaad4` |
| `--ink-faint` | `#3f5060` | `#5a6a7a` | `#7a4a82` | `#3a5a7a` |
| `--neon` | `#b6ff47` | `#3d8200` | `#ff6ec7` | `#4fb3ff` |
| `--neon-rgb` | `182,255,71` | `61,130,0` | `255,110,199` | `79,179,255` |
| `--neon-soft` | `rgba(var(--neon-rgb),.1)` | idem | `rgba(255,110,199,.12)` | `rgba(79,179,255,.12)` |
| `--green` | `#39d97a` | `#1a7a45` | `#ff6ec7` | `#4fb3ff` |
| `--danger` | `#f04444` | `#c42b2b` | `#ff4466` | `#ff5060` |

Note : en `light`, la maquette ajoute des surcharges de contraste (`.sidebar`, `.topbar`,
`.nav-item:hover/.active`, `::-webkit-scrollbar-thumb`) et redéfinit `body::before/::after`
avec des opacités plus faibles. À copier tel quel.

### Décision de mapping vers `pwa-v2`

| Maquette | pwa-v2 (actuel) | Décision |
|---|---|---|
| `dark` | `dark` | Conserver identique. |
| `light` | `light` (clair vert) | **Adopter les valeurs maquette** (`--neon:#3d8200`, base `#eceef2`) — remplace la variante prod actuelle. |
| `egirl` (rose sombre) | `girly` (rose **clair**) | **Renommer/adopter** : garder la clé `girly` dans `pwa-v2` (persistée dans `localStorage ft_theme`, référencée par `toggleFunTheme`) MAIS remplacer ses valeurs par celles d'`egirl` (rose **sombre**). Emoji `🌸`. |
| `stitch` (bleu sombre) | `stitch` (bleu **clair**) | **Adopter les valeurs maquette** (bleu sombre, `--neon:#4fb3ff`). Emoji `🩵`. |

Décision clé : on **garde les identifiants de thème de `pwa-v2`** (`dark|light|stitch|girly`)
pour ne pas casser la persistance `localStorage` ni la logique `App.tsx`, mais on
**remplace les blocs de valeurs CSS** par ceux de la maquette (en mappant `egirl`→`girly`).
Les 4 thèmes doivent rester fonctionnels (Exigence 8.3).

### Switcher de thème

| Maquette | pwa-v2 (actuel) |
|---|---|
| Groupe `‹` + carte `[emoji Label]` + `›`, `cycleTheme(dir)` cycle le tableau `THEMES` (4 entrées). | 2 boutons : `toggleDarkLight` (soleil/lune) + `toggleFunTheme` (✨/🧵/🎀). |

**Changement** : remplacer les deux boutons de `pwa-v2/src/App.tsx` par le pattern
maquette : `cycleTheme(-1)` / carte label / `cycleTheme(1)`, avec un tableau
`THEMES = [{id:'dark',label:'Dark',emoji:'⚡'}, {id:'light',label:'Clair',emoji:'☀️'},
{id:'girly',label:'Egirl',emoji:'🌸'}, {id:'stitch',label:'Stitch',emoji:'🩵'}]`.
**À préserver** : `useEffect` qui fait `setAttribute('data-theme', theme)` + persistance
`localStorage.setItem('ft_theme', theme)` (déjà présent dans `pwa-v2`). Ne PAS reprendre
le mapping maquette `theme === 'dark' ? '' : theme` : `pwa-v2` applique toujours l'attribut.

---

## 2. Layout shell — structure exacte

### Structure JSX de la maquette (`.app-shell`)
```
.app-shell
├── (backdrop sidebar mobile — visible si sidebarOpen)
├── .sidebar[.open]
│    ├── .brand (LogoMark + FITNESS<span>TRACKER</span> + sous-titre)
│    ├── nav > .nav-item[.active] (icône + label) …  + .nav-eyebrow "Infos" + Signaler/MàJ
│    ├── .sidebar-spacer
│    └── .user-block (avatar + nom + statut + btn-icon logout)
├── .main-area
│    ├── .safe-area-top            ← ÉLÉMENT CLÉ (bug barre du haut)
│    ├── .topbar (burger + titre/date  |  switcher thème)
│    └── .content-area > .page.active > renderPage()
├── FAB accueil (fixed bottom-right, visible si page !== home)
└── #toast-area
```

### `.safe-area-top` — CSS exact (maquette)
```css
.safe-area-top {
  height: env(safe-area-inset-top, 0px);
  background: var(--bg-panel);
  flex-shrink: 0;
}
```
Placé **entre** `.main-area` et `.topbar`. `.topbar` reste `height: var(--topbar-h)`.
C'est ce bloc qui **corrige le chevauchement du bandeau système** (Exigence 3.1).

| Maquette | pwa-v2 file | Changement | Supabase à préserver |
|---|---|---|---|
| `<div className="safe-area-top" />` avant `.topbar` | `pwa-v2/src/App.tsx` (bloc `.main-area`) | **Ajouter** le `<div className="safe-area-top" />` juste avant `<div className="topbar">`. | — (purement visuel) |
| Règle `.safe-area-top` | `pwa-v2/src/index.css` | **Ajouter** la règle CSS (absente en prod). | — |
| FAB accueil | `pwa-v2/src/App.tsx` (`.home-fab`) + `index.css` | La prod a déjà `.home-fab` (cercle 44px, `bottom: calc(var(--nav-h)+14px)`). **Aligner** sur la maquette (carré 48px arrondi 14, `bottom:24 right:20`, bordure néon, glow au hover) — ou conserver prod si jugé cohérent. Recommandation : adopter le style maquette pour la fidélité. | — |

Le reste du shell (`.sidebar`, `.brand`, `.nav-item`, `.user-block`, `.topbar-title/date`)
est **déjà quasi identique** entre les deux bases : conserver le JSX prod (il porte déjà
`displayName`, `handleLogout` Supabase, `navigate`).

---

## 3. Page d'accueil (`PageHome`) — spec de fidélité

### Structure maquette (`.home-container`)
```
.home-container
├── .home-brand (.home-logo-wrap[LogoMark 44] + .home-title FITNESS<span>TRACKER</span> + .home-sub)
├── .home-weekdays  →  7× <button className="home-day-bubble[ active|today][ selected]">{L M M J V S D}</button>
├── {selectedDay !== null && CARTE SÉANCE DU JOUR}      ← panneau non tronqué (Exigence 3.2)
│    ├── entête : DAY_FULL[selectedDay] (eyebrow néon) + nom de séance + "⏱ durée"
│    ├── "Exercices prévus" : liste à puces (point néon 5px + nom)
│    └── <button className="btn-primary">▶ Lancer la séance</button>
└── .home-grid  →  HOME_CARDS.map → <TiltCard className="home-card" onClick={() => navigate(c.page)}>
                     <span.home-card-icon>{icon}</span> <span.home-card-label>{label}</span>
```

### Points de fidélité critiques
- **`.home-day-bubble.selected`** : `outline: 2px solid var(--neon); outline-offset: 2px;`
  (contour visible sur le jour cliqué). Classes cumulables : `active` (jour avec séance,
  fond néon plein + `scale(1.08)`), `today` (contour néon léger + fond `--neon-soft`),
  `selected` (le jour actuellement ouvert).
- **Carte "séance du jour"** : styles inline maquette (radius 14, bordure
  `rgba(var(--neon-rgb),0.25)` si séance, `animation: fadeSlide .18s ease`, `maxWidth:420`).
  Elle doit être **entièrement visible** (pas de `overflow`/troncature) → corrige
  Exigence 3.2.
- **TiltCard clic direct** : `<TiltCard onClick={...}>` — **AUCUN**
  `<button style={{display:'contents'}}>` imbriqué (Exigence 1.2).

### Bug actuel de `pwa-v2` (à supprimer)
`pwa-v2/src/pages/Home.tsx` fait :
```jsx
<TiltCard className="home-card" style={{…}}>
  <button onClick={() => navigate(c.page)} style={{ display: 'contents' }}>
    <span …/>…
  </button>
</TiltCard>
```
Le `TiltCard` prod **n'accepte pas** `onClick` (voir `components/TiltCard.tsx`), d'où le
`<button display:contents>` qui casse le clic (double-clic / zone morte).

| Maquette | pwa-v2 file | Changement | Supabase à préserver |
|---|---|---|---|
| `TiltCard` avec prop `onClick` | `pwa-v2/src/components/TiltCard.tsx` | **Ajouter** la prop `onClick?: () => void` et la poser sur le `<div className="tilt-card">` (comme la maquette). | — |
| `HOME_CARDS.map` → `<TiltCard onClick={() => navigate(c.page)}>` | `pwa-v2/src/pages/Home.tsx` | **Supprimer** le `<button display:contents>` ; passer `onClick` au `TiltCard`. Toute la surface cliquable (Exigence 1.1/1.3). | — |
| `.home-day-bubble.selected` (outline néon) | `pwa-v2/src/index.css` | **Ajouter** la règle `.selected` (absente en prod). Ajouter `className` `selected` sur la bulle sélectionnée. | — |
| Bulles : classe `active` = jour avec séance | `pwa-v2/src/pages/Home.tsx` | Conserver la logique prod `daysWithSession` (issue de Supabase) mais **aligner les classes** sur la maquette (`active`/`today`/`selected`). | Fetch `programs` par `user_id` (déjà présent), calcul `daysWithSession`/`dayDetails`. |
| Carte "séance du jour" complète (nom séance + liste exos à puces + bouton Lancer) | `pwa-v2/src/pages/Home.tsx` | **Remplacer** la carte prod actuelle (qui n'affiche que `day.name`) par la carte maquette complète : nom plein du jour, nom de séance, **liste à puces des exercices** (`day.exercises.map(e => e.name)`), bouton "Lancer la séance". | `dayDetails[selectedDay]` vient de Supabase ; le bouton "Lancer" doit déclencher le **vrai** démarrage de séance (voir §7 : réutiliser `onStartWorkout`/mapping `WorkoutState`). |

Détail données : la maquette mappe `DAY_SESSIONS` (mock). En prod, `dayDetails[wd]` est un
`ProgramDay[]` issu de `programs.days`. Chaque `day` a `name` + `exercises[]`. La liste à
puces itère `day.exercises` (afficher `e.name`). Si plusieurs séances le même jour, répéter
le bloc carte par `day` (comme le fait déjà `pwa-v2` avec `.map`).

---

## 4. Modal création/édition de programme (`ModalNewProgram`) — PIÈCE MAÎTRESSE

C'est le composant le plus riche de la maquette. Il **remplace** à la fois le petit modal
"Créer un programme" et l'éditeur inline "Éditer les jours" de `pwa-v2/src/pages/Programs.tsx`.

### Types (maquette — à porter tels quels, puis réconcilier §8)
```ts
type ExMode = 'reps' | 'time'
type ProgDay = {
  id: number
  name: string
  weekdays: number[]
  exercises: {
    name: string; muscle: string;
    sets: number;
    reps: string;         // valeur si mode 'reps'   (ex: "8-10")
    mode: ExMode;         // 'reps' | 'time'
    time: string;         // valeur si mode 'time' (secondes, ex: "45")
    rpeEnabled: boolean;  // case RPE par exercice
    rpe: string;          // texte libre RPE (ex: "8 · 3-2-1 · @RPE9")
  }[]
}
```
Constantes maquette : `WEEKDAY_LABELS=['L','M','M','J','V','S','D']`,
`GOALS=['Prise de masse','Sèche','Force','Endurance','Général']`, `ALL_EXERCISES` (catalogue).

### Structure & comportement (2 étapes)

**Overlay/Modal** : `.modal-overlay` (clic hors carte = fermer) > `.modal`
(`maxWidth:min(96vw,980px)`, `width:96vw`, `maxHeight:90dvh`).
**Header** `.modal-head` : bouton retour (visible si `step===2`, revient step 1) + titre
"Nouveau programme" + **stepper** (pastilles 1—2 néon selon `step`) + `.modal-close`.

**Étape 1** (`step === 1`) — colonne `maxWidth:480` :
- Eyebrow "Informations générales".
- `.field` "Nom du programme *" → `<input>` (autoFocus).
- `.field` "Objectif" → **pills** `GOALS.map` (fond néon si sélectionné).
- **Aperçu live** (si `name` non vide) : encart `--neon-soft`, eyebrow "Aperçu",
  nom en Barlow Condensed 22, objectif en néon. `animation: fadeSlide .2s`.

**Étape 2** (`step === 2`) — layout responsive **3 colonnes** `.prog-layout` :
```
.prog-layout
├── .prog-col-days[.prog-mobile-hide]      (largeur 200px ; liste des jours)
│     • chaque jour : carte cliquable (sélection = fond --neon-soft + bordure néon),
│       "Jour i" ou nom, "{n} exos", croix suppr (stopPropagation → removeDay)
│     • bouton "＋ Ajouter un jour" (dashed néon → addDay)
├── .prog-col-editor[.prog-mobile-hide…]   (flex:1 ; éditeur du jour sélectionné)
│     • .prog-back-btn "Tous les jours"  (mobile only)
│     • .field "Nom de la séance" (draft + onBlur → updateDay)
│     • "Jours de la semaine" : 7 boutons WEEKDAY_LABELS (toggleWeekday, fond néon si actif)
│     • "Exercices (n)" : liste de <ExCard/> (voir ci-dessous)
│     • bouton "＋ Ajouter un exercice" (→ setMobilePanel('catalog'))
└── .prog-col-catalog[.prog-mobile-hide]   (largeur 276px ; catalogue)
      • <CatalogCol/> : .prog-back-btn "Retour au jour" (mobile) + recherche + liste
        filtrée ALL_EXERCISES (clic = addExercise ; ✓ si déjà ajouté, sinon pastille +)
```
Sur **mobile (`max-width:700px`)** : `.prog-layout` devient `display:block`, chaque colonne
prend 100 %, `.prog-mobile-hide { display:none !important }` masque les colonnes non
actives, et l'on navigue entre panneaux via `mobilePanel: 'days'|'editor'|'catalog'` et les
`.prog-back-btn` (qui deviennent `display:flex`). Le `.modal` passe en bottom-sheet
(`border-radius: 22px 22px 0 0`, `width:100vw`).

**Footer** `.modal-footer` : gauche = "Annuler"/"← Retour" (selon panneau), droite =
"Suivant →" (step 1, `disabled` si `!canNext`) ou "Créer le programme" (step 2,
`disabled` si `!canSave`). `canNext = name.trim().length>0`, `canSave = canNext && days.length>0`.

### `ExCard` — carte exercice (LE cœur des exigences 4 & 7)
Deux lignes :

**Ligne 1** (`display:flex`, gap 10) :
- Nom (flex:1, ellipsis) + muscle (néon, 11px).
- **Séries** : `<input type="number">` (largeur 48) + label "séries" → `updateEx(name,'sets',Number)`.
- `×`.
- **Toggle Reps / Temps** (pills) : conteneur bordé, 2 boutons `['reps','time']` ;
  actif = fond `var(--neon)` + texte `#0a0c0f` → `updateEx(name,'mode',m)`.
- **Input valeur** conditionnel :
  - `mode==='reps'` → `<input type="text" value={ex.reps}>` + label "reps".
  - `mode==='time'` → `<input type="number" value={ex.time}>` + `s` + label "secondes".
- Croix suppr (hover rouge → removeEx).

**Ligne 2** (RPE, `padding:0 14px 12px`) :
- **Case à cocher RPE** custom (`<div onClick={() => updateEx(name,'rpeEnabled',!rpeEnabled)}>`) :
  carré 18px, bordure/fond néon si coché (avec ✓ SVG), libellé "RPE" (néon si coché).
- **Champ RPE** (visible **uniquement** si `rpeEnabled`) : `<input type="text"
  placeholder="8 · 3-2-1 · @RPE9" value={ex.rpe}>` (autoFocus), style mono néon,
  `animation: fadeSlide .15s`.

`addExercise(ex)` initialise : `{ ...ex, sets:3, reps:'10', mode:'reps', time:'30',
rpeEnabled:false, rpe:'' }`.

### Mapping vers `pwa-v2`

| Maquette | pwa-v2 file | Changement | Supabase à préserver |
|---|---|---|---|
| `ModalNewProgram` (2 étapes, 3 colonnes) | **Nouveau composant** `pwa-v2/src/components/ModalNewProgram.tsx` (extrait), utilisé par `pwa-v2/src/pages/Programs.tsx` | **Copier** le JSX/CSS de la maquette. Remplacer le mini-modal + éditeur inline actuels. `onSave` doit **insérer/mettre à jour** via Supabase. | `supabase.from('programs').insert({user_id,name,goal,days})` (création) ; `.update({days}).eq('id',…)` (édition). `loadPrograms()`/`loadLibraryNames()` conservés. |
| Catalogue `ALL_EXERCISES` (mock) | `pwa-v2/src/pages/Programs.tsx` | Alimenter le catalogue depuis la **bibliothèque Supabase** `exercises` (déjà chargée : `libraryNames` + `libraryTypes`). Chaque item = `{name, muscle}`. | `supabase.from('exercises').select('name, muscle, set_measurement_type')`. |
| `ExCard` pills Reps/Temps | `ModalNewProgram.tsx` | **Copier** le toggle + inputs. `mode` initialisé depuis `libraryTypes[name]` (`'seconds'`→`'time'`, sinon `'reps'`) pour respecter V8 `set_measurement_type` (Exigence 7). | `set_measurement_type` de la table `exercises`. |
| `ExCard` case RPE + champ | `ModalNewProgram.tsx` | **Copier** la case `rpeEnabled` (désactivée par défaut) + champ `rpe`. Stocké dans `days[].exercises[].rpeEnabled/rpe` (Exigence 4.1/4.4). | Persisté dans `programs.days` (jsonb). |
| Croix retour, stepper, aperçu, back-btn mobile | `ModalNewProgram.tsx` | Copier tel quel. | — |
| Bouton crayon **par ligne de séance** (Exigence 2) | `pwa-v2/src/pages/Programs.tsx` | **Ajouter** un bouton icône crayon à côté de "Lancer" sur chaque `.day-row`/ligne de jour ; au clic → ouvrir `ModalNewProgram` **en step 2 sur ce jour** (`editingDay` = ce jour). Style néon compact (réf. `update/editerlesprogrammes.png`). | `.update({days}).eq('id',…)` à l'enregistrement. |
| Classes `.prog-layout`, `.prog-col-days/editor/catalog`, `.prog-back-btn`, `.prog-mobile-hide`, `.field`, `.modal*` | `pwa-v2/src/index.css` | **Ajouter** tous ces blocs (présents dans la maquette, absents en prod) + les media queries `max-width:700px`. | — |

---

## 5. WorkoutScreen — spec de fidélité

### Structure maquette (écran plein, `position:fixed inset:0 zIndex:300`)
```
(fixed) écran séance
├── header (bg-panel, border-bottom)
│     ├── <div flex:1 minWidth:0>  .wk-day-name + prog (ink-faint)   ← NOM COMPLET
│     ├── "Durée" + .wk-chrono (mono néon)
│     ├── <button.btn-danger.btn-sm>Fin</button>
│     └── <button.btn-icon>✕</button>
└── body (overflowY:auto)
     └── par exercice : carte (bg-panel, radius 14)
          ├── ex header (bg-raised) :
          │     • <div> nom (700/15) + "muscle · sets×target[+ 's' si time]" (néon)
          │     • {lastData && <button>🕑 Dernière séance</button>}   ← 1 SEUL bouton
          ├── {isLastOpen && panneau "Séance du JJ/MM" : lastData.map → carte kg/reps}
          └── séries : par set
                • pastille numéro (état done)
                • input kg (col + label "kg")
                • ×
                • input reps|time (+ 's' si time ; label "reps"|"sec")
                • <button>Valider | ✓ Fait</button>   (marginLeft:auto)
```
- Le sous-titre exercice affiche `{ex.muscle} · {ex.sets}×{ex.repsTarget}{ex.mode==='time'?'s':' reps'}`.
- L'input du milieu affiche `s` inline quand `mode==='time'`, label "sec" sinon "reps".
- **Pas de champ RPE dans la maquette** (elle n'a pas ce cas). En prod, le RPE existe
  déjà mais doit devenir **conditionnel** à `rpeEnabled` (voir mapping).

### État actuel de `pwa-v2/src/components/WorkoutScreen.tsx` (à réaligner)
Le header prod aligne **6 boutons** (pastille muscle + 🕑 + 🔄 + 💬 + ▲ + ▼) sur la même
ligne que l'`<input>` du nom → **écrasement/troncature** du nom (Exigence 5). Les set-rows
prod gèrent déjà `weight`, `reps` OU `duration` (selon `measurementType`), un input `RPE`
**toujours** affiché, un `Valider ✓`, un **minuteur de repos** (`restLeft`), et des boutons
`± 2.5 / ± 1 / ± 5`.

### Mapping vers `pwa-v2`

| Maquette | pwa-v2 file | Changement | Supabase à préserver |
|---|---|---|---|
| Header épuré, nom `flex:1 minWidth:0` (retour ligne/largeur suffisante) | `pwa-v2/src/components/WorkoutScreen.tsx` (`.wk-header`) | **Restructurer** le header : nom sur toute la largeur (`flex:1, minWidth:0`, autoriser le wrap / ne pas tronquer). **Regrouper/compacter** les actions (🕑 🔄 💬 ▲ ▼) — les passer en menu compact ou 2e ligne — pour ne pas écraser le nom (Exigence 5.2). | Aucune logique changée : `updateExerciseName`, `openSwapPicker`, `toggleComment`, `moveExercise` restent branchés. |
| Bouton unique "Dernière séance" (🕑) | `WorkoutScreen.tsx` | La prod a déjà le bouton 🕑 → panneau "Charges habituelles" (`toggleUsualWeights`). **Aligner le style** sur la maquette (pilule "Dernière séance" avec icône horloge). Le panneau prod (liste `kg × reps|s` + date) correspond déjà. | `queryUsualWeights(name)` → `sessions` filtrées `user_id`, 30 dernières, matching `ex.name`. **Préserver.** |
| Sous-titre `sets×target` + `s` si time | `WorkoutScreen.tsx` | **Ajouter** la ligne sous le nom : `muscle · sets×repsTarget` avec `s` quand `measurementType==='seconds'`. | `measurementType` porté par `WorkoutExercise`. |
| Input reps/temps avec unité `s`/`sec` | `WorkoutScreen.tsx` | Déjà présent (`measurementType==='seconds'` → input `duration` + `s`). **Conserver** ; harmoniser visuellement avec la maquette. | Save : clé `duration` (seconds) ou `reps` selon `measurementType` (V8, déjà en place). |
| RPE **conditionnel** (Exigence 4) | `WorkoutScreen.tsx` | **Rendre le champ RPE conditionnel** : n'afficher l'input RPE de la série **que si** l'exercice a `rpeEnabled === true`. Actuellement toujours affiché. | `rpeEnabled` provient de `programs.days[].exercises[]` → doit être **propagé dans `WorkoutExercise`** (voir §7/§8). Save RPE inchangé (clé `rpe`). |
| Toggle Reps/Temps **le jour J** (Exigence 7.4) | `WorkoutScreen.tsx` | **Ajouter** un petit toggle par exercice permettant de basculer `measurementType` `reps`⇄`seconds` pour la séance courante (n'affecte pas le programme). | La valeur saisie s'enregistre sous la bonne clé (`reps`/`duration`) — cohérent V8 (Exigence 7.5). |
| `.wk-screen/.wk-header/.wk-day-name/.wk-chrono/.wk-body` | `pwa-v2/src/index.css` | Classes déjà présentes en prod (portées depuis une base commune). Vérifier l'alignement avec la maquette. | — |

**Rappel** : ne PAS retirer les fonctionnalités V8 de `pwa-v2` (swap depuis bibliothèque,
commentaire par exercice, réordonnancement, minuteur de repos, auto-save localStorage
`ft_active_workout`, recap de fin, `handleSave` vers `sessions`). La maquette est plus
pauvre ; on **garde le riche** de prod en adoptant **la mise en page épurée** de la maquette.

---

## 6. Autres pages (fidélité DA, logique conservée)

Ces pages existent déjà dans `pwa-v2/src/pages/`. On **adopte les classes/structures**
de la maquette là où elles diffèrent, mais on **garde le fetch Supabase**.

| Page maquette | pwa-v2 file | Ce qu'on adopte | Logique conservée |
|---|---|---|---|
| `PageDashboard` (hero gradient néon, `.row-3` stat-cards, bulles semaine, `.row-split` WeekChart + dernières séances) | `pages/Dashboard.tsx` | Hero `linear-gradient(135deg, rgba(var(--neon-rgb),0.12)…)`, `.stat-card` (gradient + `--neon-rgb` border), `.session-row`, `WeekChart`/`.chart-*`. | Données réelles (séances, volumes) depuis `sessions`. |
| `PageHistory` (`.page-header`, `.search-bar`, cartes date badge) | `pages/History.tsx` | Structure cartes + badge date. | Fetch `sessions` par `user_id`. |
| `PageStats` (filtres période, `.pr-grid`, `.pr-card-stat`) | `pages/Stats.tsx` | `.pr-grid`, boutons période. | Chart.js réel + PRs calculés. |
| `PageExercises` (`.muscle-chips .chip`, `.ex-library-list .ex-lib-card`) | `pages/Exercises.tsx` | Chips muscles, cartes bibliothèque. | CRUD `exercises` + `set_measurement_type` (V8). |
| `PagePrograms` (`.prog-card`, `.prog-card-head`, `.day-row`, `.btn-train`) | `pages/Programs.tsx` | Cartes programme + bouton "Lancer" + **crayon par ligne** (Exigence 2). | Voir §4/§7. |
| `PageUpdates` (`.version-badge`, `.update-list`) | `pages/Updates.tsx` | Structure blocs de version. | Contenu MàJ. |
| (Mensurations — pas dans la maquette) | `pages/Mensurations.tsx` | **Graphique + sélecteur** (Exigence 6) dans la DA (TiltCard, néon, `.select-sm`). | Table `mensurations` : colonnes `poids, taille, tour_poitrine, tour_bras_g/d, tour_cuisse_g/d, tour_mollet_g/d, tour_taille, tour_hanche` — sélecteur listant **toutes** ces mesures ; tracer l'évolution depuis l'historique ; indiquer si données insuffisantes. |
| Cardio / Profile / DefaultPrograms / Report | pages homonymes | DA maquette (`.cardio-card`, `.profile-tabs`, etc.). | Logique Supabase + StoryExport + Mannequin conservés. |

---

## 7. Démarrage de séance depuis l'accueil / les programmes (fil rouge)

La maquette "lance" une séance avec des mocks. En prod, le démarrage passe par
`onStartWorkout(workout: WorkoutState)` (prop de `PagePrograms`, remonte à `App.tsx` qui
monte `<WorkoutScreen>`), déjà implémenté dans `Programs.tsx`.

**À préserver / réutiliser** (mapping `ProgramDay` → `WorkoutState`) :
```
onStartWorkout({
  progId, dayId, dayName, progName, startTs: Date.now(),
  exercises: muscuExs.map(ex => ({
    name, muscle, restSec, completed:false,
    measurementType: (ex.mode === 'time' ? 'seconds' : (libraryTypes[ex.name] || 'reps')),
    tempo: ex.tempo,
    rpeEnabled: ex.rpeEnabled,        // ← À AJOUTER pour piloter l'affichage RPE (Exigence 4)
    sets: Array.from({length: ex.sets}, () => ({
      weight:'', reps: ex.reps || ex.repsTarget || '', duration: ex.time || '',
      rpe:'', done:false, restLeft:0, restPaused:false
    }))
  }))
})
```
- Le bouton **"Lancer la séance"** de la carte d'accueil (§3) doit appeler ce même chemin.
  → passer `onStartWorkout` (ou un `navigate`+trigger) à `PageHome` comme le fait déjà
  `PagePrograms`. Filtrer le cardio comme actuellement (`isCardioExercise`).
- **Champ à propager** : `rpeEnabled` (et `mode`/`time`) depuis `programs.days` jusqu'à
  `WorkoutExercise`, pour que le WorkoutScreen affiche le RPE **seulement si** activé.

---

## 8. Réconciliation du modèle de données (CRITIQUE — rien ne doit casser)

### `programs.days` (jsonb)
**Existant `pwa-v2`** (par exercice) :
`{ id, name, muscle, sets, repsTarget, restSec, tempo }`
**Maquette** (par exercice) :
`{ name, muscle, sets, reps, mode, time, rpeEnabled, rpe }`

**Décision : fusion additive (on n'enlève rien).** Schéma cible d'un exercice de jour :
```ts
{
  id: string,             // CONSERVÉ (makeId) — la maquette n'en a pas ; on garde celui de prod
  name: string,
  muscle: string,
  sets: number,
  repsTarget: string,     // CONSERVÉ = "valeur reps" (le champ maquette 'reps' MAPPE ici)
  restSec: number,        // CONSERVÉ (pas dans la maquette — NE PAS DROP)
  tempo?: string,         // CONSERVÉ (pas dans la maquette — NE PAS DROP)
  mode: 'reps' | 'time',  // AJOUTÉ (défaut 'reps' ; init depuis exercises.set_measurement_type)
  time?: string,          // AJOUTÉ = valeur en secondes quand mode==='time'
  rpeEnabled: boolean,    // AJOUTÉ (défaut false)
  rpe?: string,           // AJOUTÉ (texte libre)
}
```
Règles de mapping maquette → prod :
- maquette `reps` → **`repsTarget`** (on ne crée pas de doublon `reps`).
- maquette `time` → **`time`** (secondes), avec `mode:'time'`.
- maquette `mode`/`rpeEnabled`/`rpe` → nouveaux champs, ajoutés tels quels.
- **Ne pas supprimer** `restSec` ni `tempo` (features V8/existantes).

**Rétro-compatibilité (lecture)** : les programmes existants n'ont ni `mode`, ni
`rpeEnabled`, ni `time`. À la lecture, appliquer des défauts (comme `normalizeProgram`
le fait déjà pour `repsTarget`/`tempo`) :
`mode = (set_measurement_type==='seconds' ? 'time' : 'reps')`,
`rpeEnabled = false`, `rpe = ''`, `time = ''`. Aucune migration destructive.

**Cohérence avec la table `exercises` (V8 `set_measurement_type`)** :
- À l'ajout d'un exercice au programme, initialiser `mode` depuis
  `libraryTypes[name]` (`'seconds'`→`'time'`, sinon `'reps'`).
- `mode` (par-exercice du programme) **prime** pour l'affichage, mais reste cohérent
  avec `set_measurement_type` par défaut (Exigence 7.2).

### `sessions.exercises[].sets` (WorkoutScreen)
**Existant** : `{ weight, reps, duration, rpe, done, restLeft, restPaused }` — **CONSERVÉ**.
- Sauvegarde (`handleSave`) : déjà conditionnelle sur `measurementType`
  (`seconds` → `{weight,duration,rpe}`, sinon `{weight,reps,rpe}`). **Ne pas changer.**
- **RPE** : la clé `rpe` est toujours écrite ; c'est **l'affichage** de l'input qui devient
  conditionnel à `exercise.rpeEnabled` (Exigence 4.2/4.3). `WorkoutExercise` doit donc
  gagner le champ `rpeEnabled?: boolean` (propagé depuis `programs.days`).

### Récapitulatif des champs ajoutés
| Emplacement | Champ ajouté | Type | Défaut | Raison |
|---|---|---|---|---|
| `programs.days[].exercises[]` | `mode` | `'reps'\|'time'` | `'reps'` (ou depuis `set_measurement_type`) | Exigence 7 |
| idem | `time` | `string` | `''` | Exigence 7 (secondes) |
| idem | `rpeEnabled` | `boolean` | `false` | Exigence 4 |
| idem | `rpe` | `string` | `''` | Exigence 4 |
| `WorkoutExercise` (runtime) | `rpeEnabled` | `boolean` | `false` | piloter affichage RPE |

---

## 9. CSS — classes ajoutées / modifiées vs `pwa-v2`

À **ajouter** dans `pwa-v2/src/index.css` (présentes maquette, absentes prod) :
- `.safe-area-top` (§2) — corrige la barre du haut.
- `.home-day-bubble.selected { outline: 2px solid var(--neon); outline-offset: 2px; }`.
- `.prog-layout`, `.prog-col-days`, `.prog-col-editor`, `.prog-col-catalog`,
  `.prog-back-btn`, `.prog-mobile-hide` (+ `.prog-desktop-separator`) et la media query
  `@media (max-width:700px)` (bottom-sheet modal + colonnes 100 % + back-btn visibles).
- `.modal-overlay`, `.modal`, `.modal-head`, `.modal-close`, `.modal-body`,
  `.modal-footer`, `.field`/`.field label` (styles du nouveau modal programme).

À **réaligner** (existent des deux côtés mais valeurs à harmoniser sur la maquette) :
- Blocs `[data-theme=…]` (voir §1) — remplacer valeurs `stitch`/`girly`/`light`,
  brancher `--neon-rgb` par thème.
- `.stat-card` (gradient `linear-gradient(135deg,var(--bg-panel) 60%, rgba(var(--neon-rgb),0.04))`
  + `border-color: rgba(var(--neon-rgb),0.12)`).
- `.btn-ghost` (style néon : fond `rgba(var(--neon-rgb),0.08)`, bordure/texte néon).
- `.tilt-card` (liseré `::after` néon au hover), `.home-card` (glow néon au hover).
- `.home-fab` (adopter carré 48 arrondi 14 + glow néon de la maquette).

À **conserver tel quel** en prod (spécifiques prod / V8) : `.wk-*`, toasts, spinner,
auth, `.home-day-card*` (déjà compact V8, à enrichir avec la liste d'exos de la maquette).

---

## 10. Table de synthèse — Exigences V8.1 → élément maquette → fichier(s)

| Exigence | Élément maquette qui la satisfait | Fichier(s) pwa-v2 | Logique Supabase préservée |
|---|---|---|---|
| **1** Tuiles accueil 1 clic | `TiltCard onClick` direct (pas de `<button display:contents>`) | `components/TiltCard.tsx`, `pages/Home.tsx` | fetch `programs` (daysWithSession) |
| **2** Crayon d'édition par séance | Cartes de jour cliquables + ouverture éditeur ciblé (§4) | `pages/Programs.tsx` (+ `ModalNewProgram.tsx`) | `.update({days}).eq('id',…)` |
| **3** Barre du haut + panneau jour | `.safe-area-top` + carte "séance du jour" non tronquée (§2/§3) | `App.tsx`, `index.css`, `pages/Home.tsx` | — |
| **4** RPE optionnel par exercice | `ExCard` case `rpeEnabled` + champ `rpe` ; WorkoutScreen RPE conditionnel | `ModalNewProgram.tsx`, `WorkoutScreen.tsx`, `pages/Programs.tsx` | `programs.days.rpeEnabled/rpe` ; save `rpe` |
| **5** Nom d'exercice complet | Header maquette : nom `flex:1 minWidth:0`, actions compactées | `WorkoutScreen.tsx`, `index.css` | swap/comment/reorder V8 conservés |
| **6** Graphique mensurations + sélecteur | (hors maquette) DA maquette appliquée (TiltCard/néon/`.select-sm`) | `pages/Mensurations.tsx` | table `mensurations` (toutes colonnes) |
| **7** Reps OU temps (créa + jour J) | `ExCard` pills Reps/Temps + input `s` ; toggle jour J au WorkoutScreen | `ModalNewProgram.tsx`, `WorkoutScreen.tsx` | `mode`/`time` dans `programs.days` ; save `reps`/`duration` ; `set_measurement_type` |
| **8** Cohérence DA | `--neon`/`--neon-rgb` par thème, Barlow Condensed, TiltCard ; 4 thèmes OK | `index.css`, `App.tsx` (switcher) | persistance `ft_theme` |

---

## 11. Ce qu'il ne faut SURTOUT PAS casser (checklist logique Supabase)

- **Auth** : `supabase.auth.signInWithPassword` / `signUp` / `onAuthStateChange` /
  `getSession` ; reset mot de passe (`PasswordResetModal`, event `PASSWORD_RECOVERY`).
- **Anti brute-force (V8)** : RPC `check_login_gate`, `record_login_failure`,
  `record_login_success` (degrade-open sur erreur) — conserver le flux exact de `App.tsx`.
- **Programmes** : `programs` (`insert`/`update`/`delete`), `normalizeProgram`,
  `loadLibraryNames` (`exercises.name` + `set_measurement_type`).
- **Séance** : auto-save localStorage `ft_active_workout`, restauration au chargement,
  `queryUsualWeights`/`queryLibrary`, `handleSave` → `sessions.insert`, recap de fin.
- **Autres** : `mensurations`, `cardio`, `StoryExport`, `Mannequin`, historique `sessions`.
- **Thème** : clés `dark|light|stitch|girly` conservées (persistance `ft_theme`) ; seules
  les **valeurs** CSS changent (mapping `egirl`→`girly`).

---

## 12. Rappel d'implémentation (fidélité)

1. **Copier**, ne pas réinventer : reprendre le JSX (mêmes classes, mêmes styles inline)
   et le CSS de la maquette bloc par bloc.
2. **Brancher** les données réelles : substituer les constantes mock
   (`DAY_SESSIONS`, `PROG_DAY`, `ALL_EXERCISES`, `LAST_SESSION_DATA`, `PROGRAMS`,
   `RECENT_SESSIONS`, `EXERCISES`) par les fetch/état Supabase déjà présents en prod.
3. **Étendre** le modèle `programs.days` de façon additive (§8) — jamais destructive.
4. **Conditionner** le RPE à `rpeEnabled` et brancher le toggle Reps/Temps (créa + jour J).
5. **Ajouter** `.safe-area-top` et le pattern TiltCard `onClick` (bugs 1 & 3).
6. Garder toute la logique métier V8 : la maquette n'est qu'une **peau**.
