# Implementation Plan: FitnessTracker V8

## Overview

This plan implements the fifteen V8 improvements in `pwa-v2/` (React 19 + TypeScript + Vite + Supabase), grouped by theme so related files aren't churned repeatedly. Work proceeds in the design-ordered themes: design/CSS foundation → data-model SQL migrations → security wiring → workout features → exercises → programs → stats → history → mensurations verification → documentation.

Testing uses **Vitest + @testing-library/react + jsdom** for unit/DOM tests and **fast-check** for the property-based tests (Properties 1–15 from design.md), each running a minimum of 100 iterations and tagged `// Feature: v8-fitnesstracker, Property N`. Test sub-tasks are marked optional with `*`.

SQL tasks are executed by the user directly in the Supabase SQL editor and are clearly marked; they are not code the agent runs.

## Tasks

- [x] 1. Test framework setup
  - Add dev dependencies `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `fast-check` to `pwa-v2/package.json`
  - Add a `"test": "vitest run"` script and a `test` config block in `vite.config.ts` (environment `jsdom`, globals enabled, setup file)
  - Create `pwa-v2/src/test/setup.ts` importing `@testing-library/jest-dom`
  - _Requirements: supports all property/unit tests below_

- [x] 2. Design and CSS foundation
  - [x] 2.1 Port the 2.0 stylesheet into `src/index.css`
    - Copy the sporty gradient background (`body::before`/`body::after`) and the static `.tilt-card:hover { transform: translateY(-3px) }` + neon glow / `::after` top-edge rules and `.home-card` static hover from `pwa-v2/2.0/src/index.css`
    - Preserve the four existing theme blocks (default/dark, `light`, `stitch`, `girly`)
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.2 Convert `src/components/TiltCard.tsx` to static
    - Remove mouse-tracking state (`tilt`, `shine`, `onMouseMove`) and the inline `perspective(...) rotateX/rotateY` transform and the `.card-shine` div
    - Render a plain `div.tilt-card` keeping the same public API (`children`, `className`, `style`); all hover motion comes from CSS
    - _Requirements: 1.3, 1.5, 1.6_

  - [x]* 2.3 Write unit test for TiltCard static behavior
    - Assert rendered element has no `rotateX`/`rotateY`/`perspective` transform and that dispatching a `mousemove` does not change its inline style
    - Assert `index.css` contains the 2.0 gradient and `.tilt-card:hover` lift rules (snapshot/string check)
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 2.4 Remove the mobile bottom navigation bar in `src/App.tsx`
    - Delete the entire `<nav className="mobile-nav">` block (all five buttons); keep the `home-fab` button intact
    - Verify sidebar navigation still reaches every page and the FAB reaches Home
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x]* 2.5 Write unit test for trimmed navigation
    - Assert no `.mobile-nav` element is rendered and the `.home-fab` is present and navigates to Home
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.6 Shrink Home-page day-session tiles in `src/pages/Home.tsx`
    - Introduce a compact `.home-day-session` style so each Day_Session_Tile is smaller than V7 while keeping session name and exercise names legible
    - Keep the Weekday_Bubble row unchanged in size and position
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 2.7 Write property test for compact day-session tile rendering
    - **Property 1: Day-session tile renders session name and all exercise names**
    - Generate a day with a name and list of exercise names; assert rendered compact tile contains the name and every exercise name
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 1`
    - **Validates: Requirements 2.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Data-model migrations (SQL — USER RUNS IN SUPABASE)
  - [x] 4.1 Add `set_measurement_type` column to `exercises` (USER RUNS IN SUPABASE)
    - In the Supabase SQL editor, run the `alter table public.exercises add column if not exists set_measurement_type text not null default 'reps' check (set_measurement_type in ('reps','seconds'));` DDL from design.md
    - This is a manual Supabase step, not agent-run code
    - _Requirements: 11.2_

  - [x] 4.2 Create `login_attempts` table and the three SECURITY DEFINER RPCs (USER RUNS IN SUPABASE)
    - In the Supabase SQL editor, run the exact DDL from design.md: the `login_attempts` table (with RLS enabled, no policies) and functions `check_login_gate`, `record_login_failure`, `record_login_success`, plus the `grant execute ... to anon, authenticated` statements
    - Confirm `MAX_ATTEMPTS = 5` and `LOCK_WINDOW = interval '15 minutes'` constants
    - This is a manual Supabase step, not agent-run code
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 5. Security wiring
  - [x] 5.1 Configure session storage in `src/lib/supabase.ts`
    - Pass an `auth` config to `createClient` with `storage: window.sessionStorage`, `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` per design.md
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]* 5.2 Write smoke test for session storage config
    - Assert the client's configured `auth.storage === window.sessionStorage`
    - _Requirements: 5.1, 5.2_

  - [x] 5.3 Implement brute-force client flow in `AuthScreen.handleSubmit` (`src/App.tsx`)
    - Before sign-in, call `rpc('check_login_gate', { p_identifier })`; if blocked, show "Trop de tentatives…" with the `locked_until` time and stop
    - On sign-in error, call `rpc('record_login_failure', { p_identifier })` and show blocked message if now blocked, else the credential error
    - On success, call `rpc('record_login_success', { p_identifier })`
    - Treat `check_login_gate` network/DB errors as degraded-open (attempt sign-in, non-blocking toast) per Error Handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 5.4 Write property test: failed login increments counter
    - **Property 12: A failed login increments the attempt counter by one**
    - Validate against a faithful in-memory model of the RPC logic
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 12`
    - **Validates: Requirements 6.1**

  - [x]* 5.5 Write property test: threshold blocks further attempts
    - **Property 13: Reaching the threshold blocks further attempts within the window**
    - Use the in-memory model with an injected clock for deterministic window timing
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 13`
    - **Validates: Requirements 6.2**

  - [x]* 5.6 Write property test: success resets the counter
    - **Property 14: A successful login resets the counter**
    - Validate against the in-memory model
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 14`
    - **Validates: Requirements 6.3**

  - [x]* 5.7 Write property test: lock releases after window elapses
    - **Property 15: The lock is released after the window elapses**
    - Use the in-memory model with an injected clock advanced past `locked_until`
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 15`
    - **Validates: Requirements 6.5**

  - [x]* 5.8 Write integration test for the real throttle RPCs
    - Exercise the real `check_login_gate` / `record_login_failure` / `record_login_success` against a Supabase test project to confirm the in-memory model matches server behavior (1–3 representative examples)
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Workout features in `src/components/WorkoutScreen.tsx`
  - [x] 7.1 Extend WorkoutSet and WorkoutExercise types and save payload
    - Add `duration: string` to `WorkoutSet`; add `measurementType: 'reps'|'seconds'`, `tempo?: string`, `comment?: string` to `WorkoutExercise`
    - Extend `handleSave` to map current `name`/`muscle`, `measurementType`, per-exercise `comment`, and per-set reps-or-duration into the `sessions.exercises` payload (exercises in current display order)
    - Use defensive defaults for legacy rows lacking new fields
    - _Requirements: 7.5, 8.4, 11.5, 12.3_

  - [x] 7.2 Implement the Usual_Weights_Panel
    - Add `queryUsualWeights(name)` (query last 30 sessions, filter sets by current exercise name) and a per-exercise-header toggle button (`usualOpen` keyed by index)
    - Render previously recorded weights; show "Aucun historique pour cet exercice." when empty; provide a close control; re-query on name change/swap
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 7.3 Write property test for usual-weights query filtering
    - **Property 2: Usual-weights query is filtered by exercise name**
    - Generate session history and an exercise name; assert every returned set came from that exact name and none from other names; empty when no match
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 2`
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [x] 7.4 Implement the swap-from-library picker
    - Add a swap icon button per exercise header opening a picker of `exercises` library rows (reuse muscle-chip + search pattern); selecting a row sets `ex.name` and `ex.muscle` in place, preserving that exercise's sets
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

  - [x]* 7.5 Write property test for exercise swap
    - **Property 3: Exercise swap updates name and muscle and is reflected on save**
    - Generate a workout exercise and a replacement; assert name/muscle updated, sets/entered values unchanged, and save payload carries the replacement name/muscle
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 3`
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6**

  - [x] 7.6 Implement reorder up/down controls
    - Add up/down chevron buttons per exercise (disabled at ends) that swap adjacent entries via `structuredClone`, preserving each exercise's sets, entered values, and `completed` state
    - _Requirements: 8.1, 8.2, 8.3_

  - [x]* 7.7 Write property test for reordering
    - **Property 4: Reordering is an order-only permutation that preserves exercise data and is saved in order**
    - Generate a workout exercise list and a valid move; assert result is an adjacent-swap permutation with unchanged exercise objects and save payload in current order
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 4`
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [x] 7.8 Implement reps-vs-seconds set input and tempo display
    - When `measurementType === 'seconds'`, render the value column as a seconds input labeled "s" and route `adjustValue`/`updateSet` to `duration`; otherwise use `reps` unchanged
    - Show a "Tempo: {tempo}" chip under the exercise name when `ex.tempo` is truthy; omit otherwise
    - _Requirements: 11.3, 11.4, 13.4, 13.5_

  - [x]* 7.9 Write property test for set-type routing
    - **Property 7: Set measurement type routes the value to duration or reps end to end**
    - Generate exercises of each type; assert `seconds` stores in `duration` (reps empty) and displays as seconds, `reps` stores in `reps` (duration empty) and displays as reps
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 7`
    - **Validates: Requirements 11.4, 11.5, 11.6**

  - [x]* 7.10 Write property test for tempo display presence
    - **Property 11: Tempo is displayed exactly when present**
    - Generate program exercises; assert the workout carries tempo and renders the indicator iff tempo is a non-empty string
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 11`
    - **Validates: Requirements 13.4, 13.5**

  - [x] 7.11 Implement per-exercise comment field
    - Add a collapsible note field per exercise writing `ex.comment`, included in the save payload (from 7.1)
    - _Requirements: 12.2, 12.3_

  - [x]* 7.12 Write property test for comment round-trip
    - **Property 8: Session and per-exercise comments round-trip through persistence**
    - Generate a session note and per-exercise comments; build save payload then read back; assert values unchanged
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 8`
    - **Validates: Requirements 12.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Exercises set-measurement-type field in `src/pages/Exercises.tsx`
  - [x] 9.1 Add a Reps/Secondes select to the create/edit form
    - Bind to `set_measurement_type`, default `'reps'`, persist to the `exercises` table on create/edit
    - _Requirements: 11.1, 11.2_

  - [x]* 9.2 Write unit test for the set-type select
    - Assert the select renders both options and submits the chosen `set_measurement_type`
    - _Requirements: 11.1_

