# Requirements Document

## Introduction

V8 is a maintenance-and-enhancement release of the FitnessTracker PWA V2 (React + TypeScript + Vite + Supabase, located in `pwa-v2/`). It bundles fourteen distinct improvements spanning visual redesign, workout ergonomics, data-model corrections, security hardening, repository access control, and documentation.

The release covers: adopting the visual design from the `pwa-v2/2.0/` reference while removing intrusive animations; shrinking the home-page training tiles; adding an in-workout "usual weights" panel keyed on exercise name; trimming the mobile bottom navigation to only the home FAB; hardening Supabase session/cookie persistence and adding brute-force login protection; letting users swap an exercise mid-session by choosing from the exercise library (with the swap reflected in the saved recap); reordering exercises during a workout; correcting the "taille" measurement label; showing maximum reps per set (instead of the cumulative reps sum) on the Progress page; supporting reps-based OR seconds-based (duration) sets for exercises such as planks; making session and per-exercise comments reviewable afterward; adding a free-text "tempo" field to program exercises that is displayed again during the workout; making the GitHub repository private; and updating the project documentation.

This document specifies the behavioral requirements for all fourteen areas, including the concrete data-model changes required (tempo field, set measurement type, exercise swap persistence, and the taille label correction).

## Glossary

- **App**: The FitnessTracker PWA V2 React application located in `pwa-v2/`.
- **Design_System**: The collection of CSS styles, layout rules, and component visuals. V8 sources these from the `pwa-v2/2.0/` reference folder.
- **Home_Page**: The `Home.tsx` accueil page showing the brand, weekday bubbles, day-session tiles, and navigation cards.
- **Weekday_Bubble**: A day-of-week selector button on the Home_Page (L, M, M, J, V, S, D).
- **Day_Session_Tile**: A tile rendered under the Weekday_Bubbles that summarizes a training day's sessions when a day is selected.
- **Workout_Screen**: The `WorkoutScreen.tsx` full-screen overlay shown during an active training session.
- **Workout_Exercise**: An exercise entry within an active workout, stored as `{ name, muscle, restSec, completed, sets }`.
- **Workout_Set**: A single set within a Workout_Exercise, currently `{ weight, reps, rpe, done, restLeft, restPaused }`.
- **Usual_Weights_Panel**: A dismissible bubble/panel opened from an exercise header during a workout that displays the weights previously logged for that exercise name.
- **Exercise_Library**: The `exercises` Supabase table containing available exercises `{ id, name, muscle, description, created_by, is_default }`.
- **Session_History**: The `sessions` Supabase table containing saved workout sessions.
- **Mobile_Nav**: The bottom navigation bar (`mobile-nav`) shown on small viewports.
- **Home_FAB**: The floating home button (`home-fab`) that navigates to the Home_Page.
- **Supabase_Client**: The `@supabase/supabase-js` client configured in `src/lib/supabase.ts`.
- **Auth_Session**: The authenticated Supabase session and its persistence token (cookie/storage entry).
- **Login_Attempt**: A single email/password sign-in request submitted from the Auth screen.
- **Progress_Page**: The `Stats.tsx` page displaying charts and personal records.
- **Set_Measurement_Type**: The unit an exercise's sets are measured in — either `reps` or `seconds` (duration).
- **Program**: A training program in the `programs` Supabase table, containing `days`.
- **Program_Day**: A day within a Program, stored as `{ id, name, weekdays, exercises }`.
- **Program_Exercise**: An exercise within a Program_Day, stored as `{ id, name, muscle, sets, repsTarget, restSec }`.
- **Tempo**: A free-text descriptor of the movement cadence for a Program_Exercise (e.g. "3-0-1", "3011", "descente lente").
- **Session_Comment**: Free-text notes saved with a session (`notes` field) or attached to a specific exercise.
- **Mensuration_Entry**: A row in the `mensurations` Supabase table recording body measurements.
- **Documentation**: The project documentation files located in `docs/`.
- **Repository**: The GitHub repository `ElDamoss/FitnessTracker`.

