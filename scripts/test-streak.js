const assert = require('assert');

// Mock Dates utilities
const Dates = {
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  getEffectiveDate() {
    return new Date('2026-11-01T12:00:00');
  },
  addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
};

function isWorkoutValid(w) {
  if (!w) return false;
  const morningSets = (w.morning?.sets || []).filter(s => (Number(s.reps) || 0) > 0).length;
  const eveningSets = (w.evening?.sets || []).filter(s => (Number(s.reps) || 0) > 0).length;
  const emomRounds = (w.emom || []).reduce((sum, e) => sum + (Number(e.completedRounds) || 0), 0);
  const totalSets = morningSets + eveningSets + emomRounds;
  return totalSets >= 3;
}

function calculateStreak(allWorkouts, effectiveDate = Dates.getEffectiveDate()) {
  if (!allWorkouts || allWorkouts.length === 0) {
    return {
      current: 0,
      longest: 0,
      lastDate: null,
      restDays: [],
      availableRestDays: 0,
      consecutiveTrainingDays: 0,
      isRestDayToday: false
    };
  }

  const validWorkouts = allWorkouts
    .filter(isWorkoutValid)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (validWorkouts.length === 0) {
    return {
      current: 0,
      longest: 0,
      lastDate: null,
      restDays: [],
      availableRestDays: 0,
      consecutiveTrainingDays: 0,
      isRestDayToday: false
    };
  }

  const validDatesSet = new Set(validWorkouts.map(w => w.date));
  const todayStr = Dates.formatDate(effectiveDate);
  const firstDateStr = validWorkouts[0].date;
  const lastValidDate = validWorkouts[validWorkouts.length - 1].date;

  // We loop day by day from first valid date up to today (or last valid date if ahead of today)
  let curr = new Date(firstDateStr + 'T00:00:00');
  const endDateStr = firstDateStr > todayStr ? firstDateStr : todayStr;
  const end = new Date(endDateStr + 'T00:00:00');

  let currentStreak = 0;
  let longestStreak = 0;
  let consecutiveTrainingDays = 0;
  let availableRestDays = 0;
  const restDaysSet = new Set();
  let lastActiveDate = null;

  while (curr <= end) {
    const dStr = Dates.formatDate(curr);
    const hasValidWorkout = validDatesSet.has(dStr);

    if (hasValidWorkout) {
      consecutiveTrainingDays++;
      if (consecutiveTrainingDays >= 4) {
        availableRestDays = 1; // 4 trainings give 1 rest day, capped at 1 (no stacking)
      }
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
      lastActiveDate = dStr;
    } else {
      // No workout on this day
      if (dStr < todayStr) {
        // Day is in the past
        if (availableRestDays > 0) {
          // Trigger rest day automatically!
          restDaysSet.add(dStr);
          availableRestDays = 0; // consumed
          consecutiveTrainingDays = 0; // resets counter to earn next rest day
          currentStreak++;
          if (currentStreak > longestStreak) longestStreak = currentStreak;
          lastActiveDate = dStr;
        } else {
          // Streak broke in the past
          currentStreak = 0;
          consecutiveTrainingDays = 0;
          availableRestDays = 0;
        }
      } else if (dStr === todayStr) {
        // Day is today and user hasn't trained yet
        if (availableRestDays > 0) {
          // Today can be protected by rest day
          restDaysSet.add(dStr);
          // Note: rest day is protecting today, streak continues!
          currentStreak++;
          if (currentStreak > longestStreak) longestStreak = currentStreak;
          lastActiveDate = dStr;
        } else {
          // No rest day available.
          // If yesterday was active (workout or rest day), today is still ongoing: keep yesterday's streak
          const yesterdayStr = Dates.formatDate(Dates.addDays(effectiveDate, -1));
          if (lastActiveDate !== yesterdayStr) {
            currentStreak = 0;
          }
        }
      }
    }

    curr = Dates.addDays(curr, 1);
  }

  const isRestDayToday = restDaysSet.has(todayStr);

  return {
    current: currentStreak,
    longest: longestStreak,
    lastDate: lastActiveDate,
    restDays: Array.from(restDaysSet),
    availableRestDays: isRestDayToday ? 1 : availableRestDays,
    consecutiveTrainingDays,
    isRestDayToday
  };
}

// ==========================================
// TESTS
// ==========================================
console.log('Running test suite...');

