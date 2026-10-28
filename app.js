(() => {
  'use strict';

  // ============================================================
  // 1. DATE UTILITIES
  // ============================================================
  const Dates = {
    formatDate(date) {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    formatDisplayDate(date) {
      const options = { weekday: 'long', month: 'short', day: 'numeric' };
      return new Date(date).toLocaleDateString('en-US', options);
    },
    formatMMDD(date) {
      const d = new Date(date);
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    isToday(date) {
      return Dates.formatDate(date) === Dates.formatDate(Dates.getEffectiveDate());
    },
    isFutureDate(date) {
      const today = Dates.getEffectiveDate();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate > today;
    },
    getEffectiveDate() {
      const now = new Date();
      // 00:00 to 03:00 belongs to yesterday
      if (now.getHours() >= 0 && now.getHours() < 3) {
        now.setDate(now.getDate() - 1);
      }
      return now;
    },
    daysBetween(date1, date2) {
      const oneDay = 24 * 60 * 60 * 1000;
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      return Math.round(Math.abs((d1 - d2) / oneDay));
    },
    addDays(date, n) {
      const d = new Date(date);
      d.setDate(d.getDate() + n);
      return d;
    }
  };

  // ============================================================
  // 2. DATABASE LAYER
  // ============================================================
  const DB = (() => {
    let db = null;
    const DB_NAME = 'pushup-discipline';
    const DB_VERSION = 1;
    const STORE_WORKOUTS = 'workouts';
    const STORE_META = 'meta';
    let useLocalStorage = false;

    return {
      init() {
        return new Promise((resolve) => {
          if (!window.indexedDB) {
            console.warn('IndexedDB not supported, falling back to localStorage');
            useLocalStorage = true;
            resolve();
            return;
          }
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);
          request.onerror = () => { useLocalStorage = true; resolve(); };
          request.onsuccess = (e) => {
            db = e.target.result;
            if (navigator.storage && navigator.storage.persist) {
              navigator.storage.persist();
            }
            resolve();
          };
          request.onupgradeneeded = (e) => {
            const dbInst = e.target.result;
            if (!dbInst.objectStoreNames.contains(STORE_WORKOUTS)) {
              dbInst.createObjectStore(STORE_WORKOUTS, { keyPath: 'date' });
            }
            if (!dbInst.objectStoreNames.contains(STORE_META)) {
              dbInst.createObjectStore(STORE_META, { keyPath: 'key' });
            }
          };
        });
      },

      getWorkout(dateStr) {
        return new Promise((resolve) => {
          if (useLocalStorage) {
            const data = localStorage.getItem(`workout_${dateStr}`);
            resolve(data ? JSON.parse(data) : null);
            return;
          }
          if (!db) return resolve(null);
          const tx = db.transaction([STORE_WORKOUTS], 'readonly');
          const req = tx.objectStore(STORE_WORKOUTS).get(dateStr);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      },

      saveWorkout(workout) {
        return new Promise((resolve, reject) => {
          if (useLocalStorage) {
            localStorage.setItem(`workout_${workout.date}`, JSON.stringify(workout));
            resolve();
            return;
          }
          if (!db) return reject(new Error('DB not initialized'));
          const tx = db.transaction([STORE_WORKOUTS], 'readwrite');
          const req = tx.objectStore(STORE_WORKOUTS).put(workout);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      },

      getAllWorkouts() {
        return new Promise((resolve) => {
          if (useLocalStorage) {
            const workouts = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key.startsWith('workout_')) {
                workouts.push(JSON.parse(localStorage.getItem(key)));
              }
            }
            workouts.sort((a, b) => a.date.localeCompare(b.date));
            resolve(workouts);
            return;
          }
          if (!db) return resolve([]);
          const tx = db.transaction([STORE_WORKOUTS], 'readonly');
          const req = tx.objectStore(STORE_WORKOUTS).getAll();
          req.onsuccess = () => {
            const workouts = req.result || [];
            workouts.sort((a, b) => a.date.localeCompare(b.date));
            resolve(workouts);
          };
          req.onerror = () => resolve([]);
        });
      },

      getMeta(key) {
        return new Promise((resolve) => {
          if (useLocalStorage) {
            const data = localStorage.getItem(`meta_${key}`);
            resolve(data ? JSON.parse(data).value : null);
            return;
          }
          if (!db) return resolve(null);
          const tx = db.transaction([STORE_META], 'readonly');
          const req = tx.objectStore(STORE_META).get(key);
          req.onsuccess = () => resolve(req.result ? req.result.value : null);
          req.onerror = () => resolve(null);
        });
      },

      setMeta(key, value) {
        return new Promise((resolve, reject) => {
          if (useLocalStorage) {
            localStorage.setItem(`meta_${key}`, JSON.stringify({ key, value }));
            resolve();
            return;
          }
          if (!db) return reject(new Error('DB not initialized'));
          const tx = db.transaction([STORE_META], 'readwrite');
          const req = tx.objectStore(STORE_META).put({ key, value });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      },

      clearAll() {
        return new Promise((resolve, reject) => {
          if (useLocalStorage) {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k.startsWith('workout_') || k.startsWith('meta_')) keys.push(k);
            }
            keys.forEach(k => localStorage.removeItem(k));
            resolve();
            return;
          }
          if (!db) return reject(new Error('DB not initialized'));
          const tx = db.transaction([STORE_WORKOUTS, STORE_META], 'readwrite');
          tx.objectStore(STORE_WORKOUTS).clear();
          tx.objectStore(STORE_META).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },

      exportAll() {
        return Promise.all([this.getAllWorkouts(), this.getMeta('streak')]).then(([workouts, streak]) => ({
          version: DB_VERSION,
          exportDate: new Date().toISOString(),
          workouts,
          meta: { streak }
        }));
      },

      async importAll(data) {
        if (!data || !data.workouts || !Array.isArray(data.workouts)) {
          throw new Error('Invalid export file format');
        }
        await this.clearAll();
        for (const w of data.workouts) await this.saveWorkout(w);
        if (data.meta && data.meta.streak) {
          await this.setMeta('streak', data.meta.streak);
        }
      }
    };
  })();

  // ============================================================
  // 3. WORKOUT DATA HELPERS
  // ============================================================
  function createEmptyWorkout(dateStr) {
    return {
      date: dateStr,
      morning: {
        sets: [
          { reps: 0, timestamp: null },
          { reps: 0, timestamp: null },
          { reps: 0, timestamp: null }
        ],
        completed: false
      },
      evening: {
        sets: [
          { reps: 0, timestamp: null },
          { reps: 0, timestamp: null },
          { reps: 0, timestamp: null }
        ],
        completed: false
      },
      emom: [],
      notes: ''
    };
  }

  function workoutMorningTotal(w) {
    return (w.morning?.sets || []).reduce((s, x) => s + (x.reps || 0), 0);
  }
  function workoutEveningTotal(w) {
    return (w.evening?.sets || []).reduce((s, x) => s + (x.reps || 0), 0);
  }
  function workoutEmomTotal(w) {
    return (w.emom || []).reduce((s, e) => s + (e.totalReps || 0), 0);
  }
  function workoutDayTotal(w) {
    return workoutMorningTotal(w) + workoutEveningTotal(w) + workoutEmomTotal(w);
  }
  function workoutBestSet(w) {
    let best = 0;
    (w.morning?.sets || []).forEach(s => { if (s.reps > best) best = s.reps; });
    (w.evening?.sets || []).forEach(s => { if (s.reps > best) best = s.reps; });
    return best;
  }

  // ============================================================
  // 4. STREAK ENGINE
  // ============================================================
  const Streak = {
    async calculate(allWorkouts) {
      if (!allWorkouts || allWorkouts.length === 0) {
        return { current: 0, longest: 0, lastDate: null };
      }
      const validWorkouts = allWorkouts.filter(w => {
        const mHasReps = w.morning?.sets?.some(s => s.reps > 0);
        const eHasReps = w.evening?.sets?.some(s => s.reps > 0);
        return mHasReps && eHasReps;
      }).sort((a, b) => a.date.localeCompare(b.date));

      if (validWorkouts.length === 0) return { current: 0, longest: 0, lastDate: null };

      let currentStreak = 1;
      let longestStreak = 1;
      for (let i = 1; i < validWorkouts.length; i++) {
        const diff = Dates.daysBetween(new Date(validWorkouts[i].date), new Date(validWorkouts[i - 1].date));
        if (diff === 1) {
          currentStreak++;
          if (currentStreak > longestStreak) longestStreak = currentStreak;
        } else if (diff > 1) {
          currentStreak = 1;
        }
      }

      const lastValidDate = validWorkouts[validWorkouts.length - 1].date;
      const today = Dates.formatDate(Dates.getEffectiveDate());
      const yesterday = Dates.formatDate(Dates.addDays(Dates.getEffectiveDate(), -1));
      if (lastValidDate !== today && lastValidDate !== yesterday) currentStreak = 0;

      return { current: currentStreak, longest: longestStreak, lastDate: lastValidDate };
    },

    async update() {
      const allWorkouts = await DB.getAllWorkouts();
      const newStreak = await this.calculate(allWorkouts);
      const oldMeta = await DB.getMeta('streak') || { longest: 0 };
      if (newStreak.longest < oldMeta.longest) newStreak.longest = oldMeta.longest;
      await DB.setMeta('streak', newStreak);
      AppState.streak = newStreak;
      updateStreakUI();
    }
  };

  // ============================================================
  // 5. TOAST NOTIFICATIONS
  // ============================================================
  const Toast = {
    show(message, type = 'info', duration = 3000) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('active'));
      setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  };

  // ============================================================
  // 6. APP STATE
  // ============================================================
  const AppState = {
    todayData: null,
    todayStr: '',
    streak: { current: 0, longest: 0, lastDate: null },
    currentTab: 'emom',
    currentChartRange: '7',
    selectedDayDate: '',   // YYYY-MM-DD string
    isDayEditMode: false,
    isDirty: false,
    // Heatmap data cache: array of 84 day objects {date, label, mmdd, morningTotal, eveningTotal, emomTotal, total, dayObj}
    heatmapDays: [],
    editDayMorning: 0,
    editDayEvening: 0,
    editDayEmom: 0
  };

  // ============================================================
  // 7. STATUS BAR CLOCK
  // ============================================================
  function updateStatusBarClock() {
    const el = document.getElementById('status-bar-time');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ============================================================
  // 8. TAB NAVIGATION
  // ============================================================
  const appTopBar = document.getElementById('app-top-bar');
  const tabs = {
    today: document.getElementById('tab-today'),
    emom:  document.getElementById('tab-emom'),
    stats: document.getElementById('tab-stats')
  };
  const navBtns = {
    today: document.getElementById('nav-today'),
    emom:  document.getElementById('nav-emom'),
    stats: document.getElementById('nav-stats')
  };

  function switchTab(target) {
    AppState.currentTab = target;
    if (target === 'emom') {
      appTopBar.classList.add('hidden');
      appTopBar.classList.remove('flex');
    } else {
      appTopBar.classList.remove('hidden');
      appTopBar.classList.add('flex');
    }
    Object.keys(tabs).forEach(key => {
      if (key === target) {
        tabs[key].classList.remove('hidden');
        tabs[key].classList.add('flex');
        navBtns[key].className = 'flex flex-col items-center gap-1 text-laser-orange tap-btn';
      } else {
        tabs[key].classList.add('hidden');
        tabs[key].classList.remove('flex');
        navBtns[key].className = 'flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 tap-btn';
      }
    });
    if (target === 'stats') {
      renderStatsAndHeatmap();
    }
  }

  navBtns.today.addEventListener('click', () => switchTab('today'));
  navBtns.emom.addEventListener('click', () => switchTab('emom'));
  navBtns.stats.addEventListener('click', () => switchTab('stats'));

  // ============================================================
  // 9. TODAY TAB — RENDER & AUTO-SAVE
  // ============================================================
  let autoSaveTimer = null;

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveTodayData(), 300);
  }

  function renderTodaySessions() {
    const data = AppState.todayData;
    if (!data) return;

    // Update header date
    const h1 = appTopBar.querySelector('h1');
    if (h1) h1.textContent = Dates.formatDisplayDate(Dates.getEffectiveDate());

    ['morning', 'evening'].forEach(session => {
      const sets = data[session].sets || [];
      const container = document.getElementById(`${session}-sets-list`);
      if (!container) return;

      // Remember focused input
      const focused = document.activeElement;
      let focusedIdx = -1;
      if (focused && focused.tagName === 'INPUT' && focused.id.startsWith(`input-${session}-`)) {
        focusedIdx = parseInt(focused.id.replace(`input-${session}-`, ''), 10);
      }

      container.innerHTML = sets.map((set, idx) => {
        const reps = set.reps || 0;
        const showDelete = idx >= 3;
        return `
          <div class="flex items-center justify-between bg-app-input px-3 py-2.5 rounded-[16px] border border-white/[0.06]">
            <span class="text-xs font-semibold text-slate-300">Set ${idx + 1}</span>
            <div class="flex items-center gap-2">
              <button data-session="${session}" data-idx="${idx}" data-delta="-5" class="set-stepper w-7 h-7 rounded-lg bg-white/[0.06] text-[11px] font-bold text-slate-300 tap-btn">-5</button>
              <button data-session="${session}" data-idx="${idx}" data-delta="-1" class="set-stepper w-7 h-7 rounded-lg bg-white/[0.06] text-[11px] font-bold text-slate-300 tap-btn">-1</button>
              <input type="number" id="input-${session}-${idx}" class="w-12 h-7 text-center bg-transparent text-sm font-extrabold text-white tabular-nums border-0 outline-none" inputmode="numeric" pattern="[0-9]*" value="${reps > 0 ? reps : ''}" min="0" max="999" placeholder="0">
              <button data-session="${session}" data-idx="${idx}" data-delta="1" class="set-stepper w-7 h-7 rounded-lg bg-white/[0.06] text-[11px] font-bold text-slate-300 tap-btn">+1</button>
              <button data-session="${session}" data-idx="${idx}" data-delta="5" class="set-stepper w-7 h-7 rounded-lg bg-white/[0.06] text-[11px] font-bold text-slate-300 tap-btn">+5</button>
              ${showDelete ? `<button data-session="${session}" data-idx="${idx}" class="set-delete w-6 h-6 rounded-md bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-bold tap-btn">✕</button>` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Restore focus
      if (focusedIdx >= 0) {
        const inp = document.getElementById(`input-${session}-${focusedIdx}`);
        if (inp) inp.focus();
      }

      // Totals & badges
      const total = sets.reduce((s, x) => s + (x.reps || 0), 0);
      const hasReps = sets.some(s => s.reps > 0);

      const totalEl = document.getElementById(`${session}-total-val`);
      if (totalEl) totalEl.textContent = total;

      const badge = document.getElementById(`${session}-status-badge`);
      if (badge) {
        if (hasReps) {
          badge.textContent = 'Complete';
          badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-500/15 border border-emerald-500/40 text-emerald-400';
        } else {
          badge.textContent = 'Incomplete';
          badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-white/5 border border-white/10 text-slate-400';
        }
      }
    });
  }

  function updateTodayTotalsOnly() {
    ['morning', 'evening'].forEach(session => {
      const sets = (AppState.todayData?.[session]?.sets || []);
      const total = sets.reduce((s, x) => s + (x.reps || 0), 0);
      const hasReps = sets.some(s => s.reps > 0);
      const totalEl = document.getElementById(`${session}-total-val`);
      if (totalEl) totalEl.textContent = total;
      const badge = document.getElementById(`${session}-status-badge`);
      if (badge) {
        if (hasReps) {
          badge.textContent = 'Complete';
          badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-500/15 border border-emerald-500/40 text-emerald-400';
        } else {
          badge.textContent = 'Incomplete';
          badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-white/5 border border-white/10 text-slate-400';
        }
      }
    });
  }

  function readTodayFromInputs() {
    const data = AppState.todayData;
    if (!data) return;
    ['morning', 'evening'].forEach(session => {
      const sets = data[session].sets;
      sets.forEach((set, idx) => {
        const inp = document.getElementById(`input-${session}-${idx}`);
        if (inp) {
          let val = parseInt(inp.value, 10);
          if (isNaN(val) || val < 0) val = 0;
          if (val > 999) val = 999;
          set.reps = val;
          set.timestamp = val > 0 ? (set.timestamp || new Date().toISOString()) : null;
        }
      });
      data[session].completed = sets.some(s => s.reps > 0);
    });
    AppState.isDirty = true;
  }

  async function saveTodayData() {
    readTodayFromInputs();
    if (!AppState.todayData) return;
    await DB.saveWorkout(AppState.todayData);
    await Streak.update();
    AppState.isDirty = false;
  }

  // Today tab event delegation
  document.getElementById('tab-today').addEventListener('click', (e) => {
    const stepper = e.target.closest('.set-stepper');
    if (stepper) {
      const session = stepper.dataset.session;
      const idx = parseInt(stepper.dataset.idx, 10);
      const delta = parseInt(stepper.dataset.delta, 10);
      const data = AppState.todayData;
      if (!data) return;
      const set = data[session].sets[idx];
      if (!set) return;
      const inp = document.getElementById(`input-${session}-${idx}`);
      const cur = inp ? (parseInt(inp.value, 10) || 0) : (set.reps || 0);
      const newVal = Math.max(0, Math.min(999, cur + delta));
      set.reps = newVal;
      set.timestamp = newVal > 0 ? (set.timestamp || new Date().toISOString()) : null;
      data[session].completed = data[session].sets.some(s => s.reps > 0);
      if (inp) inp.value = newVal > 0 ? newVal : '';
      updateTodayTotalsOnly();
      updateBadgeOnly(session);
      AppState.isDirty = true;
      scheduleAutoSave();
      return;
    }

    const delBtn = e.target.closest('.set-delete');
    if (delBtn) {
      const session = delBtn.dataset.session;
      const idx = parseInt(delBtn.dataset.idx, 10);
      const data = AppState.todayData;
      if (!data || data[session].sets.length <= 1) return;
      data[session].sets.splice(idx, 1);
      data[session].completed = data[session].sets.some(s => s.reps > 0);
      AppState.isDirty = true;
      renderTodaySessions();
      scheduleAutoSave();
      return;
    }
  });

  document.getElementById('tab-today').addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.id.startsWith('input-')) {
      const [, session, idxStr] = e.target.id.split('-');
      const idx = parseInt(idxStr, 10);
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 999) { val = 999; e.target.value = 999; }
      const data = AppState.todayData;
      if (data && data[session] && data[session].sets[idx] !== undefined) {
        data[session].sets[idx].reps = val;
        data[session].sets[idx].timestamp = val > 0 ? (data[session].sets[idx].timestamp || new Date().toISOString()) : null;
        data[session].completed = data[session].sets.some(s => s.reps > 0);
      }
      updateTodayTotalsOnly();
      updateBadgeOnly(session);
      AppState.isDirty = true;
      scheduleAutoSave();
    }
  });

  function updateBadgeOnly(session) {
    const data = AppState.todayData;
    if (!data) return;
    const hasReps = data[session].sets.some(s => s.reps > 0);
    const badge = document.getElementById(`${session}-status-badge`);
    if (badge) {
      if (hasReps) {
        badge.textContent = 'Complete';
        badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-500/15 border border-emerald-500/40 text-emerald-400';
      } else {
        badge.textContent = 'Incomplete';
        badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-white/5 border border-white/10 text-slate-400';
      }
    }
  }

  document.getElementById('btn-add-morning-set').addEventListener('click', () => {
    const data = AppState.todayData;
    if (!data) return;
    data.morning.sets.push({ reps: 0, timestamp: null });
    renderTodaySessions();
    const newIdx = data.morning.sets.length - 1;
    const inp = document.getElementById(`input-morning-${newIdx}`);
    if (inp) inp.focus();
    AppState.isDirty = true;
    scheduleAutoSave();
  });

  document.getElementById('btn-add-evening-set').addEventListener('click', () => {
    const data = AppState.todayData;
    if (!data) return;
    data.evening.sets.push({ reps: 0, timestamp: null });
    renderTodaySessions();
    const newIdx = data.evening.sets.length - 1;
    const inp = document.getElementById(`input-evening-${newIdx}`);
    if (inp) inp.focus();
    AppState.isDirty = true;
    scheduleAutoSave();
  });

  // ============================================================
  // 10. STREAK UI UPDATE
  // ============================================================
  function updateStreakUI() {
    const count = AppState.streak.current;
    const el = document.getElementById('header-streak-count');
    if (el) el.textContent = count;
  }

  // ============================================================
  // 11. EMOM — MORPH SVG ENGINE + WORKOUT LOGIC
  // ============================================================
  const TOTAL_RING_LEN = 2 * Math.PI * 176; // 1105.84
  const ICON_ARC_LEN   = (240 / 360) * TOTAL_RING_LEN; // 737.23
  const PLANK_TOTAL_LEN = 359.68;

  const emomRing          = document.getElementById('emom-ring');
  const plankPath         = document.getElementById('plank-path');
  const headNode          = document.getElementById('head-node');
  const floorLine         = document.getElementById('floor-line');
  const centerSecsGroup   = document.getElementById('center-seconds-group');
  const centerSecsText    = document.getElementById('center-seconds-text');
  const gradStop1         = document.getElementById('grad-stop-1');
  const gradStop2         = document.getElementById('grad-stop-2');
  const gradStop3         = document.getElementById('grad-stop-3');
  const ambientGlow       = document.getElementById('ambient-glow');
  const setupControls     = document.getElementById('setup-controls');
  const workoutControls   = document.getElementById('workout-controls');
  const repsDisplay       = document.getElementById('reps-display');
  const minsDisplay       = document.getElementById('mins-display');
  const btnEndless        = document.getElementById('btn-endless');
  const restDisplay       = document.getElementById('rest-display');
  const liveRoundText     = document.getElementById('live-round-text');
  const livePhaseLabel    = document.getElementById('live-phase-label');
  const liveTargetText    = document.getElementById('live-target-text');
  const btnSetDone        = document.getElementById('btn-set-done');
  const setDoneText       = document.getElementById('set-done-text');

  let repsPerMin = 15;
  let durationMins = 10;
  let isEndless = false;
  let restEveryN = 0;
  let emomState = 'SETUP'; // 'SETUP' | 'MORPHING' | 'RUNNING' | 'RECHARGING'
  let morphProgress = 0;
  let currentRound = 1;
  let completedRounds = 0;
  let setDoneForCurrentMinute = false;
  let timeRemaining = 60.0;
  let animFrame = null;
  let lastTimestamp = 0;
  let wakeLock = null;

  // Wake lock helpers
  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (_) {}
    }
  }
  async function releaseWakeLock() {
    if (wakeLock) { try { await wakeLock.release(); } catch (_) {} wakeLock = null; }
  }

  // Easings
  function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
  function easeOutCubic(t)   { return 1 - Math.pow(1-t, 3); }

  function isRestSetMinute(round) { return restEveryN >= 2 && round % restEveryN === 0; }

  function setPlankInteriorLocked(locked) {
    const d = locked ? 'none' : 'block';
    const v = locked ? 'hidden' : 'visible';
    plankPath.style.display = d; plankPath.style.visibility = v;
    headNode.style.display = d; headNode.style.visibility = v;
    floorLine.style.display = d; floorLine.style.visibility = v;
  }

  function setColorTheme(mode) {
    if (mode === 'REST') {
      gradStop1.setAttribute('stop-color', '#00F0FF');
      gradStop2.setAttribute('stop-color', '#00A8FF');
      gradStop3.setAttribute('stop-color', '#0066FF');
      ambientGlow.className = 'absolute top-6 left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-full bg-cyber-cyan/15 blur-[75px] pointer-events-none transition-colors duration-500';
    } else {
      gradStop1.setAttribute('stop-color', '#FF8800');
      gradStop2.setAttribute('stop-color', '#FF4D00');
      gradStop3.setAttribute('stop-color', '#FF2A00');
      ambientGlow.className = 'absolute top-6 left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-full bg-laser-orange/10 blur-[75px] pointer-events-none transition-colors duration-500';
    }
  }

  function syncSetupUI() {
    repsDisplay.textContent = repsPerMin;
    if (isEndless) {
      minsDisplay.textContent = '∞';
      btnEndless.className = 'px-2.5 py-1 rounded-lg text-xs font-bold border border-laser-orange/50 bg-laser-orange/20 text-laser-amber tap-btn';
    } else {
      minsDisplay.textContent = `${durationMins} Min`;
      btnEndless.className = 'px-2.5 py-1 rounded-lg text-xs font-bold border border-white/10 bg-white/5 text-slate-400 tap-btn';
    }
    if (restEveryN === 0) {
      restDisplay.textContent = 'Aus';
      restDisplay.className = 'w-24 text-center font-bold text-sm text-slate-400 tabular-nums';
    } else {
      restDisplay.textContent = `Jede ${restEveryN}. Min`;
      restDisplay.className = 'w-24 text-center font-bold text-sm text-cyber-cyan tabular-nums';
    }
  }

  function syncWorkoutUI() {
    liveRoundText.textContent = isEndless ? `Runde ${currentRound}` : `Runde ${currentRound} / ${durationMins}`;
    if (isRestSetMinute(currentRound)) {
      setColorTheme('REST');
      livePhaseLabel.textContent = 'Rest-Set';
      livePhaseLabel.className = 'text-[11px] font-semibold uppercase tracking-wider text-cyber-cyan block';
      liveTargetText.textContent = 'Pause';
      btnSetDone.disabled = true;
      btnSetDone.className = 'w-full h-[54px] rounded-2xl bg-white/[0.04] border border-white/[0.07] text-slate-500 font-bold text-sm tracking-wide flex items-center justify-center gap-2 cursor-not-allowed opacity-50';
      setDoneText.textContent = 'Rest-Set Pause aktiv';
    } else if (setDoneForCurrentMinute) {
      setColorTheme('REST');
      livePhaseLabel.textContent = 'Pause bis nächste Min';
      livePhaseLabel.className = 'text-[11px] font-semibold uppercase tracking-wider text-cyber-cyan block';
      liveTargetText.textContent = `${repsPerMin} ✓`;
      btnSetDone.disabled = true;
      btnSetDone.className = 'w-full h-[54px] rounded-2xl bg-white/[0.04] border border-white/[0.07] text-slate-500 font-bold text-sm tracking-wide flex items-center justify-center gap-2 cursor-not-allowed opacity-50';
      setDoneText.textContent = 'Satz fertig ✓';
    } else {
      setColorTheme('WORK');
      livePhaseLabel.textContent = 'Ziel';
      livePhaseLabel.className = 'text-[11px] font-semibold uppercase tracking-wider text-laser-amber block';
      liveTargetText.textContent = `${repsPerMin} Push-Ups`;
      btnSetDone.disabled = false;
      btnSetDone.className = 'w-full h-[54px] rounded-2xl bg-cyber-cyan/15 border border-cyber-cyan/40 text-cyber-cyan font-bold text-sm tracking-wide flex items-center justify-center gap-2 tap-btn';
      setDoneText.textContent = 'Satz fertig';
    }
  }

  function renderMorph(p) {
    morphProgress = Math.max(0, Math.min(1, p));
    if (morphProgress >= 0.999) {
      setPlankInteriorLocked(true);
    } else {
      setPlankInteriorLocked(false);
      const floorT = Math.min(1, morphProgress / 0.4);
      floorLine.style.opacity = (1 - easeInOutCubic(floorT)).toFixed(3);
      const plankT = Math.min(1, morphProgress / 0.55);
      const remLen = Math.max(0, PLANK_TOTAL_LEN * (1 - easeInOutCubic(plankT)));
      plankPath.setAttribute('stroke-dasharray', `${remLen.toFixed(2)} ${PLANK_TOTAL_LEN}`);
      plankPath.setAttribute('stroke-linecap', remLen < 4 ? 'butt' : 'round');
      plankPath.style.opacity = remLen < 2 ? '0' : '1';
      const headT = easeInOutCubic(Math.min(1, morphProgress / 0.45));
      headNode.setAttribute('cx', (352 + (304-352)*headT).toFixed(2));
      headNode.setAttribute('cy', (190 + (220-190)*headT).toFixed(2));
      headNode.setAttribute('r', Math.max(0, 22*(1-headT)).toFixed(2));
      headNode.style.opacity = (1-headT).toFixed(3);
    }
    const ringRaw = Math.max(0, Math.min(1, (morphProgress - 0.18) / 0.65));
    const ringEased = easeInOutCubic(ringRaw);
    const currentArc = ICON_ARC_LEN + ringEased * (TOTAL_RING_LEN - ICON_ARC_LEN);
    emomRing.setAttribute('stroke-dasharray', `${currentArc.toFixed(2)} ${TOTAL_RING_LEN.toFixed(2)}`);
    const secRaw = Math.max(0, Math.min(1, (morphProgress - 0.45) / 0.55));
    const secEased = easeOutCubic(secRaw);
    centerSecsGroup.setAttribute('opacity', secEased.toFixed(3));
    centerSecsGroup.setAttribute('transform', `scale(${(0.88 + 0.12*secEased).toFixed(3)})`);
    centerSecsText.textContent = '60';
  }

  function renderCountdown() {
    setPlankInteriorLocked(true);
    const fraction = Math.max(0, Math.min(1, timeRemaining / 60));
    const arcLen = fraction * TOTAL_RING_LEN;
    emomRing.setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} ${TOTAL_RING_LEN.toFixed(2)}`);
    centerSecsText.textContent = Math.max(1, Math.ceil(timeRemaining)).toString();
  }

  function cancelLoop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  }

  function startWorkout() {
    cancelLoop();
    emomState = 'MORPHING';
    currentRound = 1;
    completedRounds = 0;
    setDoneForCurrentMinute = false;
    timeRemaining = 60.0;
    acquireWakeLock();
    setupControls.classList.add('hidden');
    workoutControls.classList.remove('hidden');
    syncWorkoutUI();
    const startTime = performance.now();
    const dur = 750;
    function morphStep(now) {
      const t = Math.min(1, (now - startTime) / dur);
      renderMorph(t);
      if (t < 1) { animFrame = requestAnimationFrame(morphStep); }
      else { setPlankInteriorLocked(true); startCountdownLoop(); }
    }
    animFrame = requestAnimationFrame(morphStep);
  }

  function startCountdownLoop() {
    cancelLoop();
    setPlankInteriorLocked(true);
    emomState = 'RUNNING';
    lastTimestamp = performance.now();
    function tick(now) {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      timeRemaining -= dt;
      if (timeRemaining <= 0) { handleMinuteFinished(); }
      else { renderCountdown(); animFrame = requestAnimationFrame(tick); }
    }
    animFrame = requestAnimationFrame(tick);
  }

  function handleMinuteFinished() {
    cancelLoop();
    setPlankInteriorLocked(true);
    if (!isEndless && currentRound >= durationMins) {
      stopAndReverseMorph(true); // auto-finish
      return;
    }
    currentRound++;
    setDoneForCurrentMinute = false;
    timeRemaining = 60.0;
    centerSecsText.textContent = '60';
    syncWorkoutUI();
    emomState = 'RECHARGING';
    const startTime = performance.now();
    const dur = 320;
    function rechargeStep(now) {
      setPlankInteriorLocked(true);
      const t = Math.min(1, (now - startTime) / dur);
      const arcLen = easeOutCubic(t) * TOTAL_RING_LEN;
      emomRing.setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} ${TOTAL_RING_LEN.toFixed(2)}`);
      if (t < 1) { animFrame = requestAnimationFrame(rechargeStep); }
      else { startCountdownLoop(); }
    }
    animFrame = requestAnimationFrame(rechargeStep);
  }

  async function stopAndReverseMorph(autoFinish = false) {
    cancelLoop();
    releaseWakeLock();
    emomState = 'MORPHING';
    setColorTheme('WORK');
    workoutControls.classList.add('hidden');
    setupControls.classList.remove('hidden');
    // Save EMOM workout to DB
    if (completedRounds > 0) {
      await saveEmomToDb();
    } else if (!autoFinish) {
      Toast.show('EMOM beendet — keine Runden gezählt.', 'info');
    }
    const startTime = performance.now();
    const dur = 600;
    function reverseStep(now) {
      const t = Math.min(1, (now - startTime) / dur);
      renderMorph(1 - t);
      if (t < 1) { animFrame = requestAnimationFrame(reverseStep); }
      else { emomState = 'SETUP'; renderMorph(0); }
    }
    animFrame = requestAnimationFrame(reverseStep);
  }

  async function saveEmomToDb() {
    const totalReps = completedRounds * repsPerMin;
    const session = {
      targetRepsPerMinute: repsPerMin,
      completedRounds,
      totalReps,
      failedRoundReps: 0,
      timestamp: new Date().toISOString()
    };
    const todayStr = Dates.formatDate(Dates.getEffectiveDate());
    const wData = (await DB.getWorkout(todayStr)) || createEmptyWorkout(todayStr);
    if (!Array.isArray(wData.emom)) wData.emom = [];
    wData.emom.push(session);
    await DB.saveWorkout(wData);
    // Also update in-memory today data if today's tab is loaded
    if (AppState.todayData && AppState.todayStr === todayStr) {
      AppState.todayData = wData;
    }
    await Streak.update();
    Toast.show(`EMOM gespeichert 💪  ${completedRounds} Runden · ${totalReps} Reps`, 'success', 4000);
    // Refresh stats if already built
    if (AppState.currentTab === 'stats') renderStatsAndHeatmap();
  }

  // EMOM button listeners
  document.getElementById('reps-minus').addEventListener('click', () => { repsPerMin = Math.max(1, repsPerMin-1); syncSetupUI(); });
  document.getElementById('reps-plus').addEventListener('click', () => { repsPerMin = Math.min(100, repsPerMin+1); syncSetupUI(); });
  document.getElementById('mins-minus').addEventListener('click', () => { isEndless = false; durationMins = Math.max(1, durationMins-1); syncSetupUI(); });
  document.getElementById('mins-plus').addEventListener('click', () => { isEndless = false; durationMins = Math.min(60, durationMins+1); syncSetupUI(); });
  btnEndless.addEventListener('click', () => { isEndless = !isEndless; syncSetupUI(); });
  document.getElementById('rest-minus').addEventListener('click', () => { restEveryN = restEveryN <= 2 ? 0 : restEveryN-1; syncSetupUI(); });
  document.getElementById('rest-plus').addEventListener('click', () => { restEveryN = restEveryN === 0 ? 2 : Math.min(15, restEveryN+1); syncSetupUI(); });
  document.getElementById('btn-start').addEventListener('click', startWorkout);
  document.getElementById('svg-stage').addEventListener('click', () => { if (emomState === 'SETUP') startWorkout(); });

  btnSetDone.addEventListener('click', async () => {
    if (setDoneForCurrentMinute || isRestSetMinute(currentRound)) return;
    setDoneForCurrentMinute = true;
    completedRounds++;
    syncWorkoutUI();
    Toast.show(`Runde ${completedRounds} ✅  +${repsPerMin} Reps`, 'success', 1800);
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    if (completedRounds > 0) {
      const totalReps = completedRounds * repsPerMin;
      if (confirm(`Workout beenden?\n${completedRounds} Runden (${totalReps} Reps) werden gespeichert.\nDie aktuelle Runde ${currentRound} zählt 0.`)) {
        stopAndReverseMorph(false);
      }
    } else {
      stopAndReverseMorph(false);
    }
  });

  // Re-acquire wake lock when page becomes visible
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && emomState === 'RUNNING' && !wakeLock) {
      await acquireWakeLock();
    }
  });

  // ============================================================
  // 12. STATS TAB — HEATMAP, KPIs, CHARTS, PERSONAL RECORDS
  // ============================================================

  function getHeatLevelClass(total) {
    if (total <= 0) return 'heat-0';
    if (total < 30)  return 'heat-1';
    if (total < 60)  return 'heat-2';
    if (total < 90)  return 'heat-3';
    return 'heat-4';
  }

  async function buildHeatmapData() {
    const allWorkouts = await DB.getAllWorkouts();
    const wMap = {};
    allWorkouts.forEach(w => { wMap[w.date] = w; });

    const today = Dates.getEffectiveDate();
    const TOTAL_DAYS = 84;
    const days = [];

    for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
      const d = Dates.addDays(today, -i);
      const dateStr = Dates.formatDate(d);
      const w = wMap[dateStr] || null;
      const morningTotal = w ? workoutMorningTotal(w) : 0;
      const eveningTotal = w ? workoutEveningTotal(w) : 0;
      const emomTotal    = w ? workoutEmomTotal(w) : 0;
      const total = morningTotal + eveningTotal + emomTotal;
      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const mmdd = Dates.formatMMDD(d);
      days.push({
        date: dateStr,
        label,
        mmdd,
        dayObj: d,
        morningTotal,
        eveningTotal,
        emomTotal,
        total,
        workoutData: w
      });
    }
    AppState.heatmapDays = days;
    return days;
  }

  async function renderStatsAndHeatmap() {
    const days = await buildHeatmapData();
    const allWorkouts = await DB.getAllWorkouts();
    const TODAY_INDEX = days.length - 1;

    // Default selected day to today if not set or invalid
    const todayDate = Dates.formatDate(Dates.getEffectiveDate());
    if (!AppState.selectedDayDate || !days.find(d => d.date === AppState.selectedDayDate)) {
      AppState.selectedDayDate = todayDate;
    }
    const selectedIdx = days.findIndex(d => d.date === AppState.selectedDayDate);

    // -- KPIs --
    const currentStreak = AppState.streak.current;
    const longestStreak = AppState.streak.longest;

    const rangeCount = AppState.currentChartRange === 'all'
      ? days.length
      : Math.min(days.length, parseInt(AppState.currentChartRange, 10));
    const rangeSlice = days.slice(days.length - rangeCount);
    const rangeTotal = rangeSlice.reduce((acc, d) => acc + d.total, 0);
    const rangeAvg = rangeCount > 0 ? (rangeTotal / rangeCount).toFixed(1) : '0.0';

    document.getElementById('kpi-current-streak').textContent = currentStreak;
    document.getElementById('header-streak-count').textContent = currentStreak;
    document.getElementById('kpi-longest-streak').textContent = longestStreak;
    document.getElementById('kpi-total-reps').textContent = rangeTotal.toLocaleString('en-US');
    document.getElementById('kpi-daily-avg').textContent = rangeAvg;

    // -- Month labels --
    const monthLabelsEl = document.getElementById('heatmap-month-labels');
    if (monthLabelsEl) {
      const seen = new Set();
      const labelItems = [];
      days.forEach(d => {
        const mon = d.dayObj.toLocaleDateString('en-US', { month: 'short' });
        if (!seen.has(mon)) {
          seen.add(mon);
          labelItems.push({ month: mon, year: d.dayObj.getFullYear() });
        }
      });
      monthLabelsEl.innerHTML = labelItems.map((item, idx) => {
        const isLast = idx === labelItems.length - 1;
        return `<span>${item.month}${isLast ? ' ' + item.year : ''}</span>`;
      }).join('');
    }

    // -- Heatmap grid --
    const heatmapGrid = document.getElementById('heatmap-grid');
    let colsHTML = '';
    for (let w = 0; w < 12; w++) {
      let cellsHTML = '';
      for (let dow = 0; dow < 7; dow++) {
        const idx = w * 7 + dow;
        const dayObj = days[idx];
        if (!dayObj) {
          cellsHTML += `<div class="w-full aspect-square rounded-[4px] heat-0"></div>`;
          continue;
        }
        const heatClass = getHeatLevelClass(dayObj.total);
        const isSelected = idx === selectedIdx;
        const ringStyle = isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:ring-1 hover:ring-white/50';
        cellsHTML += `<button data-date="${dayObj.date}" title="${dayObj.label}: ${dayObj.total} reps" class="heatmap-cell w-full aspect-square rounded-[4px] ${heatClass} ${ringStyle} transition-transform"></button>`;
      }
      colsHTML += `<div class="flex flex-col gap-1.5">${cellsHTML}</div>`;
    }
    heatmapGrid.innerHTML = colsHTML;

    heatmapGrid.querySelectorAll('.heatmap-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        AppState.selectedDayDate = cell.getAttribute('data-date');
        AppState.isDayEditMode = false;
        renderStatsAndHeatmap();
      });
    });

    // -- Day inspector --
    const selDay = days[selectedIdx >= 0 ? selectedIdx : TODAY_INDEX];
    const selTitle = document.getElementById('selected-day-title');
    if (selTitle) {
      selTitle.textContent = selDay.date === todayDate ? `${selDay.label} (Today)` : selDay.label;
    }

    document.getElementById('inspector-morning').textContent = `${selDay.morningTotal} reps`;
    document.getElementById('inspector-evening').textContent = `${selDay.eveningTotal} reps`;
    document.getElementById('inspector-emom').textContent = selDay.emomTotal > 0 ? `${selDay.emomTotal} reps` : '—';
    document.getElementById('inspector-total').textContent = `${selDay.total} reps`;

    // Edit values (set from current data)
    AppState.editDayMorning = selDay.morningTotal;
    AppState.editDayEvening = selDay.eveningTotal;
    AppState.editDayEmom    = selDay.emomTotal;
    document.getElementById('edit-val-morning').textContent = AppState.editDayMorning;
    document.getElementById('edit-val-evening').textContent = AppState.editDayEvening;
    document.getElementById('edit-val-emom').textContent    = AppState.editDayEmom;

    // Toggle edit / readonly views
    const dayReadonlyView = document.getElementById('day-readonly-view');
    const dayEditView     = document.getElementById('day-edit-view');
    const btnToggle       = document.getElementById('btn-toggle-day-edit');
    if (AppState.isDayEditMode) {
      dayReadonlyView.classList.add('hidden');
      dayEditView.classList.remove('hidden');
      btnToggle.textContent = 'Done';
      btnToggle.className = 'px-2.5 py-1 rounded-lg bg-laser-orange text-white text-[11px] font-bold tap-btn';
    } else {
      dayReadonlyView.classList.remove('hidden');
      dayEditView.classList.add('hidden');
      btnToggle.textContent = 'Edit';
      btnToggle.className = 'px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-bold text-slate-200 tap-btn';
    }

    // -- Charts --
    renderDailyChart(days, TODAY_INDEX, selectedIdx);
    renderRollingAvgChart(days, TODAY_INDEX, selectedIdx);

    // -- Personal Records --
    renderPersonalRecords(allWorkouts);
  }

  // Day editor toggle
  document.getElementById('btn-toggle-day-edit').addEventListener('click', () => {
    AppState.isDayEditMode = !AppState.isDayEditMode;
    renderStatsAndHeatmap();
  });

  // Day editor steppers
  document.querySelectorAll('.day-edit-step').forEach(btn => {
    btn.addEventListener('click', async () => {
      const field = btn.getAttribute('data-field');
      const delta = parseInt(btn.getAttribute('data-delta'), 10);

      if (field === 'morning') AppState.editDayMorning = Math.max(0, AppState.editDayMorning + delta);
      else if (field === 'evening') AppState.editDayEvening = Math.max(0, AppState.editDayEvening + delta);
      else if (field === 'emom')   AppState.editDayEmom = Math.max(0, AppState.editDayEmom + delta);

      document.getElementById('edit-val-morning').textContent = AppState.editDayMorning;
      document.getElementById('edit-val-evening').textContent = AppState.editDayEvening;
      document.getElementById('edit-val-emom').textContent    = AppState.editDayEmom;

      // Persist to DB immediately
      await persistDayEdit(AppState.selectedDayDate, AppState.editDayMorning, AppState.editDayEvening, AppState.editDayEmom);
      // Sync today data if editing today
      if (AppState.selectedDayDate === AppState.todayStr && AppState.todayData) {
        AppState.todayData = await DB.getWorkout(AppState.todayStr) || AppState.todayData;
        renderTodaySessions();
      }
    });
  });

  async function persistDayEdit(dateStr, morningTotal, eveningTotal, emomTotal) {
    let wData = (await DB.getWorkout(dateStr)) || createEmptyWorkout(dateStr);
    // Adjust morning as a single set
    wData.morning.sets = [{ reps: morningTotal, timestamp: morningTotal > 0 ? (wData.morning.sets[0]?.timestamp || new Date().toISOString()) : null }];
    wData.morning.completed = morningTotal > 0;
    // Adjust evening as a single set
    wData.evening.sets = [{ reps: eveningTotal, timestamp: eveningTotal > 0 ? (wData.evening.sets[0]?.timestamp || new Date().toISOString()) : null }];
    wData.evening.completed = eveningTotal > 0;
    // Adjust EMOM as a single synthetic session
    if (emomTotal > 0) {
      const existingEmomTotal = (wData.emom || []).reduce((s, e) => s + (e.totalReps || 0), 0);
      if (existingEmomTotal !== emomTotal) {
        wData.emom = [{ targetRepsPerMinute: 0, completedRounds: 0, totalReps: emomTotal, failedRoundReps: 0, timestamp: new Date().toISOString() }];
      }
    } else {
      wData.emom = [];
    }
    await DB.saveWorkout(wData);
    await Streak.update();
  }

  // Range filter
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.currentChartRange = btn.getAttribute('data-range');
      document.querySelectorAll('.range-btn').forEach(b => {
        b.className = 'range-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white tap-btn';
      });
      btn.className = 'range-btn px-2.5 py-1 rounded-lg bg-white/10 text-white tap-btn';
      renderStatsAndHeatmap();
    });
  });

  // -- Spline chart renderer --
  function drawSplineChart(config) {
    const { pointsData, yStep, minYMax, gridLayerId, areaPathId, linePathId, dotsLayerId, xlabelsLayerId, dotColor } = config;
    const gridLayer    = document.getElementById(gridLayerId);
    const areaPath     = document.getElementById(areaPathId);
    const linePath     = document.getElementById(linePathId);
    const dotsLayer    = document.getElementById(dotsLayerId);
    const xlabelsLayer = document.getElementById(xlabelsLayerId);
    if (!gridLayer || !areaPath || !linePath || !dotsLayer || !xlabelsLayer) return;
    if (pointsData.length < 2) {
      gridLayer.innerHTML = '';
      areaPath.setAttribute('d', '');
      linePath.setAttribute('d', '');
      dotsLayer.innerHTML = '';
      xlabelsLayer.innerHTML = '';
      return;
    }

    const leftPad = 30, rightPad = 304, topPad = 12, bottomPad = 132;
    const chartW = rightPad - leftPad;
    const chartH = bottomPad - topPad;
    const maxVal = Math.max(minYMax, ...pointsData.map(p => p.val));
    const yMax = Math.ceil(maxVal / yStep) * yStep;
    const numSteps = Math.round(yMax / yStep);

    let gridHTML = '';
    for (let s = 0; s <= numSteps; s++) {
      const val = s * yStep;
      const y = bottomPad - (val / yMax) * chartH;
      gridHTML += `<line x1="${leftPad}" y1="${y.toFixed(1)}" x2="${rightPad}" y2="${y.toFixed(1)}" stroke="#1B2232" stroke-width="1"/>`;
      gridHTML += `<text x="${(leftPad-7).toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="end" fill="#64748B" font-size="9.5" font-weight="600" class="tabular-nums">${val}</text>`;
    }

    const coords = pointsData.map((pt, i) => ({
      ...pt,
      x: leftPad + (i / (pointsData.length - 1)) * chartW,
      y: bottomPad - Math.min(1, Math.max(0, pt.val / yMax)) * chartH
    }));

    coords.forEach(c => {
      gridHTML += `<line x1="${c.x.toFixed(1)}" y1="${topPad}" x2="${c.x.toFixed(1)}" y2="${bottomPad}" stroke="#1B2232" stroke-width="1"/>`;
    });
    gridLayer.innerHTML = gridHTML;

    let dLine = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i], p1 = coords[i+1];
      const cpx1 = p0.x + (p1.x - p0.x)*0.42;
      const cpy1 = Math.min(bottomPad, Math.max(topPad, p0.y));
      const cpx2 = p1.x - (p1.x - p0.x)*0.42;
      const cpy2 = Math.min(bottomPad, Math.max(topPad, p1.y));
      dLine += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    const dArea = `${dLine} L ${coords[coords.length-1].x.toFixed(1)} ${bottomPad} L ${coords[0].x.toFixed(1)} ${bottomPad} Z`;
    linePath.setAttribute('d', dLine);
    areaPath.setAttribute('d', dArea);

    const selDate = AppState.selectedDayDate;
    dotsLayer.innerHTML = coords.map(c => {
      const isSelected = c.date === selDate;
      const r = isSelected ? 5 : 3.5;
      const stroke = isSelected ? '#FFFFFF' : '#07090E';
      return `<g class="chart-node cursor-pointer" data-date="${c.date}"><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="11" fill="transparent"/><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="${dotColor}" stroke="${stroke}" stroke-width="2"/></g>`;
    }).join('');

    xlabelsLayer.innerHTML = coords.map(c => {
      const isSelected = c.date === selDate;
      const color = isSelected ? '#FFFFFF' : '#64748B';
      return `<text x="${c.x.toFixed(1)}" y="${bottomPad+19}" text-anchor="middle" fill="${color}" font-size="9.5" font-weight="600" class="tabular-nums">${c.mmdd}</text>`;
    }).join('');

    dotsLayer.querySelectorAll('.chart-node').forEach(node => {
      node.addEventListener('click', () => {
        AppState.selectedDayDate = node.getAttribute('data-date');
        renderStatsAndHeatmap();
      });
    });
  }

  function renderDailyChart(days, todayIndex, selectedIdx) {
    // Show last 7 days
    const pointsData = [];
    for (let offset = 6; offset >= 0; offset--) {
      const idx = todayIndex - offset;
      if (idx < 0 || idx >= days.length) continue;
      const d = days[idx];
      pointsData.push({ date: d.date, mmdd: d.mmdd, val: d.total });
    }
    if (pointsData.length < 2) return;
    drawSplineChart({
      pointsData, yStep: 10, minYMax: 30,
      gridLayerId: 'daily-grid-layer', areaPathId: 'daily-area-path',
      linePathId: 'daily-line-path', dotsLayerId: 'daily-dots-layer',
      xlabelsLayerId: 'daily-xlabels-layer', dotColor: '#FF6A00'
    });
  }

  function renderRollingAvgChart(days, todayIndex, selectedIdx) {
    const pointsData = [];
    for (let offset = 6; offset >= 0; offset--) {
      const idx = todayIndex - offset;
      if (idx < 0 || idx >= days.length) continue;
      let sum7 = 0;
      for (let k = 0; k < 7; k++) {
        const di = idx - k;
        if (di >= 0 && days[di]) sum7 += days[di].total;
      }
      const d = days[idx];
      pointsData.push({ date: d.date, mmdd: d.mmdd, val: sum7 / 7 });
    }
    if (pointsData.length < 2) return;
    drawSplineChart({
      pointsData, yStep: 5, minYMax: 20,
      gridLayerId: 'rolling-grid-layer', areaPathId: 'rolling-area-path',
      linePathId: 'rolling-line-path', dotsLayerId: 'rolling-dots-layer',
      xlabelsLayerId: 'rolling-xlabels-layer', dotColor: '#00F0FF'
    });
  }

  function renderPersonalRecords(allWorkouts) {
    let bestSingleSet = 0;
    let bestSession = 0;
    let bestDay = 0;
    let bestEmomReps = 0;

    allWorkouts.forEach(w => {
      (w.morning?.sets || []).forEach(s => { if (s.reps > bestSingleSet) bestSingleSet = s.reps; });
      (w.evening?.sets || []).forEach(s => { if (s.reps > bestSingleSet) bestSingleSet = s.reps; });
      const mTotal = workoutMorningTotal(w);
      const eTotal = workoutEveningTotal(w);
      const emomTotal = workoutEmomTotal(w);
      if (mTotal > bestSession) bestSession = mTotal;
      if (eTotal > bestSession) bestSession = eTotal;
      const dTotal = mTotal + eTotal + emomTotal;
      if (dTotal > bestDay) bestDay = dTotal;
      if (emomTotal > bestEmomReps) bestEmomReps = emomTotal;
    });

    document.getElementById('pr-best-single-set').textContent = bestSingleSet > 0 ? bestSingleSet : '—';
    document.getElementById('pr-best-session').textContent    = bestSession > 0 ? bestSession : '—';
    document.getElementById('pr-best-day').textContent        = bestDay > 0 ? bestDay : '—';
    document.getElementById('pr-best-emom').textContent       = bestEmomReps > 0 ? `${bestEmomReps} reps` : '—';
  }

  // ============================================================
  // 13. SETTINGS MODAL
  // ============================================================
  function toggleSettingsModal(show) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    if (show) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  }

  function setupSettings() {
    document.getElementById('btn-settings')?.addEventListener('click', () => toggleSettingsModal(true));
    document.getElementById('btn-close-modal')?.addEventListener('click', () => toggleSettingsModal(false));

    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) toggleSettingsModal(false);
    });

    // Export
    document.getElementById('btn-export-data')?.addEventListener('click', async () => {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pushup-backup-${Dates.formatDate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toggleSettingsModal(false);
      Toast.show('Data exported', 'success');
    });

    // Import
    document.getElementById('input-import-data')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          await DB.importAll(data);
          await initApp();
          toggleSettingsModal(false);
          Toast.show('Data imported successfully!', 'success');
        } catch (err) {
          Toast.show('Invalid import file', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Clear
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
      if (confirm('Are you absolutely sure? This will delete all data.')) {
        const check = prompt('Type CONFIRM to delete everything');
        if (check === 'CONFIRM') {
          DB.clearAll().then(() => {
            initApp();
            toggleSettingsModal(false);
            Toast.show('All data cleared', 'success');
          });
        }
      }
    });
  }

  // ============================================================
  // 14. AUTO-SAVE ON VISIBILITY / BEFOREUNLOAD
  // ============================================================
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && AppState.isDirty) {
      saveTodayData();
    }
  });
  window.addEventListener('beforeunload', () => {
    if (AppState.isDirty) saveTodayData();
  });

  // ============================================================
  // 15. SERVICE WORKER
  // ============================================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.error('SW registration failed', err));
    }
  }

  // ============================================================
  // 16. INITIALIZATION
  // ============================================================
  async function initApp() {
    await DB.init();

    const todayStr = Dates.formatDate(Dates.getEffectiveDate());
    AppState.todayStr = todayStr;

    let todayData = await DB.getWorkout(todayStr);
    if (!todayData) {
      todayData = createEmptyWorkout(todayStr);
      await DB.saveWorkout(todayData);
    }
    AppState.todayData = todayData;

    // Load streak
    const streakMeta = await DB.getMeta('streak') || { current: 0, longest: 0, lastDate: null };
    AppState.streak = streakMeta;
    await Streak.update();

    // Set header date
    const h1 = appTopBar.querySelector('h1');
    if (h1) h1.textContent = Dates.formatDisplayDate(Dates.getEffectiveDate());

    // Set selected day to today
    AppState.selectedDayDate = todayStr;

    // Render today sessions
    renderTodaySessions();

    // Initialize EMOM UI
    syncSetupUI();
    renderMorph(0);

    // Start on EMOM tab (as the showcase shows)
    switchTab('emom');

    // Start clock
    updateStatusBarClock();
    setInterval(updateStatusBarClock, 30000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupSettings();
    registerServiceWorker();
    initApp();
  });

})();
