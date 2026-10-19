(() => {
  'use strict';

  // ==========================================
  // 1. DATE UTILITIES
  // ==========================================
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
    formatMonthYear(date) {
      const options = { month: 'long', year: 'numeric' };
      return new Date(date).toLocaleDateString('en-US', options);
    },
    isToday(date) {
      const today = Dates.getEffectiveDate();
      return Dates.formatDate(date) === Dates.formatDate(today);
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
      const hours = now.getHours();
      // 00:00 to 03:00 belongs to yesterday
      if (hours >= 0 && hours < 3) {
        now.setDate(now.getDate() - 1);
      }
      return now;
    },
    getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    },
    getFirstDayOfMonth(year, month) {
      return new Date(year, month, 1).getDay();
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

  // ==========================================
  // 2. DATABASE LAYER
  // ==========================================
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

          request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            useLocalStorage = true;
            resolve();
          };

          request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
          };

          request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains(STORE_WORKOUTS)) {
              dbInstance.createObjectStore(STORE_WORKOUTS, { keyPath: 'date' });
            }
            if (!dbInstance.objectStoreNames.contains(STORE_META)) {
              dbInstance.createObjectStore(STORE_META, { keyPath: 'key' });
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
          const transaction = db.transaction([STORE_WORKOUTS], 'readonly');
          const store = transaction.objectStore(STORE_WORKOUTS);
          const request = store.get(dateStr);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => resolve(null);
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
          const transaction = db.transaction([STORE_WORKOUTS], 'readwrite');
          const store = transaction.objectStore(STORE_WORKOUTS);
          const request = store.put(workout);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
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
          const transaction = db.transaction([STORE_WORKOUTS], 'readonly');
          const store = transaction.objectStore(STORE_WORKOUTS);
          const request = store.getAll();
          request.onsuccess = () => {
            const workouts = request.result || [];
            workouts.sort((a, b) => a.date.localeCompare(b.date));
            resolve(workouts);
          };
          request.onerror = () => resolve([]);
        });
      },

      getWorkoutsInRange(startDateStr, endDateStr) {
        return this.getAllWorkouts().then(workouts => {
          return workouts.filter(w => w.date >= startDateStr && w.date <= endDateStr);
        });
      },

      deleteWorkout(dateStr) {
        return new Promise((resolve, reject) => {
          if (useLocalStorage) {
            localStorage.removeItem(`workout_${dateStr}`);
            resolve();
            return;
          }
          if (!db) return reject(new Error('DB not initialized'));
          const transaction = db.transaction([STORE_WORKOUTS], 'readwrite');
          const store = transaction.objectStore(STORE_WORKOUTS);
          const request = store.delete(dateStr);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
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
          const transaction = db.transaction([STORE_META], 'readonly');
          const store = transaction.objectStore(STORE_META);
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result ? request.result.value : null);
          request.onerror = () => resolve(null);
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
          const transaction = db.transaction([STORE_META], 'readwrite');
          const store = transaction.objectStore(STORE_META);
          const request = store.put({ key, value });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      },

      clearAll() {
        return new Promise((resolve, reject) => {
          if (useLocalStorage) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key.startsWith('workout_') || key.startsWith('meta_')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            resolve();
            return;
          }
          if (!db) return reject(new Error('DB not initialized'));
          const transaction = db.transaction([STORE_WORKOUTS, STORE_META], 'readwrite');
          transaction.objectStore(STORE_WORKOUTS).clear();
          transaction.objectStore(STORE_META).clear();
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      },
      
      exportAll() {
        return Promise.all([this.getAllWorkouts(), this.getMeta('streak')]).then(([workouts, streak]) => {
          return {
            version: DB_VERSION,
            exportDate: new Date().toISOString(),
            workouts,
            meta: { streak }
          };
        });
      },
      
      async importAll(data) {
        if (!data || !data.workouts || !Array.isArray(data.workouts)) {
          throw new Error("Invalid export file format");
        }
        await this.clearAll();
        for (const w of data.workouts) {
          await this.saveWorkout(w);
        }
        if (data.meta && data.meta.streak) {
          await this.setMeta('streak', data.meta.streak);
        }
      }
    };
  })();

  // ==========================================
  // 3. STATE MANAGEMENT
  // ==========================================
  const Store = {
    state: {
      currentView: 'view-today',
      selectedDate: Dates.getEffectiveDate(),
      todayData: null,
      historyDate: Dates.getEffectiveDate(),
      calendarMonth: Dates.getEffectiveDate(),
      calendarData: {},
      isEditing: false,
      streak: { current: 0, longest: 0, lastDate: null },
      chartRange: '7', // '7', '30', '90', 'all'
      isDirty: false
    },
    listeners: [],
    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter(listener => listener !== fn);
      };
    },
    setState(updates) {
      this.state = { ...this.state, ...updates };
      this.notify();
    },
    getState() {
      return this.state;
    },
    notify() {
      this.listeners.forEach(fn => fn(this.state));
    }
  };

  function createEmptyWorkout(dateStr) {
    return {
      date: dateStr,
      morning: {
        sets: [{ reps: 0, timestamp: null }, { reps: 0, timestamp: null }, { reps: 0, timestamp: null }],
        completed: false
      },
      evening: {
        sets: [{ reps: 0, timestamp: null }, { reps: 0, timestamp: null }, { reps: 0, timestamp: null }],
        completed: false
      },
      notes: ''
    };
  }

  // ==========================================
  // 4. STREAK ENGINE
  // ==========================================
  const Streak = {
    async calculate(allWorkouts) {
      if (!allWorkouts || allWorkouts.length === 0) {
        return { current: 0, longest: 0, lastDate: null };
      }

      // Filter and sort workouts that have BOTH morning and evening completed with >0 reps
      const validWorkouts = allWorkouts.filter(w => {
        const morningHasReps = w.morning && w.morning.sets && w.morning.sets.some(s => s.reps > 0);
        const eveningHasReps = w.evening && w.evening.sets && w.evening.sets.some(s => s.reps > 0);
        return morningHasReps && eveningHasReps;
      }).sort((a, b) => a.date.localeCompare(b.date));

      if (validWorkouts.length === 0) {
        return { current: 0, longest: 0, lastDate: null };
      }

      let currentStreak = 1;
      let longestStreak = 1;
      
      for (let i = 1; i < validWorkouts.length; i++) {
        const prevDate = new Date(validWorkouts[i - 1].date);
        const currDate = new Date(validWorkouts[i].date);
        const diff = Dates.daysBetween(currDate, prevDate);

        if (diff === 1) {
          currentStreak++;
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }
        } else if (diff > 1) {
          currentStreak = 1;
        }
      }

      const lastValidDate = validWorkouts[validWorkouts.length - 1].date;
      const today = Dates.formatDate(Dates.getEffectiveDate());
      const yesterday = Dates.formatDate(Dates.addDays(Dates.getEffectiveDate(), -1));

      // If the last valid date is not today and not yesterday, current streak is broken
      if (lastValidDate !== today && lastValidDate !== yesterday) {
        currentStreak = 0;
      }

      return {
        current: currentStreak,
        longest: longestStreak,
        lastDate: lastValidDate
      };
    },

    async update() {
      const allWorkouts = await DB.getAllWorkouts();
      const newStreak = await this.calculate(allWorkouts);
      
      // Get existing meta to preserve longest streak if historical edits dropped current longest
      const oldStreakMeta = await DB.getMeta('streak') || { longest: 0 };
      if (newStreak.longest < oldStreakMeta.longest) {
         newStreak.longest = oldStreakMeta.longest; // Only keep highest ever recorded
      }
      
      await DB.setMeta('streak', newStreak);
      Store.setState({ streak: newStreak });
    }
  };

  // ==========================================
  // 5. TOAST NOTIFICATIONS
  // ==========================================
  const Toast = {
    show(message, type = 'info', duration = 3000) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      
      container.appendChild(toast);
      
      // Animate in
      requestAnimationFrame(() => {
        toast.classList.add('active');
      });

      setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300); // Wait for transition
      }, duration);
    }
  };

  // ==========================================
  // 6. UI RENDERERS & CONTROLLERS
  // ==========================================
  
  function updateDOM() {
    const state = Store.getState();
    
    // Update Streak displays
    const streakDisplay = document.getElementById('header-streak');
    if (streakDisplay) {
        streakDisplay.textContent = `🔥 ${state.streak.current}`;
    }

    // Toggle views based on currentView
    ['view-today', 'view-history', 'view-stats'].forEach(v => {
      const viewEl = document.getElementById(v);
      if (viewEl) {
        if (state.currentView === v) {
            viewEl.classList.add('active');
        } else {
            viewEl.classList.remove('active');
        }
      }
    });

    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-target') === state.currentView) {
          btn.classList.add('active');
      } else {
          btn.classList.remove('active');
      }
    });

    if (state.currentView === 'view-today') {
      renderTodayView();
    } else if (state.currentView === 'view-history') {
      renderHistoryView();
    } else if (state.currentView === 'view-stats') {
      renderStatsView();
    }
  }

  // --- Today View ---
  function renderTodayView() {
    const state = Store.getState();
    const data = state.todayData;
    if (!data) return;

    const dateDisplay = document.getElementById('header-date');
    if (dateDisplay) {
      dateDisplay.textContent = Dates.formatDisplayDate(Dates.getEffectiveDate());
    }

    let dailyTotal = 0;
    
    const updateSessionUI = (sessionName, sessionData) => {
        let sessionTotal = 0;
        let hasReps = false;

        for (let i = 1; i <= 3; i++) {
            const input = document.getElementById(`input-${sessionName}-${i}`);
            if (input) {
                const reps = sessionData.sets[i - 1]?.reps || 0;
                // Only update value if not currently focused to avoid messing up typing
                if (document.activeElement !== input) {
                    input.value = reps > 0 ? reps : '';
                }
                sessionTotal += reps;
                if (reps > 0) hasReps = true;
            }
        }
        
        dailyTotal += sessionTotal;

        const totalEl = document.getElementById(`total-${sessionName}`);
        if (totalEl) totalEl.textContent = sessionTotal;

        const badge = document.getElementById(`status-${sessionName}`);
        if (badge) {
            if (hasReps) {
                badge.textContent = 'Complete';
                badge.classList.remove('incomplete');
                badge.classList.add('complete');
            } else {
                badge.textContent = 'Incomplete';
                badge.classList.remove('complete');
                badge.classList.add('incomplete');
            }
        }
    };

    updateSessionUI('morning', data.morning);
    updateSessionUI('evening', data.evening);

    const totalDisplay = document.getElementById('total-daily');
    if (totalDisplay) {
      totalDisplay.textContent = dailyTotal;
    }
  }

  function handleSetInputChange(e) {
    if (!e.target.classList.contains('rep-input')) return;
    
    const input = e.target;
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 999) val = 999;
    
    // We don't overwrite the value while typing to allow empty string temporarily
    
    updateTodayDataFromUI();
  }

  function handleStepperClick(e) {
    const btn = e.target.closest('.btn-stepper');
    if (!btn) return;

    const delta = parseInt(btn.getAttribute('data-val'), 10);
    const session = btn.getAttribute('data-session');
    const setNum = btn.getAttribute('data-set');
    
    const inputId = `input-${session}-${setNum}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    let val = parseInt(input.value, 10) || 0;
    val += delta;
    if (val < 0) val = 0;
    if (val > 999) val = 999;
    
    input.value = val > 0 ? val : '';
    updateTodayDataFromUI();
  }

  function updateTodayDataFromUI() {
    const state = Store.getState();
    if (!state.todayData) return;
    
    const data = JSON.parse(JSON.stringify(state.todayData)); // clone

    const getSessionData = (sessionName) => {
      const sets = [];
      let hasReps = false;
      for (let i = 1; i <= 3; i++) {
          const input = document.getElementById(`input-${sessionName}-${i}`);
          let reps = input ? (parseInt(input.value, 10) || 0) : 0;
          if (reps < 0) reps = 0;
          if (reps > 999) reps = 999;
          if (reps > 0) hasReps = true;
          sets.push({
              reps,
              timestamp: data[sessionName].sets[i - 1]?.timestamp || (reps > 0 ? Date.now() : null)
          });
      }
      data[sessionName].sets = sets;
      data[sessionName].completed = hasReps;
    };

    getSessionData('morning');
    getSessionData('evening');

    Store.setState({ todayData: data, isDirty: true });
    renderTodayView(); // update totals
  }

  async function saveTodayData() {
    const state = Store.getState();
    if (!state.isDirty) return;

    await DB.saveWorkout(state.todayData);
    await Streak.update();
    Store.setState({ isDirty: false });
    Toast.show('Workout saved!', 'success');
  }

  // --- History View ---
  async function loadMonthData(year, month) {
    const startStr = Dates.formatDate(new Date(year, month, 1));
    const endStr = Dates.formatDate(new Date(year, month + 1, 0));
    
    const workouts = await DB.getWorkoutsInRange(startStr, endStr);
    const calendarData = {};
    workouts.forEach(w => {
      calendarData[w.date] = w;
    });
    
    Store.setState({ calendarData });
    renderHistoryView();
  }

  function renderHistoryView() {
    const state = Store.getState();
    const year = state.calendarMonth.getFullYear();
    const month = state.calendarMonth.getMonth();
    
    const label = document.getElementById('current-month-display');
    if (label) label.textContent = Dates.formatMonthYear(state.calendarMonth);

    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.innerHTML = '';
    
    const daysInMonth = Dates.getDaysInMonth(year, month);
    const firstDay = Dates.getFirstDayOfMonth(year, month);
    const todayStr = Dates.formatDate(Dates.getEffectiveDate());

    // Padding days
    for (let i = 0; i < firstDay; i++) {
      const div = document.createElement('div');
      div.className = 'calendar-day empty';
      grid.appendChild(div);
    }

    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = Dates.formatDate(d);
      
      const div = document.createElement('div');
      div.className = 'calendar-day';
      div.textContent = i;
      
      if (dateStr === todayStr) {
        div.classList.add('today');
      }

      if (dateStr === Dates.formatDate(state.historyDate)) {
        div.classList.add('selected');
      }

      const wData = state.calendarData[dateStr];
      if (wData) {
        const morningHasReps = wData.morning?.sets?.some(s => s.reps > 0);
        const eveningHasReps = wData.evening?.sets?.some(s => s.reps > 0);
        
        if (morningHasReps && eveningHasReps) {
          div.classList.add('complete');
        } else if (morningHasReps || eveningHasReps) {
          div.classList.add('partial');
        }
      }

      div.onclick = () => {
        Store.setState({ historyDate: d, isEditing: false });
        renderHistoryDetail();
      };
      
      grid.appendChild(div);
    }
    
    renderHistoryDetail();
  }

  function renderHistoryDetail() {
    const state = Store.getState();
    const dateStr = Dates.formatDate(state.historyDate);
    const data = state.calendarData[dateStr];

    const titleEl = document.getElementById('selected-day-title');
    if (titleEl) titleEl.textContent = Dates.formatDisplayDate(state.historyDate);

    const detailsContainer = document.getElementById('selected-day-details');
    const editContainer = document.getElementById('retro-edit-container');
    const editBtn = document.getElementById('btn-edit-day');

    if (state.isEditing) {
        detailsContainer.classList.add('hidden');
        editContainer.classList.remove('hidden');
        editBtn.style.display = 'none';

        // Populate inputs
        for (let i = 1; i <= 3; i++) {
            const mInput = document.getElementById(`edit-morning-${i}`);
            const eInput = document.getElementById(`edit-evening-${i}`);
            if (mInput) mInput.value = data?.morning?.sets[i-1]?.reps || 0;
            if (eInput) eInput.value = data?.evening?.sets[i-1]?.reps || 0;
        }
    } else {
        detailsContainer.classList.remove('hidden');
        editContainer.classList.add('hidden');
        
        // Hide edit button for future dates
        if (Dates.isFutureDate(state.historyDate)) {
            editBtn.style.display = 'none';
        } else {
            editBtn.style.display = 'block';
        }

        const calcTotal = (session) => session?.sets?.reduce((sum, s) => sum + s.reps, 0) || 0;
        const mTotal = calcTotal(data?.morning);
        const eTotal = calcTotal(data?.evening);

        document.getElementById('detail-morning').textContent = `${mTotal} reps`;
        document.getElementById('detail-evening').textContent = `${eTotal} reps`;
        document.getElementById('detail-total').textContent = `${mTotal + eTotal} reps`;
    }
  }

  async function saveRetroactiveEdit() {
    const state = Store.getState();
    const dateStr = Dates.formatDate(state.historyDate);
    
    let wData = state.calendarData[dateStr] || createEmptyWorkout(dateStr);
    
    for (let i = 1; i <= 3; i++) {
        const mInput = document.getElementById(`edit-morning-${i}`);
        const eInput = document.getElementById(`edit-evening-${i}`);
        let mReps = parseInt(mInput.value, 10) || 0;
        let eReps = parseInt(eInput.value, 10) || 0;
        if (mReps < 0) mReps = 0;
        if (mReps > 999) mReps = 999;
        if (eReps < 0) eReps = 0;
        if (eReps > 999) eReps = 999;
        
        if (!wData.morning.sets[i-1]) wData.morning.sets[i-1] = { reps: 0, timestamp: null };
        if (!wData.evening.sets[i-1]) wData.evening.sets[i-1] = { reps: 0, timestamp: null };
        
        wData.morning.sets[i-1].reps = mReps;
        wData.evening.sets[i-1].reps = eReps;
    }
    
    wData.morning.completed = wData.morning.sets.some(s => s.reps > 0);
    wData.evening.completed = wData.evening.sets.some(s => s.reps > 0);

    // Only save if there's data, otherwise if it's all 0, maybe delete it to save space?
    // Let's just save it.
    await DB.saveWorkout(wData);
    
    // Also update todayData if we edited today
    if (dateStr === Dates.formatDate(Dates.getEffectiveDate())) {
        Store.setState({ todayData: wData });
    }

    await Streak.update();
    
    // Reload calendar data to reflect changes
    const year = state.calendarMonth.getFullYear();
    const month = state.calendarMonth.getMonth();
    await loadMonthData(year, month);
    
    Store.setState({ isEditing: false });
    Toast.show('Workout updated', 'success');
  }

  // --- Stats View ---
  let chartInstances = {};

  async function renderStatsView() {
    const workouts = await DB.getAllWorkouts();
    const state = Store.getState();
    
    document.getElementById('stat-current-streak').textContent = `🔥 ${state.streak.current}`;
    document.getElementById('stat-longest-streak').textContent = state.streak.longest;
    
    let bestSet = 0;
    let bestSession = 0;
    let bestDay = 0;
    
    // Build a lookup map: date string -> { total, morning, evening }
    const dailyDataMap = {};

    workouts.forEach(w => {
      let mTotal = 0;
      let eTotal = 0;
      
      if (w.morning?.sets) {
        w.morning.sets.forEach(s => {
          mTotal += s.reps;
          if (s.reps > bestSet) bestSet = s.reps;
        });
      }
      if (w.evening?.sets) {
        w.evening.sets.forEach(s => {
          eTotal += s.reps;
          if (s.reps > bestSet) bestSet = s.reps;
        });
      }
      
      const dTotal = mTotal + eTotal;
      if (dTotal > 0) {
        dailyDataMap[w.date] = { date: w.date, total: dTotal, morning: mTotal, evening: eTotal };
      }
      
      if (mTotal > bestSession) bestSession = mTotal;
      if (eTotal > bestSession) bestSession = eTotal;
      if (dTotal > bestDay) bestDay = dTotal;
    });

    // All days with data in chronological order (used for the 'all' range)
    const dailyData = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

    // Compute range-aware Total Reps and Daily Average
    const todayStr = Dates.formatDate(Dates.getEffectiveDate());
    const rangeStr = state.chartRange;
    let rangeStartStr;
    let rangeDays; // total days in the window for averaging

    if (rangeStr === 'all') {
      rangeStartStr = dailyData.length > 0 ? dailyData[0].date : todayStr;
      rangeDays = Dates.daysBetween(new Date(rangeStartStr), new Date(todayStr)) + 1;
    } else {
      const numDays = parseInt(rangeStr, 10);
      rangeStartStr = Dates.formatDate(Dates.addDays(Dates.getEffectiveDate(), -(numDays - 1)));
      rangeDays = numDays;
    }

    let rangeTotalReps = 0;
    dailyData.forEach(d => {
      if (d.date >= rangeStartStr && d.date <= todayStr) {
        rangeTotalReps += d.total;
      }
    });

    const rangeAvg = rangeDays > 0 ? (rangeTotalReps / rangeDays).toFixed(1) : '0.0';
    
    document.getElementById('stat-total-reps').textContent = rangeTotalReps;
    document.getElementById('stat-daily-avg').textContent = rangeAvg;
    
    document.getElementById('record-set').textContent = bestSet;
    document.getElementById('record-session').textContent = bestSession;
    document.getElementById('record-day').textContent = bestDay;

    renderCharts(dailyData, rangeStr);
  }

  function calculateRollingAverage(dataArray, windowSize) {
    const result = [];
    for (let i = 0; i < dataArray.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
            sum += dataArray[j];
            count++;
        }
        result.push(sum / count);
    }
    return result;
  }

  function renderCharts(dailyData, rangeStr) {
    if (!window.Chart) return;

    // Build a quick lookup: date string -> entry
    const dataByDate = {};
    dailyData.forEach(d => { dataByDate[d.date] = d; });

    const todayDate = Dates.getEffectiveDate();
    const todayStr = Dates.formatDate(todayDate);

    // Determine start date for range
    let startDate;
    if (rangeStr === 'all') {
      if (dailyData.length > 0) {
        // Start from the earliest date with data
        startDate = new Date(dailyData[0].date);
      } else {
        startDate = new Date(todayDate);
      }
    } else {
      const numDays = parseInt(rangeStr, 10);
      startDate = Dates.addDays(todayDate, -(numDays - 1));
    }

    // Build zero-filled array covering every day from startDate to today
    const filteredData = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const endDate = new Date(todayDate);
    endDate.setHours(0, 0, 0, 0);

    while (cursor <= endDate) {
      const dateStr = Dates.formatDate(cursor);
      if (dataByDate[dateStr]) {
        filteredData.push(dataByDate[dateStr]);
      } else {
        filteredData.push({ date: dateStr, total: 0, morning: 0, evening: 0 });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const labels = filteredData.map(d => d.date.substring(5)); // MM-DD
    const totals = filteredData.map(d => d.total);
    const mornings = filteredData.map(d => d.morning);
    const evenings = filteredData.map(d => d.evening);
    const rollingAvgs = calculateRollingAverage(totals, 7);

    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#a0a0a0' } },
        tooltip: { backgroundColor: '#1a1a1a', titleColor: '#fff', bodyColor: '#fff' }
      },
      scales: {
        x: { grid: { color: '#2a2a2a' }, ticks: { color: '#a0a0a0' } },
        y: { grid: { color: '#2a2a2a' }, ticks: { color: '#a0a0a0' }, beginAtZero: true }
      }
    };

    const drawChart = (id, type, dataObj) => {
      const ctx = document.getElementById(id);
      if (!ctx) return;
      if (chartInstances[id]) chartInstances[id].destroy();
      chartInstances[id] = new Chart(ctx, { type, data: dataObj, options: chartOptions });
    };

    // 1. Daily Total (Line)
    drawChart('chart-daily', 'line', {
      labels,
      datasets: [{
        label: 'Total Reps',
        data: totals,
        borderColor: '#4a9eff',
        backgroundColor: 'rgba(74, 158, 255, 0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#4a9eff'
      }]
    });

    // 2. Comparison (Bar)
    drawChart('chart-comparison', 'bar', {
      labels,
      datasets: [
        { label: 'Morning', data: mornings, backgroundColor: '#4a9eff' },
        { label: 'Evening', data: evenings, backgroundColor: '#9b51e0' }
      ]
    });

    // 3. 7-Day Rolling Average (Line)
    drawChart('chart-rolling', 'line', {
      labels,
      datasets: [{
        label: '7-Day Rolling Avg',
        data: rollingAvgs,
        borderColor: '#00c853',
        backgroundColor: 'rgba(0, 200, 83, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#00c853'
      }]
    });
  }

  // ==========================================
  // 7. SETTINGS & EXPORT / IMPORT
  // ==========================================
  
  function toggleSettingsModal(show) {
      const overlay = document.getElementById('modal-overlay');
      if (overlay) {
          if (show) {
              overlay.classList.remove('hidden');
          } else {
              overlay.classList.add('hidden');
          }
      }
  }

  function setupSettings() {
    const btnSettings = document.getElementById('btn-settings');
    const btnClose = document.getElementById('btn-close-modal');
    
    if (btnSettings) btnSettings.addEventListener('click', () => toggleSettingsModal(true));
    if (btnClose) btnClose.addEventListener('click', () => toggleSettingsModal(false));

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
          await initApp(); // Reload
          toggleSettingsModal(false);
          Toast.show('Data imported successfully!', 'success');
        } catch (err) {
          Toast.show('Invalid import file', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // reset
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

  // ==========================================
  // 8. EVENT LISTENERS & SETUP
  // ==========================================
  
  function setupEventListeners() {
    // Nav Tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            Store.setState({ currentView: target });
        });
    });

    // Range Selector
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const range = btn.getAttribute('data-range');
            Store.setState({ chartRange: range });
            if (Store.getState().currentView === 'view-stats') {
                renderStatsView(); // re-render charts
            }
        });
    });

    // Today View Inputs
    const viewToday = document.getElementById('view-today');
    if (viewToday) {
        viewToday.addEventListener('input', handleSetInputChange);
        viewToday.addEventListener('click', handleStepperClick);
    }

    const saveBtn = document.getElementById('btn-save-today');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
          document.activeElement?.blur();
          saveTodayData();
      });
    }

    // Calendar Navigation
    const prevBtn = document.getElementById('btn-prev-month');
    const nextBtn = document.getElementById('btn-next-month');
    
    if (prevBtn) prevBtn.addEventListener('click', () => {
      const d = Store.getState().calendarMonth;
      const newD = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      Store.setState({ calendarMonth: newD });
      loadMonthData(newD.getFullYear(), newD.getMonth());
    });
    
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const d = Store.getState().calendarMonth;
      const newD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      Store.setState({ calendarMonth: newD });
      loadMonthData(newD.getFullYear(), newD.getMonth());
    });

    // Retroactive Edit mode
    const btnEdit = document.getElementById('btn-edit-day');
    const btnSaveEdit = document.getElementById('btn-save-edit');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    
    if (btnEdit) btnEdit.addEventListener('click', () => Store.setState({ isEditing: true }));
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => Store.setState({ isEditing: false }));
    if (btnSaveEdit) btnSaveEdit.addEventListener('click', saveRetroactiveEdit);

    setupSettings();

    // Auto-save on visibility change / beforeunload
    const handleAutoSave = () => {
      if (Store.getState().isDirty) {
        saveTodayData();
      }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleAutoSave();
    });
    window.addEventListener('beforeunload', handleAutoSave);

    // Modal overlay click outside
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggleSettingsModal(false);
      });
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Enter') {
            e.target.blur();
            if (Store.getState().isEditing) {
                saveRetroactiveEdit();
            } else {
                saveTodayData();
            }
        }
        return;
      }
      if (e.key === '1') Store.setState({ currentView: 'view-today' });
      if (e.key === '2') Store.setState({ currentView: 'view-history' });
      if (e.key === '3') Store.setState({ currentView: 'view-stats' });
      if (e.key === 'Escape') toggleSettingsModal(false);
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.error('SW registration failed', err));
    }
  }

  // ==========================================
  // 9. INITIALIZATION
  // ==========================================
  
  async function initApp() {
    await DB.init();
    
    const todayStr = Dates.formatDate(Dates.getEffectiveDate());
    let todayData = await DB.getWorkout(todayStr);
    
    if (!todayData) {
      todayData = createEmptyWorkout(todayStr);
      await DB.saveWorkout(todayData);
    }

    const streakMeta = await DB.getMeta('streak') || { current: 0, longest: 0, lastDate: null };
    
    Store.setState({ 
      todayData, 
      selectedDate: Dates.getEffectiveDate(),
      streak: streakMeta,
      calendarMonth: Dates.getEffectiveDate(),
      isDirty: false
    });
    
    await Streak.update(); // Recalculate streak to be safe
    
    Store.subscribe(updateDOM);
    updateDOM(); // initial render
    
    loadMonthData(Dates.getEffectiveDate().getFullYear(), Dates.getEffectiveDate().getMonth());
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupKeyboardShortcuts();
    registerServiceWorker();
    initApp();
  });

})();