## Requirements

### Requirement 1: Adopt 2.0 Design and Remove Animations

**User Story:** As a user, I want the app to use the refined 2.0 visual design without distracting animations, so that the interface feels modern, calm, and consistent.

#### Acceptance Criteria

1. THE App SHALL apply the Design_System styles sourced from the `pwa-v2/2.0/` reference across all pages and components.
2. THE Workout_Screen SHALL apply the Design_System styles consistently with the rest of the App.
3. WHERE a card element responds to pointer hover, THE App SHALL apply a static soft lift effect without a 3D mouse-tracking rotation.
4. THE App SHALL render the sporty gradient background defined by the 2.0 Design_System.
5. WHEN a pointer moves over a card, THE App SHALL NOT rotate the card based on cursor position.
6. THE App SHALL preserve all existing navigation and interaction behavior while the Design_System is updated.

### Requirement 2: Smaller Home-Page Training Tiles

**User Story:** As a user, I want the training-session tiles under the weekday bubbles to be smaller, so that I can see the day's sessions compactly without excessive scrolling.

#### Acceptance Criteria

1. WHEN a Weekday_Bubble is selected and that day has at least one session, THE Home_Page SHALL display each Day_Session_Tile at a reduced size compared to the V7 layout.
2. WHEN a Day_Session_Tile is displayed, THE Home_Page SHALL show the session name and its exercise summary within the reduced-size tile.
3. WHILE the reduced-size Day_Session_Tiles are displayed, THE Home_Page SHALL keep the session name and exercise names legible.
4. THE Home_Page SHALL keep the Weekday_Bubble row unchanged in size and position when reducing the Day_Session_Tile size.

### Requirement 3: In-Workout "Usual Weights" Panel Keyed on Exercise Name

**User Story:** As a user training on a machine, I want to open a small panel showing the weights I usually use for that exercise, so that I can quickly pick the right load.

#### Acceptance Criteria

1. WHERE a Workout_Exercise is displayed, THE Workout_Screen SHALL provide a control in the exercise header that opens the Usual_Weights_Panel for that exercise.
2. WHEN the Usual_Weights_Panel is opened for a Workout_Exercise, THE Workout_Screen SHALL query the user's Session_History for sets recorded under the exercise's current name.
3. WHEN historical sets exist for the exercise name, THE Usual_Weights_Panel SHALL display the previously recorded weights for that exercise name.
4. WHEN the current name of a Workout_Exercise changes, THE Workout_Screen SHALL base the Usual_Weights_Panel content on the new exercise name.
5. IF no historical sets exist for the exercise name, THEN THE Usual_Weights_Panel SHALL display a message indicating no history is available.
6. WHEN the user dismisses the Usual_Weights_Panel, THE Workout_Screen SHALL hide the panel and return to the exercise view.

### Requirement 4: Trim Mobile Bottom Navigation

**User Story:** As a user on mobile, I want a clean bottom navigation with only the home logo, so that the interface is uncluttered.

#### Acceptance Criteria

1. THE Mobile_Nav SHALL NOT display a "Programme" navigation button.
2. THE Mobile_Nav SHALL NOT display an "Accueil" navigation button.
3. THE App SHALL keep the Home_FAB available for navigating to the Home_Page.
4. WHERE no navigation buttons remain in the Mobile_Nav, THE App SHALL keep the Home_Page reachable through the Home_FAB and the sidebar navigation.

### Requirement 5: Session and Cookie Security Hardening

**User Story:** As a user, I want my login session to be non-permanent and protected against theft, so that my account stays secure.

#### Acceptance Criteria