- [x] 10. Programs day/exercise editor in `src/pages/Programs.tsx`
  - [x] 10.1 Standardize `repsTarget` to string and build the day/exercise editor
    - Change `repsTarget` type to `string` (support ranges like "8-12")
    - Add an expandable editor per program card: add/remove days; per day add/remove exercises with fields `name`, `muscle`, `sets` (number), `repsTarget` (string), `restSec` (number), and free-text optional `tempo`; save the whole `days` jsonb back to `programs`
    - _Requirements: 13.1, 13.2, 13.3_

  - [x]* 10.2 Write property test for tempo round-trip
    - **Property 10: Program exercise tempo round-trips as free text**
    - Generate a tempo string (including empty); save a program with it then reload; assert exact same value
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 10`
    - **Validates: Requirements 13.2, 13.3**

  - [x] 10.3 Add optional tempo to default-program templates in `src/pages/DefaultPrograms.tsx`
    - Add optional `tempo?: string` to the `ProgramExercise` type and templates
    - _Requirements: 13.1, 13.3_

  - [x] 10.4 Map tempo and measurement type into workout start
    - When starting a workout from a Program_Day, map `ex.tempo` → `WorkoutExercise.tempo` and the exercise's `set_measurement_type` (looked up from the library by name) → `WorkoutExercise.measurementType`
    - _Requirements: 11.3, 13.4_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Stats max single-set reps metric in `src/pages/Stats.tsx`
  - [x] 12.1 Add the "Reps max (série)" metric
    - Compute the maximum single-set `reps` (never a sum) for the selected exercise across the selected period; render a headline number and plot with the existing `SimpleLineChart`; show "Aucune donnée de répétitions." when none
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x]* 12.2 Write property test for the max-reps metric
    - **Property 6: Progress reps metric is the maximum single-set reps over the period**
    - Generate sessions with an exercise; assert metric equals the max single-set reps, is ≥ every set's reps, and never equals the sum when >1 nonzero set exists
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 6`
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 13. History comments and seconds label in `src/pages/History.tsx`
  - [x] 13.1 Render session notes, per-exercise comments, and seconds labels
    - In the expanded detail, render `s.notes` in an italic "Commentaire" block, or "Aucun commentaire enregistré." when absent
    - Render each exercise's `comment` when present
    - For a set with `st.duration` (and no weight/reps), label it "{duration}s" instead of reps
    - _Requirements: 11.6, 12.1, 12.2, 12.4_

  - [x]* 13.2 Write property test for history comment display
    - **Property 9: History detail displays every stored comment**
    - Generate a saved session; assert rendered detail contains the session note (when present) and each exercise comment (when present)
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 9`
    - **Validates: Requirements 12.1, 12.2**

- [x] 14. Mensurations taille verification in `src/pages/Mensurations.tsx`
  - [x] 14.1 Verify taille / tour_taille wiring
    - Confirm the height field is labeled "Taille" (stored in `taille`) and the waist field "Tour de taille" (stored in `tour_taille`) as distinct fields with no overwrite in `handleSubmit`; make no functional change unless a defect is found
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x]* 14.2 Write property test for taille/tour_taille independence
    - **Property 5: Measurement value payload keeps taille and tour_taille independent**
    - Generate height and waist values; assert the built payload stores height in `taille` and waist in `tour_taille` with neither overwriting the other
    - `fast-check`, `{ numRuns: 100 }`, tag `// Feature: v8-fitnesstracker, Property 5`
    - **Validates: Requirements 9.3**

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Documentation and changelog
  - [x] 16.1 Update project docs and release note
    - Update `docs/` (and `docs/changelog.html`) and add the `update/` V8 release note describing the design/animation change, workout enhancements (usual weights, swap, reorder, tempo), data-model changes (`set_measurement_type`, `tempo`, taille), and security changes (session persistence, brute-force protection)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 16.2 Add the V8 changelog block to `src/pages/Updates.tsx`
    - Add an in-app changelog entry summarizing the V8 changes
    - _Requirements: 15.5_

  - [x] 16.3 Write GitHub-make-private instructions with consequences
    - In `docs/`, add written steps to set the Repository visibility to private via the GitHub dashboard and describe the consequences, noting the pwa-v1 Cloudflare Pages deployment on fitnesstracker.bzh keeps working (private source does not affect the deployed site)
    - This is documentation only — do NOT perform the GitHub dashboard action
    - _Requirements: 14.1, 14.2_