// Test 1: 4 training days, then 1 rest day on Day 5 (today)
{
  const workouts = [
    { date: '2026-10-28', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-29', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-30', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-31', morning: { sets: [{reps:10},{reps:10},{reps:10}] } }
  ];
  const res = calculateStreak(workouts, new Date('2026-11-01T12:00:00'));
  console.log('Test 1 result:', res);
  assert.strictEqual(res.current, 5, 'Streak should be 5 on rest day today');
  assert.strictEqual(res.isRestDayToday, true, 'Today is rest day');
  assert.deepStrictEqual(res.restDays, ['2026-11-01'], '2026-11-01 should be rest day');
}

// Test 2: 5 training days in a row (Day 5 is trained, does NOT trigger rest day)
{
  const workouts = [
    { date: '2026-10-28', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-29', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-30', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-31', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-11-01', morning: { sets: [{reps:10},{reps:10},{reps:10}] } }
  ];
  const res = calculateStreak(workouts, new Date('2026-11-01T12:00:00'));
  console.log('Test 2 result:', res);
  assert.strictEqual(res.current, 5, 'Streak is 5');
  assert.strictEqual(res.isRestDayToday, false, 'Today is training day, not rest day');
  assert.strictEqual(res.availableRestDays, 1, 'Rest day still available in the tank!');
  assert.deepStrictEqual(res.restDays, [], 'No rest days used');
}

// Test 3: 4 training days, Day 5 past rest day, Day 6 (today) trained
{
  const workouts = [
    { date: '2026-10-27', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-28', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-29', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-30', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    // 2026-10-31 is rest day (no workout)
    { date: '2026-11-01', morning: { sets: [{reps:10},{reps:10},{reps:10}] } } // today trained
  ];
  const res = calculateStreak(workouts, new Date('2026-11-01T12:00:00'));
  console.log('Test 3 result:', res);
  assert.strictEqual(res.current, 6, 'Streak is 6 (4 + 1 rest + 1 train)');
  assert.deepStrictEqual(res.restDays, ['2026-10-31'], '2026-10-31 was rest day');
  assert.strictEqual(res.consecutiveTrainingDays, 1, '1 training day since rest day');
  assert.strictEqual(res.availableRestDays, 0, 'Rest day was consumed on 10-31');
}

// Test 4: 8 training days in a row, then 2 missed days (No stacking! Only 1 rest day)
{
  const workouts = [
    { date: '2026-10-20', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-21', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-22', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-23', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-24', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-25', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-26', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-27', morning: { sets: [{reps:10},{reps:10},{reps:10}] } }
    // 2026-10-28: missed (used 1 rest day)
    // 2026-10-29: missed (streak broke!)
    // 2026-10-30: missed
    // 2026-10-31: missed
    // 2026-11-01 (today): missed
  ];
  const res = calculateStreak(workouts, new Date('2026-11-01T12:00:00'));
  console.log('Test 4 result:', res);
  assert.strictEqual(res.current, 0, 'Streak should be 0 because 2 days missed with max 1 rest day');
  assert.strictEqual(res.longest, 9, 'Longest streak was 9 (8 workouts + 1 rest day)');
  assert.deepStrictEqual(res.restDays, ['2026-10-28'], 'Only 2026-10-28 was rest day');
}

// Test 5: Only 3 training days, then missed day (No rest day earned!)
{
  const workouts = [
    { date: '2026-10-28', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-29', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-30', morning: { sets: [{reps:10},{reps:10},{reps:10}] } }
    // 2026-10-31 missed
    // 2026-11-01 (today) missed
  ];
  const res = calculateStreak(workouts, new Date('2026-11-01T12:00:00'));
  console.log('Test 5 result:', res);
  assert.strictEqual(res.current, 0, 'Streak broke on 10-31');
  assert.deepStrictEqual(res.restDays, [], 'No rest days earned or used');
}

// Test 6: Old streak broken, new active streak started
{
  const workouts = [
    // Old streak
    { date: '2026-09-01', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-09-02', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-09-03', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-09-04', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    // 2026-09-05 rest day
    // 2026-09-06 missed -> broke!

    // New active streak
    { date: '2026-10-29', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-30', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-31', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-11-01', morning: { sets: [{reps:10},{reps:10},{reps:10}] } }
  ];
  const res = calculateStreak(workouts, new Date('2026-11-01T12:00:00'));
  console.log('Test 6 result:', res);
  assert.strictEqual(res.current, 4, 'Current streak is 4');
  assert.strictEqual(res.longest, 5, 'Longest streak was 5 (from Sep)');
  assert.strictEqual(res.availableRestDays, 1, 'Rest day earned on today');
  assert(res.restDays.includes('2026-09-05'), 'Historical rest day is preserved for heatmap');
}

// Test 7: Day 5 (today) before workout vs after workout
{
  const base = [
    { date: '2026-10-28', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-29', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-30', morning: { sets: [{reps:10},{reps:10},{reps:10}] } },
    { date: '2026-10-31', morning: { sets: [{reps:10},{reps:10},{reps:10}] } }
  ];
  // Before workout on 11-01:
  const before = calculateStreak(base, new Date('2026-11-01T09:00:00'));
  assert.strictEqual(before.current, 5);
  assert.strictEqual(before.isRestDayToday, true);
  assert.strictEqual(before.restDays.includes('2026-11-01'), true);

  // User decides to work out anyway on 11-01:
  const afterWorkouts = [
    ...base,
    { date: '2026-11-01', morning: { sets: [{reps:15},{reps:15},{reps:15}] } }
  ];
  const after = calculateStreak(afterWorkouts, new Date('2026-11-01T18:00:00'));
  assert.strictEqual(after.current, 5);
  assert.strictEqual(after.isRestDayToday, false);
  assert.strictEqual(after.restDays.includes('2026-11-01'), false);
  assert.strictEqual(after.availableRestDays, 1, 'Rest day was NOT consumed and is saved for later!');
  assert.strictEqual(after.consecutiveTrainingDays, 5);
}

console.log('All tests passed!');