1. THE Supabase_Client SHALL persist the Auth_Session in a storage mechanism that is cleared when the browser session ends rather than kept indefinitely.
2. THE App SHALL configure the Supabase_Client so that the Auth_Session is not retained as a permanent token after the browser session ends.
3. WHEN the browser session ends, THE App SHALL require re-authentication on the next visit rather than restoring a previously persisted permanent Auth_Session.
4. THE App SHALL avoid exposing the Auth_Session token in a location readable by third-party scripts beyond the storage required by the Supabase_Client.

### Requirement 6: Brute-Force Login Protection

**User Story:** As a user, I want repeated failed login attempts to be throttled, so that attackers cannot guess my password by brute force.

#### Acceptance Criteria

1. WHEN a Login_Attempt fails, THE App SHALL increment a failed-attempt counter associated with the submitted email identifier.
2. WHILE the failed-attempt counter for an identifier is at or above the configured threshold, THE App SHALL block further Login_Attempts for that identifier until the configured lockout window elapses.
3. WHEN a Login_Attempt succeeds, THE App SHALL reset the failed-attempt counter for that identifier.
4. WHILE Login_Attempts are blocked for an identifier, THE App SHALL display a message indicating that attempts are temporarily blocked.
5. WHEN the configured lockout window elapses, THE App SHALL allow Login_Attempts for that identifier again.

### Requirement 7: Swap Exercise From Library During Workout

**User Story:** As a user, I want to replace an exercise mid-session by choosing another from the exercise library, so that the swap is reflected accurately in the saved recap.

#### Acceptance Criteria

1. WHERE a Workout_Exercise is displayed, THE Workout_Screen SHALL provide a control to replace that exercise.
2. WHEN the user chooses to replace a Workout_Exercise, THE Workout_Screen SHALL present a selection of exercises from the Exercise_Library.
3. WHEN the user selects a replacement exercise from the selection, THE Workout_Screen SHALL update the Workout_Exercise name to the selected exercise's name.
4. WHEN the user selects a replacement exercise, THE Workout_Screen SHALL update the Workout_Exercise muscle to the selected exercise's muscle.
5. WHEN a session is saved after a replacement, THE Session_History SHALL store the replacement exercise's name for that Workout_Exercise.
6. WHEN the recap is displayed after a replacement, THE Workout_Screen SHALL show the replacement exercise's name.

### Requirement 8: Reorder Exercises During Workout

**User Story:** As a user, I want to reorder the exercises during an active workout, so that I can follow the order I actually train in.

#### Acceptance Criteria

1. WHERE at least two Workout_Exercises exist, THE Workout_Screen SHALL provide controls to change the position of a Workout_Exercise in the list.
2. WHEN the user moves a Workout_Exercise up or down, THE Workout_Screen SHALL update the displayed order to reflect the new position.
3. WHEN a Workout_Exercise is reordered, THE Workout_Screen SHALL preserve that exercise's sets, entered values, and completion state.
4. WHEN a session is saved after reordering, THE Session_History SHALL store the exercises in their reordered sequence.

### Requirement 9: Correct "Taille" Measurement Label

**User Story:** As a user recording measurements, I want the height field to be labeled "Taille", so that it is not confused with waist circumference.

#### Acceptance Criteria

1. THE Mensurations page SHALL label the height field "Taille".
2. THE Mensurations page SHALL label the waist-circumference field "Tour de taille" distinctly from the "Taille" field.
3. WHEN a Mensuration_Entry is saved, THE App SHALL store the "Taille" value in the `taille` field and the "Tour de taille" value in the `tour_taille` field without overwriting one with the other.
4. WHEN Mensuration_Entries are displayed, THE Mensurations page SHALL present the "Taille" and "Tour de taille" values under their respective labels.

### Requirement 10: Show Maximum Reps Per Set on Progress Page

**User Story:** As a user reviewing progress, I want to see the maximum reps performed in a single set for an exercise, so that I understand my peak performance instead of a cumulative total.

#### Acceptance Criteria