- [x] 17. Final verification
  - Run `npx tsc --noEmit` and `npm run build` in `pwa-v2/` and confirm both succeed
  - Run the vitest suite (`npm run test`) and confirm all unit and property tests pass
  - _Requirements: all_

## Notes

- Tasks marked with `*` are optional (test-related) and can be skipped for a faster MVP.
- SQL tasks (4.1, 4.2) are run by the user in the Supabase SQL editor, not by the coding agent.
- The GitHub "make private" dashboard action is documentation only (16.3) and is intentionally not a code task.
- Each task references the specific requirement sub-clauses it satisfies for traceability.
- Property tests validate universal correctness Properties 1–15 from design.md with `fast-check` at ≥100 runs; unit/smoke tests validate specific examples, edge messages, and configuration.
- Checkpoints ensure incremental validation between themes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1", "4.2"] },
    { "id": 1, "tasks": ["2.2", "2.4", "2.6", "5.1", "9.1"] },
    { "id": 2, "tasks": ["2.3", "2.5", "2.7", "5.2", "5.3", "9.2"] },
    { "id": 3, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.8", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.4", "7.6", "7.8", "7.11"] },
    { "id": 5, "tasks": ["7.3", "7.5", "7.7", "7.9", "7.10", "7.12"] },
    { "id": 6, "tasks": ["10.1", "10.3", "12.1", "13.1", "14.1"] },
    { "id": 7, "tasks": ["10.2", "10.4", "12.2", "13.2", "14.2"] },
    { "id": 8, "tasks": ["16.1", "16.2", "16.3"] }
  ]
}
```
