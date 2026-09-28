# Push-Up Discipline PWA Architecture Specification

## 1. Data Schema
The complete JSON schema for workout data stored in IndexedDB.

### Workout Records (Object Store: 'workouts')
Each record is keyed by a date string (`YYYY-MM-DD`).

```typescript
type DateString = string; // Format: YYYY-MM-DD
type ISO8601String = string;

interface Set {
  reps: number; // Constraints: 0 <= reps <= 999
  timestamp: ISO8601String;
}

interface Session {
  sets: [Set, Set, Set]; // Exactly 3 sets
  completed: boolean;
}

interface DayRecord {
  date: DateString; // Primary Key
  morning: Session;
  evening: Session;
  notes: string; // Optional user notes
}
```

### Metadata (Object Store: 'meta')
Streak metadata and user settings. Keyed by a string key.

```typescript
interface StreakMetadata {
  key: "streak_metadata";
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: DateString | null;
}
```

## 2. State Machine

The application follows a Finite State Machine (FSM) model to manage UI and data flows.

### States
- `IDLE`: Default state, viewing the dashboard.
- `LOGGING_TODAY`: Actively logging sets for the current day's sessions.
- `HISTORY_REVIEW`: Browsing past records and streak history.
- `RETROACTIVE_EDIT`: Editing or logging a past day's session.
- `EXPORTING`: Generating and downloading a data export.
- `IMPORTING`: Uploading and parsing a data import.
- `ERROR`: A global error state for storage failures or critical issues.

### Transitions & Trigger Events
- `IDLE` -> `LOGGING_TODAY`: User taps "Log Workout" or selects today's card.
- `IDLE` -> `HISTORY_REVIEW`: User navigates to the History tab.
- `IDLE` -> `EXPORTING`: User initiates data export in settings.
- `IDLE` -> `IMPORTING`: User initiates data import in settings.
- `LOGGING_TODAY` -> `IDLE`: Workout saved or logging cancelled.
- `HISTORY_REVIEW` -> `IDLE`: User navigates back to dashboard.
- `HISTORY_REVIEW` -> `RETROACTIVE_EDIT`: User selects a specific past day to edit.
- `RETROACTIVE_EDIT` -> `HISTORY_REVIEW`: Edit saved or cancelled.
- `EXPORTING` -> `IDLE`: Export completes successfully or is cancelled.
- `IMPORTING` -> `IDLE`: Import completes successfully.
- `*` -> `ERROR`: Storage quota exceeded, indexedDB access denied, parsing error.
- `ERROR` -> `IDLE`: User dismisses error / system recovers.

## 3. Storage Architecture

- **Primary Storage**: IndexedDB
  - **Database Name**: `pushup-discipline`
  - **Object Store 1**: `workouts` (keyPath: `date`)
  - **Object Store 2**: `meta` (keyPath: `key`)
- **Fallback Strategy**: If IndexedDB is unavailable (e.g., private browsing mode constraints), fall back to `localStorage`. The same schema is serialized to JSON under keys `pushup_workouts_${date}` and `pushup_meta_${key}`.
- **Quota Management**: Monitor storage quota using the StorageManager API (`navigator.storage.estimate()`). Show a warning in the UI if capacity reaches >= 80%.

## 4. Edge Cases & Boundary Conditions

- **Midnight Workouts**: If a workout is logged between 00:00 and 03:00, attribute it to the previous calendar day's evening session (3-hour grace window).
- **Timezone Changes / Travel**: Date strings (`YYYY-MM-DD`) are generated based on local time at the moment of logging. When travelling across timezones, the local date where the user logs the workout is used to prevent skipping/duplicate days.
- **Leap Years**: Native Date objects handle leap years for YYYY-MM-DD generation. Calendar views must correctly render Feb 29.
- **Rep Constraints**: 
  - 0 reps are allowed (indicates missed or zero-effort set).
  - Negative reps are rejected (input validation prevents this).
  - > 999 reps are capped at 999 to prevent overflow/unrealistic data.
- **Future Date Prevention**: The UI disables logging or retroactively editing any date that is chronologically in the future relative to the user's current local date.
- **Partial Sessions**: A session can have 1 or 2 sets logged out of 3. `session.completed` evaluates to `true` only when all 3 sets are logged. Partial sessions do not increment the streak.
- **Data Corruption Recovery**: If a record cannot be parsed, log a console error and present an option to reset that specific day's record or clear the entire DB if completely corrupted. Export raw corrupted JSON if possible.
- **Browser Storage Cleared Externally**: If the OS or user clears browser data, warn the user upon next load that local data was lost. Mitigation relies on users utilizing the EXPORT/IMPORT feature regularly.

## 5. User Stories & Acceptance Criteria

1. **User Story**: As a user, I want to log my morning push-up sets so that I can track my progress.
   - *AC*: I can input reps for up to 3 sets. Timestamps are auto-generated.
2. **User Story**: As a user, I want to log my evening push-up sets to complete my daily goal.
   - *AC*: UI clearly separates morning and evening sessions. I can log evening sets independently.
3. **User Story**: As a user, I want to see my current streak on the dashboard to stay motivated.
   - *AC*: Current streak is calculated based on consecutive days of fully completed sessions (both morning and evening) and displayed prominently.
4. **User Story**: As a user, I want to view my past workouts in a calendar or list view.
   - *AC*: History tab displays past logs, indicating complete/incomplete days.
5. **User Story**: As a user, I want to edit a past day's log because I forgot to enter my sets.
   - *AC*: I can select a past day and add/edit sets. Streak recalculates accordingly.
6. **User Story**: As a user, I want to export my data as a JSON file to keep a backup.
   - *AC*: Export function creates a complete JSON file of all `workouts` and `meta` stores.
7. **User Story**: As a user, I want to import my previously exported data to restore my history on a new device.
   - *AC*: Import function merges or replaces current data based on user confirmation.
8. **User Story**: As a user logging sets at 1:00 AM, I want it to count for "yesterday's" evening session.
   - *AC*: Workouts logged between 00:00 and 03:00 local time automatically default to the previous date.
9. **User Story**: As a user, I want to be stopped from entering unrealistic numbers of reps.
   - *AC*: Rep inputs are restricted to positive integers between 0 and 999.
10. **User Story**: As a user, I want to add notes to my daily record to remember how I felt.
    - *AC*: A text field is available for each day to save optional string notes.
11. **User Story**: As a user, I want my app to work offline so I can log workouts anywhere.
    - *AC*: Application relies entirely on IndexedDB/localStorage and Service Worker caching, requiring no network connection to log sets.
12. **User Story**: As a user, I want to be warned if my device storage is almost full.
    - *AC*: App checks `navigator.storage.estimate()` and displays a persistent warning banner if usage > 80%.
