-- ============================================================
-- V8.3 — Affinage des groupes musculaires (bas du corps détaillé)
-- Remplace les muscles génériques "Jambes" / "Cuisses" / "Ischios" /
-- "Abdos" par des groupes plus précis alignés sur le sélecteur de
-- création d'exercice.
--
-- Nouveaux groupes (sélecteur) :
--   Haut du corps : Pectoraux, Dos, Épaules, Biceps, Triceps, Avant-bras
--   Tronc         : Abdominaux, Obliques, Lombaires
--   Jambes        : Quadriceps, Ischio-jambiers, Mollets, Adducteurs, Abducteurs
--   Fessiers      : Grand fessier, Moyen fessier, Petit fessier
--   Autre         : Cardio, Full body
--
-- À exécuter dans : Supabase → SQL Editor → New query → Run.
-- Sûr à relancer plusieurs fois (idempotent).
-- ============================================================

-- 1) MOLLETS
update public.exercises set muscle = 'Mollets'
where muscle in ('Jambes','Cuisses')
  and (lower(name) like '%mollet%' or lower(name) like '%calf%' or lower(name) like '%calves%');

-- 2) ISCHIO-JAMBIERS (leg curl, soulevé roumain, ischios…)
update public.exercises set muscle = 'Ischio-jambiers'
where muscle in ('Jambes','Cuisses','Ischios')
  and (
    lower(name) like '%ischio%'
    or lower(name) like '%leg curl%'
    or lower(name) like '%curl assis%'
    or lower(name) like '%curl couch%'
    or lower(name) like '%roumain%'
    or lower(name) like '%hamstring%'
  );

-- 3) ADDUCTEURS
update public.exercises set muscle = 'Adducteurs'
where muscle in ('Jambes','Cuisses')
  and (lower(name) like '%adducteur%' or lower(name) like '%adductor%');

-- 4) ABDUCTEURS
update public.exercises set muscle = 'Abducteurs'
where muscle in ('Jambes','Cuisses','Fessiers')
  and (lower(name) like '%abducteur%' or lower(name) like '%abductor%');

-- 5) QUADRICEPS : le reste des "Jambes"/"Cuisses"/"Ischios" (squat, presse,
--    fentes, leg extension, hack squat…)
update public.exercises set muscle = 'Quadriceps'
where muscle in ('Jambes','Cuisses','Ischios');

-- 6) FESSIERS génériques → Grand fessier (le plus courant : hip thrust, etc.)
--    (les moyen/petit fessier restent à choisir manuellement à la création)
update public.exercises set muscle = 'Grand fessier'
where muscle = 'Fessiers';

-- 7) ABDOS → Abdominaux (renommage simple)
update public.exercises set muscle = 'Abdominaux'
where muscle = 'Abdos';

-- ============================================================
-- 8) (Optionnel) Programmes existants (colonne JSON `days`).
--    Renomme les muscles génériques dans les exercices planifiés.
--    Décommente pour l'exécuter (PostgreSQL/jsonb requis).
-- ============================================================
-- update public.programs p
-- set days = (
--   select jsonb_agg(
--     day || jsonb_build_object('exercises', (
--       select jsonb_agg(
--         case ex->>'muscle'
--           when 'Jambes'  then jsonb_set(ex, '{muscle}', '"Quadriceps"'::jsonb)
--           when 'Cuisses' then jsonb_set(ex, '{muscle}', '"Quadriceps"'::jsonb)
--           when 'Ischios' then jsonb_set(ex, '{muscle}', '"Ischio-jambiers"'::jsonb)
--           when 'Abdos'   then jsonb_set(ex, '{muscle}', '"Abdominaux"'::jsonb)
--           when 'Fessiers' then jsonb_set(ex, '{muscle}', '"Grand fessier"'::jsonb)
--           else ex
--         end
--       )
--       from jsonb_array_elements(coalesce(day->'exercises', '[]'::jsonb)) ex
--     ))
--   )
--   from jsonb_array_elements(p.days) day
-- )
-- where p.days::text ~ '"muscle":"(Jambes|Cuisses|Ischios|Abdos|Fessiers)"';

-- ============================================================
-- Vérification :
-- select muscle, count(*) from public.exercises group by muscle order by muscle;
-- ============================================================