1. WHEN the Progress_Page displays a repetition metric for an exercise, THE Progress_Page SHALL show the maximum reps recorded in a single set of that exercise.
2. THE Progress_Page SHALL NOT display the sum of reps across all sets as the repetition metric for an exercise.
3. WHEN multiple sessions contain the exercise, THE Progress_Page SHALL compute the maximum single-set reps across the selected time period.
4. IF an exercise has no recorded reps in the selected period, THEN THE Progress_Page SHALL indicate that no repetition data is available.

### Requirement 11: Reps-Based or Seconds-Based Set Measurement

**User Story:** As a user creating exercises such as planks, I want to choose whether sets are measured in reps or in seconds and confirm that choice when starting a session, so that duration-based exercises are tracked correctly.

#### Acceptance Criteria

1. WHEN a user creates or edits an exercise, THE App SHALL allow selecting a Set_Measurement_Type of either `reps` or `seconds`.
2. THE App SHALL store the selected Set_Measurement_Type with the exercise.
3. WHEN a session is started for an exercise, THE Workout_Screen SHALL confirm the Set_Measurement_Type for that exercise.
4. WHERE the Set_Measurement_Type is `seconds`, THE Workout_Screen SHALL capture each set's value as a duration in seconds instead of a repetition count.
5. WHEN a session with a `seconds` Set_Measurement_Type is saved, THE Session_History SHALL store the set value under a duration measurement.
6. WHEN a session or history entry containing a `seconds` set is displayed, THE App SHALL present the value labeled as seconds rather than reps.

### Requirement 12: Reviewable Comments

**User Story:** As a user, I want to re-read the comments I wrote, so that I can recall my notes about a past session.

#### Acceptance Criteria

1. WHEN a session with a Session_Comment is opened in the history detail view, THE App SHALL display the saved Session_Comment text.
2. WHERE an exercise has an attached comment, THE App SHALL display that exercise comment in the history detail view.
3. THE App SHALL persist Session_Comments so that they remain available for later review.
4. IF a session has no Session_Comment, THEN THE App SHALL indicate that no comment was recorded for that session.

### Requirement 13: Program Exercise Tempo

**User Story:** As a user creating a program, I want to set a free-text tempo per exercise and see it again on training day, so that I follow the intended cadence.

#### Acceptance Criteria

1. WHEN a user configures a Program_Exercise, THE App SHALL provide a free-text Tempo field.
2. THE App SHALL accept any text value for the Tempo field, including empty.
3. WHEN a Program is saved, THE App SHALL store the Tempo value with its Program_Exercise.
4. WHEN a workout is started from a Program_Day, THE Workout_Screen SHALL display the Tempo value for each exercise that has one.
5. WHERE a Program_Exercise has no Tempo value, THE Workout_Screen SHALL omit the tempo display for that exercise.

### Requirement 14: Private GitHub Repository

**User Story:** As the project owner, I want the GitHub repository set to private, so that others cannot take my code.

#### Acceptance Criteria

1. THE Documentation SHALL include written instructions for changing the visibility of the Repository to private through the GitHub dashboard.
2. THE Documentation SHALL describe the consequences of making the Repository private, including impact on any deployment or public links.

### Requirement 15: Update Documentation

**User Story:** As the project owner, I want the documentation updated for V8, so that the docs reflect the current behavior of the app.

#### Acceptance Criteria

1. THE Documentation SHALL describe the V8 design change and animation removal.
2. THE Documentation SHALL describe the V8 workout enhancements, including the Usual_Weights_Panel, exercise swap, exercise reordering, and Tempo display.
3. THE Documentation SHALL describe the V8 data-model changes, including the Set_Measurement_Type, the Tempo field, and the "Taille" label correction.
4. THE Documentation SHALL describe the V8 security changes, including session persistence and brute-force protection.
5. THE Documentation SHALL record the V8 changes in the project changelog.
