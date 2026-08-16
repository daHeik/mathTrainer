(function(){
  "use strict";

  var STORAGE_KEY = "km_1x1_trainer_v1"; // legacy single-profile storage
  var ROOT_KEY = "km_1x1_trainer_v2";
  var INTERVALS = [1, 1, 2, 4, 7, 12, 20, 32]; // days, indexed by box level
  var MAX_BOX = INTERVALS.length - 1;
  var FAST_MS = 3500;
  var SLOW_MS = 9000;
  var INPUT_TIME_COMPENSATION_MS = 2000;
  var CORRECT_ADVANCE_DELAY_MS = 1400;
  var WRONG_TAP_DELAY_MS = 1200; // minimum time to look at the correct answer before a tap advances
  var GAME_DURATION_MS = 2 * 60 * 1000;
  var GAME_MAX_ATTEMPTS = 3;
  var DIVISION_UNLOCK_BOX = 4;

  var ACCENT_THEMES = {
    purple:{ primary:'#6c5ce7', secondary:'#a29bfe', accent:'#fdcb6e',
      soft:'#f4f3ff', border:'#e4e2fb', surface:'#fbfaff', shadow:'rgba(108,92,231,0.4)' },
    blue:{ primary:'#2563eb', secondary:'#60a5fa', accent:'#fbbf24',
      soft:'#eff6ff', border:'#bfdbfe', surface:'#f8fbff', shadow:'rgba(37,99,235,0.4)' },
    green:{ primary:'#047857', secondary:'#34d399', accent:'#fbbf24',
      soft:'#ecfdf5', border:'#a7f3d0', surface:'#f5fffa', shadow:'rgba(4,120,87,0.4)' },
    orange:{ primary:'#c2410c', secondary:'#fb923c', accent:'#fde047',
      soft:'#fff7ed', border:'#fed7aa', surface:'#fffaf5', shadow:'rgba(194,65,12,0.4)' },
    pink:{ primary:'#be185d', secondary:'#f472b6', accent:'#facc15',
      soft:'#fdf2f8', border:'#fbcfe8', surface:'#fff8fc', shadow:'rgba(190,24,93,0.4)' }
  };

  var GOOD_MESSAGES = ["Super gemacht! 🌟", "Klasse! 🎉", "Toll gemacht! 👏", "Weiter so! 💪", "Perfekt! ✨"];
  var BAD_MESSAGES_PREFIX = ["Fast geschafft!", "Kein Problem!", "Nächstes Mal klappt's!", "Schau nochmal genau hin!"];

  function todayStr(){
    return new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  }
  function addDays(dateStr, n){
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('sv');
  }
  function daysBetween(a, b){
    var da = new Date(a + "T00:00:00");
    var db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
  }
  function factKey(a, b){ return a + "x" + b; }
  function divisionSkillKey(a, b){ return 'd:' + factKey(a, b); }
  function divisionDefaults(today){
    return {
      unlocked:false, box:0, dueDate:today, seen:false,
      correctCount:0, wrongCount:0, correctStreak:0,
      totalResponseMs:0, timedAttemptCount:0, lastPracticedDate:null
    };
  }
  function shuffle(arr){
    for (var i = arr.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function spreadQueueKeys(keys){
    var counts = {};
    keys.forEach(function(key){ counts[key] = (counts[key] || 0) + 1; });
    var result = [];
    while (result.length < keys.length){
      var last = result.length ? result[result.length - 1] : null;
      var candidates = Object.keys(counts).filter(function(key){
        return counts[key] > 0 && key !== last;
      });
      if (!candidates.length){
        candidates = Object.keys(counts).filter(function(key){ return counts[key] > 0; });
      }
      var highestCount = Math.max.apply(null, candidates.map(function(key){ return counts[key]; }));
      candidates = candidates.filter(function(key){ return counts[key] === highestCount; });
      var picked = candidates[Math.floor(Math.random() * candidates.length)];
      result.push(picked);
      counts[picked]--;
    }
    return result;
  }

  function trimRepeatedQueueFacts(today){
    if (!today || today.completed || !Array.isArray(today.queue)) return;
    var index = Math.max(0, Math.min(Number(today.index) || 0, today.queue.length));
    var completed = today.queue.slice(0, index);
    var counts = {};
    completed.forEach(function(key){ counts[key] = (counts[key] || 0) + 1; });
    var pending = today.queue.slice(index).filter(function(key){
      var retryCount = Math.min(2, Number((today.requeueCounts || {})[key]) || 0);
      var limit = 2 + retryCount;
      if ((counts[key] || 0) >= limit) return false;
      counts[key] = (counts[key] || 0) + 1;
      return true;
    });
    today.queue = completed.concat(pending);
    today.index = index;
  }

  function defaultProfile(){
    var today = todayStr();
    return {
      version: 2,
      config: {
        min: 1, max: 10, tasksPerDay: 5, rewardEvery: 10,
        childName: "", sound: true, answerMode: "adaptive", gapTasks: false,
        enabledTables: [1,2,3,4,5,6,7,8,9,10], newFactsPerRound: 2,
        autoUnlockTables: false, divisionEnabled: false, accentTheme: 'purple'
      },
      facts: {}, // key -> {a,b,box,dueDate,seen,correctCount,wrongCount,correctStreak,...}
      today: {
        date: today,
        queue: [],       // array of fact keys
        index: 0,
        correct: 0,
        completed: false,
        bonus: false,
        requeueCounts: {}, // fact key -> times re-added to this session after a wrong answer
        newFactKeys: []   // legacy field retained when loading older backups
      },
      curriculum: { unlockedTables: [] },
      history: {}, // date -> {attempts,correct,wrong,totalResponseMs}
      streak: 0,
      lastCompletedDate: null,
      streakRecovery: null, // {date, previousStreak, completedRounds}
      stickers: [], // {date, emoji}, one per completed day
      badges: [],   // earned streak milestones (7, 14, 30, ...)
      reward: {
        basis: "correctAnswers",
        earnedMilestones: [], // legacy reward history; retained for backup compatibility
        totalEarned: 0,
        availablePlays: 0,
        bestDinoScore: 0,
        bestFlappyScore: 0,
        bestTowerScore: 0
      }
    };
  }

  function correctAnswersForProfile(profile){
    var total = 0;
    var facts = profile.facts || {};
    for (var key in facts){
      total += Number(facts[key].correctCount) || 0;
      if (facts[key].division) total += Number(facts[key].division.correctCount) || 0;
    }
    return total;
  }

  function normalizeLearningRecord(record, today){
    record.box = Math.max(0, Math.min(MAX_BOX, Number(record.box) || 0));
    if (!record.dueDate) record.dueDate = today;
    record.seen = !!record.seen;
    record.correctCount = Math.max(0, Number(record.correctCount) || 0);
    record.wrongCount = Math.max(0, Number(record.wrongCount) || 0);
    if (typeof record.correctStreak !== 'number' || record.correctStreak < 0) record.correctStreak = 0;
    if (typeof record.totalResponseMs !== 'number' || record.totalResponseMs < 0) record.totalResponseMs = 0;
    if (typeof record.timedAttemptCount !== 'number' || record.timedAttemptCount < 0) record.timedAttemptCount = 0;
    if (!record.lastPracticedDate) record.lastPracticedDate = null;
  }

  function normalizeProfile(p){
    p.version = 2;
    if (!p.config) p.config = defaultProfile().config;
    if (p.config.sound === undefined) p.config.sound = true;
    if (!p.config.answerMode) p.config.answerMode = "choice";
    if (['choice','input','adaptive'].indexOf(p.config.answerMode) === -1) p.config.answerMode = 'choice';
    var min = parseInt(p.config.min, 10) || 1;
    var max = parseInt(p.config.max, 10) || 10;
    if (min > max){ var rangeTemp = min; min = max; max = rangeTemp; }
    p.config.min = Math.max(1, Math.min(20, min));
    p.config.max = Math.max(p.config.min, Math.min(20, max));
    var tables = Array.isArray(p.config.enabledTables) ? p.config.enabledTables : [];
    tables = tables.map(function(v){ return parseInt(v, 10); }).filter(function(v, i, arr){
      return v >= p.config.min && v <= p.config.max && arr.indexOf(v) === i;
    }).sort(function(a, b){ return a - b; });
    if (!tables.length){
      for (var table = p.config.min; table <= p.config.max; table++) tables.push(table);
    }
    p.config.enabledTables = tables;
    var newFactsPerRound = parseInt(p.config.newFactsPerRound, 10);
    if (!newFactsPerRound || newFactsPerRound < 1){
      newFactsPerRound = parseInt(p.config.newFactsPerDay, 10) || 2;
    }
    p.config.newFactsPerRound = Math.min(10, newFactsPerRound);
    // Keep the old field as a compatibility mirror for older backup readers.
    p.config.newFactsPerDay = p.config.newFactsPerRound;
    p.config.autoUnlockTables = !!p.config.autoUnlockTables;
    p.config.divisionEnabled = !!p.config.divisionEnabled;
    if (!ACCENT_THEMES[p.config.accentTheme]) p.config.accentTheme = 'purple';
    var rewardEvery = parseInt(p.config.rewardEvery, 10);
    if (!rewardEvery || rewardEvery < 1) rewardEvery = 10;
    p.config.rewardEvery = Math.min(100, rewardEvery);
    if (!p.facts) p.facts = {};
    var normalizationDate = todayStr();
    for (var factId in p.facts){
      var fact = p.facts[factId];
      normalizeLearningRecord(fact, normalizationDate);
      if (!fact.division || typeof fact.division !== 'object') fact.division = divisionDefaults(normalizationDate);
      normalizeLearningRecord(fact.division, normalizationDate);
      fact.division.unlocked = !!fact.division.unlocked || fact.box >= DIVISION_UNLOCK_BOX;
    }
    if (!p.today) p.today = defaultProfile().today;
    if (!p.today.requeueCounts) p.today.requeueCounts = {};
    if (!Array.isArray(p.today.newFactKeys)) p.today.newFactKeys = [];
    trimRepeatedQueueFacts(p.today);
    if (!p.curriculum) p.curriculum = { unlockedTables: [] };
    if (!Array.isArray(p.curriculum.unlockedTables)) p.curriculum.unlockedTables = [];
    p.curriculum.unlockedTables = p.curriculum.unlockedTables.filter(function(v){
      return tables.indexOf(v) !== -1;
    });
    if (p.config.autoUnlockTables && !p.curriculum.unlockedTables.length){
      p.curriculum.unlockedTables = [tables[0]];
    }
    if (!p.history) p.history = {};
    for (var historyDate in p.history){
      var historyDay = p.history[historyDate] || {};
      historyDay.attempts = Math.max(0, Number(historyDay.attempts) || 0);
      historyDay.correct = Math.max(0, Number(historyDay.correct) || 0);
      historyDay.wrong = Math.max(0, Number(historyDay.wrong) || 0);
      historyDay.totalResponseMs = Math.max(0, Number(historyDay.totalResponseMs) || 0);
      if (!historyDay.byOperation){
        historyDay.byOperation = {
          multiply:{
            attempts:historyDay.attempts, correct:historyDay.correct,
            wrong:historyDay.wrong, totalResponseMs:historyDay.totalResponseMs
          },
          divide:{ attempts:0, correct:0, wrong:0, totalResponseMs:0 }
        };
      }
      ['multiply','divide'].forEach(function(operation){
        var operationDay = historyDay.byOperation[operation] || {};
        operationDay.attempts = Math.max(0, Number(operationDay.attempts) || 0);
        operationDay.correct = Math.max(0, Number(operationDay.correct) || 0);
        operationDay.wrong = Math.max(0, Number(operationDay.wrong) || 0);
        operationDay.totalResponseMs = Math.max(0, Number(operationDay.totalResponseMs) || 0);
        historyDay.byOperation[operation] = operationDay;
      });
      p.history[historyDate] = historyDay;
    }
    if (!p.stickers) p.stickers = [];
    if (!p.badges) p.badges = [];
    if (p.streakRecovery){
      var recovery = p.streakRecovery;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recovery.date || '') ||
          !Number(recovery.previousStreak) || Number(recovery.previousStreak) < 1){
        p.streakRecovery = null;
      } else {
        recovery.previousStreak = Math.max(1, Number(recovery.previousStreak) || 1);
        recovery.completedRounds = recovery.completedRounds > 0 ? 1 : 0;
      }
    }
    var hadRewardData = !!p.reward;
    if (!p.reward){
      p.reward = { basis: "correctAnswers", earnedMilestones: [], totalEarned: 0, availablePlays: 0 };
    }
    p.reward.basis = "correctAnswers";
    if (!Array.isArray(p.reward.earnedMilestones)) p.reward.earnedMilestones = [];
    if (typeof p.reward.totalEarned !== 'number' || p.reward.totalEarned < 0){
      // Old reward data used irregular milestones (5, 10, 20, ...). Rebase
      // its accounting without removing any unspent games.
      p.reward.totalEarned = hadRewardData
        ? Math.floor(correctAnswersForProfile(p) / p.config.rewardEvery)
        : 0;
    }
    if (typeof p.reward.availablePlays !== 'number' || p.reward.availablePlays < 0){
      p.reward.availablePlays = 0;
    }
    if (typeof p.reward.bestDinoScore !== 'number' || p.reward.bestDinoScore < 0){
      p.reward.bestDinoScore = 0;
    }
    if (typeof p.reward.bestFlappyScore !== 'number' || p.reward.bestFlappyScore < 0){
      p.reward.bestFlappyScore = 0;
    }
    if (typeof p.reward.bestTowerScore !== 'number' || p.reward.bestTowerScore < 0){
      p.reward.bestTowerScore = 0;
    }
    return p;
  }

  function defaultRoot(){
    return {
      version: 2, pin: "6969", activeProfileId: "p1", lastBackupDate: null,
      profiles: { p1: defaultProfile() }
    };
  }

  function loadRoot(){
    try{
      var raw = localStorage.getItem(ROOT_KEY);
      if (raw){
        var parsed = JSON.parse(raw);
        if (parsed && parsed.profiles && parsed.activeProfileId && parsed.profiles[parsed.activeProfileId]){
          for (var id in parsed.profiles) normalizeProfile(parsed.profiles[id]);
          if (!parsed.pin) parsed.pin = "6969";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.lastBackupDate || '')) parsed.lastBackupDate = null;
          return parsed;
        }
      }
      // Migrate the old single-profile storage; the legacy key is left in
      // place as a backup and ignored from then on.
      var legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (legacyRaw){
        var legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.config && legacy.facts){
          normalizeProfile(legacy);
          return {
            version: 2,
            pin: legacy.config.pin || "6969",
            lastBackupDate: null,
            activeProfileId: "p1",
            profiles: { p1: legacy }
          };
        }
      }
    } catch(e){}
    return defaultRoot();
  }

  var root = loadRoot();
  var state = root.profiles[root.activeProfileId];

  function applyAccentTheme(themeName){
    var theme = ACCENT_THEMES[themeName] || ACCENT_THEMES.purple;
    var style = document.documentElement.style;
    style.setProperty('--bg-1', theme.primary);
    style.setProperty('--bg-2', theme.secondary);
    style.setProperty('--accent', theme.accent);
    style.setProperty('--theme-soft', theme.soft);
    style.setProperty('--theme-border', theme.border);
    style.setProperty('--theme-surface', theme.surface);
    style.setProperty('--primary-shadow', theme.shadow);
    var themeMeta = document.querySelector('meta[name=theme-color]');
    if (themeMeta) themeMeta.setAttribute('content', theme.primary);
  }

  function saveState(){
    localStorage.setItem(ROOT_KEY, JSON.stringify(root));
  }

  function setActiveProfile(id){
    root.activeProfileId = id;
    state = root.profiles[id];
    ensureFactPool();
    applyAccentTheme(state.config.accentTheme);
    saveState();
  }

  function ensureFactPool(){
    var cfg = state.config;
    var today = todayStr();
    for (var a = cfg.min; a <= cfg.max; a++){
      for (var b = a; b <= cfg.max; b++){
        var key = factKey(a, b);
        if (!state.facts[key]){
          state.facts[key] = {
            a:a, b:b, box:0, dueDate:today, seen:false,
            correctCount:0, wrongCount:0, correctStreak:0,
            totalResponseMs:0, timedAttemptCount:0, lastPracticedDate:null,
            division:divisionDefaults(today)
          };
        } else if (!state.facts[key].division){
          state.facts[key].division = divisionDefaults(today);
        }
        if (state.facts[key].box >= DIVISION_UNLOCK_BOX) state.facts[key].division.unlocked = true;
      }
    }
  }

  function configuredTables(){
    return state.config.enabledTables.slice().sort(function(a, b){ return a - b; });
  }

  function activeTables(){
    var planned = configuredTables();
    if (!state.config.autoUnlockTables) return planned;
    var unlocked = state.curriculum.unlockedTables.filter(function(v){ return planned.indexOf(v) !== -1; });
    return unlocked.length ? unlocked : [planned[0]];
  }

  function factTouchesTables(f, tables){
    return tables.indexOf(f.a) !== -1 || tables.indexOf(f.b) !== -1;
  }

  function factUsesOnlyTables(f, tables){
    return tables.indexOf(f.a) !== -1 && tables.indexOf(f.b) !== -1;
  }

  function factsInRange(){
    var cfg = state.config;
    var planned = configuredTables();
    var active = activeTables();
    var list = [];
    for (var key in state.facts){
      var f = state.facts[key];
      if (f.a >= cfg.min && f.a <= cfg.max && f.b >= cfg.min && f.b <= cfg.max &&
          f.b >= f.a && factUsesOnlyTables(f, planned) && factTouchesTables(f, active)){
        list.push(f);
      }
    }
    return list;
  }

  function practiceSkill(key){
    if (typeof key !== 'string') return null;
    var isDivision = key.indexOf('d:') === 0;
    var baseKey = isDivision ? key.slice(2) : key;
    var fact = state.facts[baseKey];
    if (!fact) return null;
    return {
      key:isDivision ? divisionSkillKey(fact.a, fact.b) : baseKey,
      operation:isDivision ? 'divide' : 'multiply',
      fact:fact,
      record:isDivision ? fact.division : fact
    };
  }

  function practiceSkillsInRange(){
    var skills = [];
    factsInRange().forEach(function(fact){
      skills.push(practiceSkill(factKey(fact.a, fact.b)));
      if (state.config.divisionEnabled && fact.division && fact.division.unlocked){
        skills.push(practiceSkill(divisionSkillKey(fact.a, fact.b)));
      }
    });
    return skills;
  }

  function selectDueReviews(due, size, today){
    if (size <= 0) return [];
    due.sort(function(x, y){
      if (x.record.box !== y.record.box) return x.record.box - y.record.box;
      return x.record.dueDate < y.record.dueDate ? -1 : (x.record.dueDate > y.record.dueDate ? 1 : 0);
    });

    var reserved = null;
    if (size > 1 && due.length){
      var weakestDueBox = due[0].record.box;
      var overdueHigher = due.filter(function(f){
        return f.record.box > weakestDueBox && f.record.dueDate < today;
      });
      overdueHigher.sort(function(x, y){
        return x.record.dueDate < y.record.dueDate ? -1 : (x.record.dueDate > y.record.dueDate ? 1 : 0);
      });
      if (overdueHigher.length) reserved = overdueHigher[0];
    }

    var result = due.filter(function(f){ return f !== reserved; }).slice(0, reserved ? size - 1 : size);
    if (reserved) result.push(reserved);
    return result;
  }

  function buildQueue(size){
    var today = todayStr();
    var pool = shuffle(practiceSkillsInRange());
    var newLimit = Math.min(size, state.config.newFactsPerRound);
    var dueReviews = pool.filter(function(skill){ return skill.record.seen && skill.record.dueDate <= today; });
    var newCandidates = pool.filter(function(skill){ return !skill.record.seen; });

    // When division is enabled, every round with eligible division facts gets
    // one division slot. Prefer a due review, then a new division, and only
    // bring a future review forward when neither is available.
    var reservedDivision = null;
    if (state.config.divisionEnabled && size > 0){
      reservedDivision = dueReviews.filter(function(skill){ return skill.operation === 'divide'; })[0] ||
        newCandidates.filter(function(skill){ return skill.operation === 'divide'; })[0] || null;
      if (!reservedDivision){
        var futureDivisions = pool.filter(function(skill){
          return skill.operation === 'divide' && skill.record.seen && skill.record.dueDate > today;
        }).sort(function(x, y){
          return x.record.dueDate < y.record.dueDate ? -1 : (x.record.dueDate > y.record.dueDate ? 1 : 0);
        });
        reservedDivision = futureDivisions[0] || null;
      }
    }

    var reservedIsNew = reservedDivision && !reservedDivision.record.seen;
    var remainingNewLimit = Math.max(0, newLimit - (reservedIsNew ? 1 : 0));
    newCandidates = newCandidates.filter(function(skill){ return skill !== reservedDivision; });
    dueReviews = dueReviews.filter(function(skill){ return skill !== reservedDivision; });
    var plannedNew = Math.min(remainingNewLimit, newCandidates.length);
    var reviewSlots = Math.max(0, size - (reservedDivision ? 1 : 0) - plannedNew);
    var chosen = reservedDivision ? [reservedDivision] : [];
    chosen = chosen.concat(selectDueReviews(dueReviews, reviewSlots, today));

    var needNew = Math.min(remainingNewLimit, size - chosen.length);
    var selectedNewFacts = newCandidates.slice(0, needNew);
    chosen = chosen.concat(selectedNewFacts);
    var newFacts = selectedNewFacts.slice();
    if (reservedIsNew) newFacts.unshift(reservedDivision);

    if (chosen.length < size){
      var remainingDue = dueReviews.filter(function(f){ return chosen.indexOf(f) === -1; });
      chosen = chosen.concat(selectDueReviews(remainingDue, size - chosen.length, today));
    }
    if (chosen.length < size){
      var rest = pool.filter(function(skill){
        return skill.record.seen && skill.record.dueDate > today && chosen.indexOf(skill) === -1;
      });
      rest.sort(function(x, y){
        return x.record.dueDate < y.record.dueDate ? -1 : (x.record.dueDate > y.record.dueDate ? 1 : 0);
      });
      var need = size - chosen.length;
      chosen = chosen.concat(rest.slice(0, need));
    }
    // Newly introduced facts may appear once more for reinforcement, but a
    // single eligible fact must never fill most of the session by itself.
    var repeatable = newFacts.length ? newFacts.slice() : pool.slice();
    var occurrenceCounts = {};
    chosen.forEach(function(skill){
      var key = skill.key;
      occurrenceCounts[key] = (occurrenceCounts[key] || 0) + 1;
    });
    shuffle(repeatable);
    repeatable.forEach(function(skill){
      if (chosen.length >= size) return;
      var key = skill.key;
      if ((occurrenceCounts[key] || 0) < 2){
        chosen.push(skill);
        occurrenceCounts[key] = (occurrenceCounts[key] || 0) + 1;
      }
    });
    var queueKeys = chosen.map(function(skill){ return skill.key; });
    return spreadQueueKeys(queueKeys);
  }

  function enqueueRetry(key){
    var queue = state.today.queue;
    var earliest = Math.min(queue.length, state.today.index + 2);
    for (var position = queue.length; position >= earliest; position--){
      if (queue[position - 1] !== key && queue[position] !== key){
        queue.splice(position, 0, key);
        return;
      }
    }
    queue.push(key);
  }

  function stickerStreakEndingOn(date){
    var dates = {};
    (state.stickers || []).forEach(function(sticker){ dates[sticker.date] = true; });
    var count = 0;
    var cursor = date;
    while (dates[cursor]){
      count++;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  function prepareStreakForDay(today){
    if (state.streakRecovery && state.streakRecovery.date !== today){
      var recoveryDayCompleted = state.streakRecovery.completedRounds > 0 &&
        state.lastCompletedDate === state.streakRecovery.date;
      state.streakRecovery = null;
      state.streak = recoveryDayCompleted ? 1 : 0;
    }
    if (!state.lastCompletedDate) return;
    var gap = daysBetween(state.lastCompletedDate, today);
    if (gap === 2){
      var previousStreak = Math.max(Number(state.streak) || 0,
        stickerStreakEndingOn(state.lastCompletedDate));
      if (previousStreak > 0){
        state.streak = previousStreak;
        state.streakRecovery = {
          date:today,
          previousStreak:previousStreak,
          completedRounds:0
        };
      } else {
        state.streak = 0;
      }
    } else if (gap > 2){
      state.streakRecovery = null;
      state.streak = 0;
    }
  }

  function completeRegularStreak(today){
    var recovery = state.streakRecovery;
    if (recovery && recovery.date === today){
      recovery.completedRounds = 1;
      state.lastCompletedDate = today;
      return;
    }
    if (state.lastCompletedDate){
      var gap = daysBetween(state.lastCompletedDate, today);
      if (gap === 1) state.streak++;
      else if (gap !== 0) state.streak = 1;
    } else {
      state.streak = 1;
    }
    state.lastCompletedDate = today;
  }

  function completeStreakRecovery(today){
    var recovery = state.streakRecovery;
    if (!recovery || recovery.date !== today || recovery.completedRounds < 1) return false;
    state.streak = recovery.previousStreak + 2;
    state.streakRecovery = null;
    return true;
  }

  function refreshDailySessionIfNeeded(){
    ensureFactPool();
    var today = todayStr();
    if (state.today.date !== today){
      prepareStreakForDay(today);
      state.today = {
        date: today,
        queue: [],
        index: 0,
        correct: 0,
        completed: false,
        bonus: false,
        requeueCounts: {},
        newFactKeys: []
      };
      state.today.queue = buildQueue(state.config.tasksPerDay);
      saveState();
    } else if (!state.today.queue || state.today.queue.length === 0){
      state.today.queue = buildQueue(state.config.tasksPerDay);
      saveState();
    } else if (state.today.index === 0 && state.config.divisionEnabled &&
               state.today.queue.every(function(key){ return key.indexOf('d:') !== 0; }) &&
               practiceSkillsInRange().some(function(skill){ return skill.operation === 'divide'; })){
      // Repair a not-yet-started queue created by older versions that could
      // omit division even though eligible facts existed.
      state.today.queue = buildQueue(state.config.tasksPerDay);
      saveState();
    }
  }

  // Updates the selected operation and reports mastery/unlock transitions.
  function applyAnswerResult(key, isCorrect, elapsedMs, learningElapsedMs){
    var skill = practiceSkill(key);
    if (!skill) return { mastered:false, divisionUnlocked:false };
    var f = skill.record;
    if (learningElapsedMs === undefined) learningElapsedMs = elapsedMs;
    f.seen = true;
    var today = todayStr();
    var wasMastered = f.box >= MAX_BOX - 1;
    f.lastPracticedDate = today;
    f.totalResponseMs = (Number(f.totalResponseMs) || 0) + elapsedMs;
    f.timedAttemptCount = (Number(f.timedAttemptCount) || 0) + 1;
    var day = state.history[today] || { attempts:0, correct:0, wrong:0, totalResponseMs:0 };
    if (!day.byOperation){
      day.byOperation = {
        multiply:{ attempts:0, correct:0, wrong:0, totalResponseMs:0 },
        divide:{ attempts:0, correct:0, wrong:0, totalResponseMs:0 }
      };
    }
    var operationDay = day.byOperation[skill.operation] || { attempts:0, correct:0, wrong:0, totalResponseMs:0 };
    day.attempts++;
    day.totalResponseMs += elapsedMs;
    operationDay.attempts++;
    operationDay.totalResponseMs += elapsedMs;
    if (isCorrect){
      f.correctCount++;
      f.correctStreak = (Number(f.correctStreak) || 0) + 1;
      day.correct++;
      operationDay.correct++;
      var jump = 1;
      if (learningElapsedMs <= FAST_MS) jump = 2;
      else if (learningElapsedMs >= SLOW_MS) jump = 0;
      // A fact advances only after two correct recalls in a row. This avoids
      // treating a single lucky multiple-choice answer as durable knowledge.
      if (f.correctStreak >= 2 && jump > 0){
        f.box = Math.min(MAX_BOX, f.box + jump);
        f.correctStreak = 0;
      }
    } else {
      f.wrongCount++;
      f.correctStreak = 0;
      day.wrong++;
      operationDay.wrong++;
      f.box = Math.max(0, f.box - 2);
    }
    day.byOperation[skill.operation] = operationDay;
    state.history[today] = day;
    f.dueDate = addDays(today, INTERVALS[f.box]);
    var divisionUnlocked = false;
    if (skill.operation === 'multiply' && skill.fact.box >= DIVISION_UNLOCK_BOX && !skill.fact.division.unlocked){
      skill.fact.division.unlocked = true;
      divisionUnlocked = true;
    }
    return {
      mastered:isCorrect && !wasMastered && f.box >= MAX_BOX - 1,
      divisionUnlocked:divisionUnlocked
    };
  }

  function factsForTable(table){
    var cfg = state.config;
    var planned = configuredTables();
    var list = [];
    for (var key in state.facts){
      var f = state.facts[key];
      if (f.a >= cfg.min && f.b <= cfg.max && factUsesOnlyTables(f, planned) &&
          (f.a === table || f.b === table)) list.push(f);
    }
    return list;
  }

  // Returns the newly unlocked table number, or null when the plan stays put.
  function maybeUnlockNextTable(){
    if (!state.config.autoUnlockTables) return null;
    var planned = configuredTables();
    var unlocked = state.curriculum.unlockedTables;
    var current = unlocked[unlocked.length - 1];
    var currentIndex = planned.indexOf(current);
    if (currentIndex < 0 || currentIndex >= planned.length - 1) return null;
    var facts = factsForTable(current);
    if (!facts.length) return null;
    var ready = facts.filter(function(f){ return f.seen && f.box >= 2; }).length;
    if (ready / facts.length < 0.8) return null;
    var next = planned[currentIndex + 1];
    if (unlocked.indexOf(next) === -1) unlocked.push(next);
    return next;
  }

  function totalCorrectAnswers(){
    return correctAnswersForProfile(state);
  }

  function nextRewardMilestone(count){
    var interval = state.config.rewardEvery;
    return (Math.floor(count / interval) + 1) * interval;
  }

  // Returns the number of newly earned game sessions.
  function syncRewardMilestones(){
    var reward = state.reward;
    var eligibleGames = Math.floor(totalCorrectAnswers() / state.config.rewardEvery);
    var earnedNow = Math.max(0, eligibleGames - reward.totalEarned);
    if (earnedNow){
      reward.totalEarned = eligibleGames;
      reward.availablePlays += earnedNow;
    }
    return earnedNow;
  }

  function genChoices(a, b){
    var correct = a * b;
    var candidates = new Set();
    var raw = [
      a * (b + 1), a * Math.max(1, b - 1),
      (a + 1) * b, Math.max(1, a - 1) * b,
      a + b, correct + a, correct - a, correct + b, correct - b,
      correct + 10, correct - 10
    ];
    raw.forEach(function(v){
      if (v > 0 && v !== correct) candidates.add(v);
    });
    var pool = shuffle(Array.from(candidates));
    var distractors = [];
    var i = 0;
    while (distractors.length < 3){
      if (i < pool.length){
        if (distractors.indexOf(pool[i]) === -1) distractors.push(pool[i]);
        i++;
      } else {
        var delta = Math.floor(Math.random() * 12) + 1;
        var sign = Math.random() < 0.5 ? -1 : 1;
        var candidate = correct + sign * delta;
        if (candidate > 0 && candidate !== correct && distractors.indexOf(candidate) === -1){
          distractors.push(candidate);
        }
      }
    }
    var options = distractors.concat([correct]);
    shuffle(options);
    return { correct: correct, options: options };
  }

  // Choices for "shown × ▢ = product" tasks: the answer is the hidden factor.
  function genFactorChoices(shown, hidden){
    var correct = hidden;
    var factorMax = Math.max(4, state.config.max);
    var candidates = new Set();
    [hidden - 1, hidden + 1, hidden - 2, hidden + 2, hidden - 3, hidden + 3, shown].forEach(function(v){
      if (v >= 1 && v <= factorMax && v !== correct) candidates.add(v);
    });
    var distractors = shuffle(Array.from(candidates)).slice(0, 3);
    while (distractors.length < 3){
      var c = Math.floor(Math.random() * factorMax) + 1;
      if (c !== correct && distractors.indexOf(c) === -1) distractors.push(c);
    }
    var options = distractors.concat([correct]);
    shuffle(options);
    return { correct: correct, options: options };
  }

  function genDivisionChoices(correct){
    var factorMax = Math.max(4, state.config.max);
    var candidates = new Set();
    [correct - 1, correct + 1, correct - 2, correct + 2, correct - 3, correct + 3].forEach(function(v){
      if (v >= 1 && v <= factorMax && v !== correct) candidates.add(v);
    });
    var distractors = shuffle(Array.from(candidates)).slice(0, 3);
    while (distractors.length < 3){
      var candidate = Math.floor(Math.random() * factorMax) + 1;
      if (candidate !== correct && distractors.indexOf(candidate) === -1) distractors.push(candidate);
    }
    var options = distractors.concat([correct]);
    shuffle(options);
    return { correct:correct, options:options };
  }

  // ---------- Confetti ----------
  var CONFETTI_COLORS = ['#6c5ce7','#fdcb6e','#00b894','#e17055','#0984e3','#e84393'];
  function launchConfetti(){
    var layer = document.createElement('div');
    layer.className = 'confetti-layer';
    for (var i = 0; i < 60; i++){
      var p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      p.style.transform = 'rotateZ(' + Math.floor(Math.random() * 360) + 'deg)';
      p.style.width = (6 + Math.random() * 8) + 'px';
      p.style.height = (10 + Math.random() * 8) + 'px';
      p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
      p.style.animationDelay = (Math.random() * 0.7) + 's';
      if (Math.random() < 0.4) p.style.borderRadius = '50%';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function(){ layer.remove(); }, 5000);
  }

  // ---------- Sound ----------
  var audioCtx = null;
  function getAudioCtx(){
    if (state.config.sound === false) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    // iOS suspends the context until a user gesture; all play calls happen
    // inside click handlers, so resuming here is enough.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(ctx, freq, startAt, duration, type, gainVal){
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainVal || 0.18, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  }
  function playCorrectSound(){
    var ctx = getAudioCtx(); if (!ctx) return;
    var t = ctx.currentTime;
    tone(ctx, 660, t, 0.12);
    tone(ctx, 880, t + 0.12, 0.18);
  }
  function playWrongSound(){
    var ctx = getAudioCtx(); if (!ctx) return;
    var t = ctx.currentTime;
    tone(ctx, 220, t, 0.25, 'triangle', 0.12);
    tone(ctx, 180, t + 0.1, 0.3, 'triangle', 0.12);
  }
  function playFanfareSound(){
    var ctx = getAudioCtx(); if (!ctx) return;
    var t = ctx.currentTime;
    [523, 659, 784, 1047].forEach(function(f, i){
      tone(ctx, f, t + i * 0.13, 0.22, 'sine', 0.16);
    });
  }

  // ---------- DOM refs ----------
  var screenHome = document.getElementById('screen-home');
  var screenQuestion = document.getElementById('screen-question');
  var screenDone = document.getElementById('screen-done');

  var homeGreeting = document.getElementById('homeGreeting');
  var homeSubtitle = document.getElementById('homeSubtitle');
  var streakVal = document.getElementById('streakVal');
  var todayVal = document.getElementById('todayVal');
  var startBtn = document.getElementById('startBtn');
  var bonusBtn = document.getElementById('bonusBtn');
  var rewardBtn = document.getElementById('rewardBtn');
  var rewardNote = document.getElementById('rewardNote');

  var progressDots = document.getElementById('progressDots');
  var questionText = document.getElementById('questionText');
  var choicesWrap = document.getElementById('choicesWrap');
  var feedbackText = document.getElementById('feedbackText');

  var doneSubtitle = document.getElementById('doneSubtitle');
  var doneStreakVal = document.getElementById('doneStreakVal');
  var doneCorrectVal = document.getElementById('doneCorrectVal');
  var doneBonusBtn = document.getElementById('doneBonusBtn');
  var doneHomeBtn = document.getElementById('doneHomeBtn');
  var doneReward = document.getElementById('doneReward');
  var doneRewardGameBtn = document.getElementById('doneRewardGameBtn');

  var screenStickers = document.getElementById('screen-stickers');
  var stickersBtn = document.getElementById('stickersBtn');
  var stickersBackBtn = document.getElementById('stickersBackBtn');
  var stickerCountLine = document.getElementById('stickerCountLine');
  var badgeRow = document.getElementById('badgeRow');
  var stickerGrid = document.getElementById('stickerGrid');

  var screenGame = document.getElementById('screen-game');
  var screenGameChoice = document.getElementById('screen-game-choice');
  var chooseDinoBtn = document.getElementById('chooseDinoBtn');
  var chooseFlappyBtn = document.getElementById('chooseFlappyBtn');
  var chooseTowerBtn = document.getElementById('chooseTowerBtn');
  var gameChoiceBackBtn = document.getElementById('gameChoiceBackBtn');
  var gameWrap = document.getElementById('gameWrap');
  var gameCanvas = document.getElementById('gameCanvas');
  var gameCtx = gameCanvas.getContext('2d');
  var gameTime = document.getElementById('gameTime');
  var gameAttempts = document.getElementById('gameAttempts');
  var gameScore = document.getElementById('gameScore');
  var gameLevel = document.getElementById('gameLevel');
  var gameStars = document.getElementById('gameStars');
  var gameCombo = document.getElementById('gameCombo');
  var gameOverlay = document.getElementById('gameOverlay');
  var gameOverlayTitle = document.getElementById('gameOverlayTitle');
  var gameOverlayText = document.getElementById('gameOverlayText');
  var gameAgainBtn = document.getElementById('gameAgainBtn');
  var gameHomeBtn = document.getElementById('gameHomeBtn');

  var screenFlappy = document.getElementById('screen-flappy');
  var flappyWrap = document.getElementById('flappyWrap');
  var flappyCanvas = document.getElementById('flappyCanvas');
  var flappyCtx = flappyCanvas.getContext('2d');
  var flappyTime = document.getElementById('flappyTime');
  var flappyAttempts = document.getElementById('flappyAttempts');
  var flappyScore = document.getElementById('flappyScore');
  var flappyBest = document.getElementById('flappyBest');
  var flappyOverlay = document.getElementById('flappyOverlay');
  var flappyOverlayTitle = document.getElementById('flappyOverlayTitle');
  var flappyOverlayText = document.getElementById('flappyOverlayText');
  var flappyAgainBtn = document.getElementById('flappyAgainBtn');
  var flappyHomeBtn = document.getElementById('flappyHomeBtn');

  var screenTower = document.getElementById('screen-tower');
  var towerWrap = document.getElementById('towerWrap');
  var towerCanvas = document.getElementById('towerCanvas');
  var towerCtx = towerCanvas.getContext('2d');
  var towerTime = document.getElementById('towerTime');
  var towerAttempts = document.getElementById('towerAttempts');
  var towerScore = document.getElementById('towerScore');
  var towerBest = document.getElementById('towerBest');
  var towerOverlay = document.getElementById('towerOverlay');
  var towerOverlayTitle = document.getElementById('towerOverlayTitle');
  var towerOverlayText = document.getElementById('towerOverlayText');
  var towerAgainBtn = document.getElementById('towerAgainBtn');
  var towerHomeBtn = document.getElementById('towerHomeBtn');

  var gearBtn = document.getElementById('gearBtn');
  var profileBtn = document.getElementById('profileBtn');
  var profileOverlay = document.getElementById('profileOverlay');
  var profileClose = document.getElementById('profileClose');
  var profileList = document.getElementById('profileList');
  var adminProfileList = document.getElementById('adminProfileList');
  var newProfileNameInput = document.getElementById('newProfileName');
  var addProfileBtn = document.getElementById('addProfileBtn');
  var adminOverlay = document.getElementById('adminOverlay');
  var closeAdmin = document.getElementById('closeAdmin');
  var adminTabs = Array.from(adminOverlay.querySelectorAll('[role=tab]'));
  var adminTabPanels = Array.from(adminOverlay.querySelectorAll('[role=tabpanel]'));
  var adminSaveActions = document.getElementById('adminSaveActions');
  var pinOverlay = document.getElementById('pinOverlay');
  var pinModal = pinOverlay.querySelector('.pin-modal');
  var pinInput = document.getElementById('pinInput');
  var pinError = document.getElementById('pinError');
  var pinSubmit = document.getElementById('pinSubmit');
  var pinClose = document.getElementById('pinClose');
  var childNameInput = document.getElementById('childName');
  var accentThemeSel = document.getElementById('accentTheme');
  var rangeMinSel = document.getElementById('rangeMin');
  var rangeMaxSel = document.getElementById('rangeMax');
  var tableChoices = document.getElementById('tableChoices');
  var tasksPerDayInput = document.getElementById('tasksPerDay');
  var newFactsPerRoundInput = document.getElementById('newFactsPerRound');
  var autoUnlockTablesToggle = document.getElementById('autoUnlockTables');
  var unlockStatus = document.getElementById('unlockStatus');
  var rewardEveryInput = document.getElementById('rewardEvery');
  var soundToggle = document.getElementById('soundToggle');
  var answerModeSel = document.getElementById('answerMode');
  var gapToggle = document.getElementById('gapToggle');
  var divisionToggle = document.getElementById('divisionToggle');
  var newPinInput = document.getElementById('newPin');
  var exportBtn = document.getElementById('exportBtn');
  var importBtn = document.getElementById('importBtn');
  var importFile = document.getElementById('importFile');
  var saveAdminBtn = document.getElementById('saveAdmin');
  var resetProgressBtn = document.getElementById('resetProgress');
  var progressGrid = document.getElementById('progressGrid');
  var learningSummary = document.getElementById('learningSummary');
  var historySummary = document.getElementById('historySummary');
  var troubleList = document.getElementById('troubleList');
  var factDetail = document.getElementById('factDetail');
  var backupReminder = document.getElementById('backupReminder');
  var operationSwitch = document.getElementById('operationSwitch');
  var dashboardOperation = 'multiply';

  var questionStartTime = 0;
  var answering = false;
  var sessionRewardUnlocks = 0;
  var rewardGameChoiceOrigin = null;

  function showScreen(el){
    [screenHome, screenQuestion, screenDone, screenStickers, screenGameChoice, screenGame, screenFlappy, screenTower].forEach(function(s){ s.classList.remove('active'); });
    el.classList.add('active');
    var gameOpen = el === screenGameChoice || el === screenGame || el === screenFlappy || el === screenTower;
    gearBtn.style.display = gameOpen ? 'none' : '';
    if (gameOpen) profileBtn.style.display = 'none';
    window.scrollTo(0, 0);
  }

  function renderStickers(){
    var stickers = state.stickers || [];
    stickerCountLine.textContent = stickers.length === 0
      ? "Übe jeden Tag und sammle Sticker!"
      : "Schon " + stickers.length + " Sticker gesammelt!";
    badgeRow.innerHTML = '';
    var badges = state.badges || [];
    BADGE_MILESTONES.forEach(function(m){
      var got = badges.indexOf(m) !== -1;
      var span = document.createElement('span');
      span.className = 'badge' + (got ? '' : ' locked');
      span.textContent = (got ? '🏅 ' : '🔒 ') + m + ' Tage';
      badgeRow.appendChild(span);
    });
    stickerGrid.innerHTML = '';
    if (stickers.length === 0){
      var empty = document.createElement('div');
      empty.className = 'sticker-empty';
      empty.textContent = 'Noch keine Sticker — für jeden geübten Tag gibt es einen! 💪';
      empty.style.gridColumn = '1 / -1';
      stickerGrid.appendChild(empty);
    }
    stickers.forEach(function(s){
      var d = document.createElement('div');
      d.className = 'sticker';
      d.title = s.date;
      d.textContent = s.emoji;
      stickerGrid.appendChild(d);
    });
    showScreen(screenStickers);
  }

  function renderHome(){
    // Restore the active profile's colors after leaving a reward game and
    // release the previously tapped button. Mobile Safari can otherwise keep
    // a native focus/active tint when the hidden game screen is replaced.
    applyAccentTheme(state.config.accentTheme);
    if (document.activeElement && typeof document.activeElement.blur === 'function'){
      document.activeElement.blur();
    }
    refreshDailySessionIfNeeded();
    var newlyGranted = syncRewardMilestones();
    if (newlyGranted) saveState();
    var name = state.config.childName;
    var recoveryPending = state.streakRecovery && state.streakRecovery.date === state.today.date;
    homeGreeting.textContent = name ? ("Hallo, " + name + "! 👋") : "1×1 Trainer";
    var profileIds = Object.keys(root.profiles);
    if (profileIds.length > 1){
      profileBtn.style.display = 'block';
      profileBtn.textContent = '👤 ' + (name || 'Profil');
    } else {
      profileBtn.style.display = 'none';
    }
    homeSubtitle.textContent = recoveryPending
      ? "Heute kannst du deine Serie mit zwei Runden retten! 🔥"
      : (state.config.divisionEnabled ? "Übe Mal- und Geteiltaufgaben!" : "Übe dein kleines Einmaleins!");
    streakVal.textContent = state.streak;
    var doneCount = state.today.completed ? state.config.tasksPerDay : state.today.index;
    todayVal.textContent = Math.min(doneCount, state.config.tasksPerDay) + "/" + state.config.tasksPerDay;
    var availablePlays = state.reward.availablePlays;
    rewardBtn.style.display = availablePlays > 0 ? 'block' : 'none';
    rewardBtn.textContent = availablePlays === 1
      ? "Belohnungsspiel wählen 🎮"
      : "Belohnungsspiel wählen 🎮 (" + availablePlays + ")";
    var correctAnswers = totalCorrectAnswers();
    var nextMilestone = nextRewardMilestone(correctAnswers);
    var remainingAnswers = nextMilestone - correctAnswers;
    var remainingText = "noch " + remainingAnswers + " richtige" +
      (remainingAnswers === 1 ? " Antwort" : " Antworten") + " bis zum nächsten Belohnungsspiel";
    rewardNote.textContent = availablePlays > 0
      ? availablePlays + (availablePlays === 1 ? " Spiel bereit" : " Spiele bereit") +
        " · " + remainingText
      : remainingText.charAt(0).toUpperCase() + remainingText.slice(1);

    if (state.today.completed){
      startBtn.style.display = 'none';
      bonusBtn.style.display = 'block';
      bonusBtn.textContent = recoveryPending ? "Serie retten: zweite Runde 🔥" : "Bonus-Runde spielen ⭐";
    } else {
      startBtn.style.display = 'block';
      bonusBtn.style.display = 'none';
      startBtn.textContent = state.today.index > 0
        ? "Weiter üben! 🚀"
        : (recoveryPending ? "Erste Rettungsrunde starten 🔥" : "Los geht's! 🚀");
    }
    showScreen(screenHome);
  }

  function startSession(bonus){
    sessionRewardUnlocks = 0;
    if (bonus){
      state.today.queue = buildQueue(state.config.tasksPerDay);
      state.today.index = 0;
      state.today.correct = 0;
      state.today.bonus = true;
      state.today.requeueCounts = {};
      saveState();
    }
    showScreen(screenQuestion);
    renderQuestion();
  }

  function renderProgressDots(){
    progressDots.innerHTML = '';
    var total = state.today.queue.length;
    for (var i = 0; i < total; i++){
      var d = document.createElement('div');
      d.className = 'dot' + (i < state.today.index ? ' done' : (i === state.today.index ? ' current' : ''));
      progressDots.appendChild(d);
    }
  }

  function renderQuestion(){
    if (state.today.index >= state.today.queue.length){
      finishSession();
      return;
    }
    answering = true;
    renderProgressDots();
    var key = state.today.queue[state.today.index];
    var skill = practiceSkill(key);
    if (!skill){
      state.today.index++;
      saveState();
      renderQuestion();
      return;
    }
    var f = skill.fact;
    var gapTask = false;
    var gen, fmt, placeholder;
    if (skill.operation === 'divide'){
      var divideByA = f.a === f.b || Math.random() < 0.5;
      var divisor = divideByA ? f.a : f.b;
      var quotient = divideByA ? f.b : f.a;
      var dividend = f.a * f.b;
      gen = genDivisionChoices(quotient);
      fmt = function(val){ return dividend + " ÷ " + divisor + " = " + val; };
      placeholder = "?";
      questionText.textContent = dividend + " ÷ " + divisor;
    } else {
      // Facts are stored with a <= b; show both orders so 3×8 and 8×3 get practiced.
      var swapFactors = Math.random() < 0.5;
      var fx = swapFactors ? f.b : f.a;
      var fy = swapFactors ? f.a : f.b;
      // Gap tasks remain multiplication-only.
      gapTask = state.config.gapTasks && Math.random() < 0.34;
      if (gapTask){
        gen = genFactorChoices(fx, fy);
        fmt = function(val){ return fx + " × " + val + " = " + (fx * fy); };
        placeholder = "▢";
      } else {
        gen = genChoices(fx, fy);
        fmt = function(val){ return fx + " × " + fy + " = " + val; };
        placeholder = "?";
      }
      questionText.textContent = gapTask ? fmt(placeholder) : (fx + " × " + fy);
    }
    feedbackText.textContent = '';
    feedbackText.className = 'feedback';
    awaitTap = false;

    choicesWrap.innerHTML = '';
    var answerMode = state.config.answerMode;
    if (answerMode === 'adaptive') answerMode = skill.record.seen && skill.record.box >= 2 ? 'input' : 'choice';
    if (answerMode === 'input'){
      renderKeypad(key, fmt, gen.correct, placeholder, fmt(gen.correct));
    } else {
      choicesWrap.classList.remove('keypad');
      gen.options.forEach(function(opt){
        var btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = opt;
        btn.addEventListener('click', function(){
          if (answering && gapTask) questionText.textContent = fmt(gen.correct);
          onAnswer(key, opt, gen.correct, btn, false, fmt(gen.correct));
        });
        choicesWrap.appendChild(btn);
      });
    }

    questionStartTime = Date.now();
  }

  function renderKeypad(key, fmt, correct, placeholder, masteryLabel){
    var typedAnswer = '';
    function updateEquation(){
      questionText.textContent = fmt(typedAnswer === '' ? placeholder : typedAnswer);
    }
    updateEquation();
    choicesWrap.classList.add('keypad');
    var layout = ['1','2','3','4','5','6','7','8','9','del','0','ok'];
    layout.forEach(function(k){
      var btn = document.createElement('button');
      btn.className = 'key-btn' + (k === 'ok' ? ' key-ok' : '');
      btn.textContent = k === 'del' ? '⌫' : (k === 'ok' ? 'OK' : k);
      btn.addEventListener('click', function(){
        if (!answering) return;
        if (k === 'del'){
          typedAnswer = typedAnswer.slice(0, -1);
        } else if (k === 'ok'){
          if (typedAnswer === '') return;
          var chosen = parseInt(typedAnswer, 10);
          questionText.textContent = fmt(correct);
          onAnswer(key, chosen, correct, null, true, masteryLabel);
          return;
        } else if (typedAnswer.length < 3){
          typedAnswer += k;
        }
        updateEquation();
      });
      choicesWrap.appendChild(btn);
    });
  }

  function onAnswer(key, chosen, correct, btnEl, wasTyped, masteryLabel){
    if (!answering) return;
    answering = false;
    var elapsed = Date.now() - questionStartTime;
    var learningElapsed = wasTyped ? Math.max(0, elapsed - INPUT_TIME_COMPENSATION_MS) : elapsed;
    var isCorrect = chosen === correct;

    choicesWrap.querySelectorAll('.choice-btn').forEach(function(b){
      b.classList.add('locked');
      if (parseInt(b.textContent, 10) === correct) b.classList.add('correct');
      else if (b === btnEl) b.classList.add('wrong');
    });
    choicesWrap.querySelectorAll('.key-btn').forEach(function(b){ b.classList.add('locked'); });

    var answerResult = applyAnswerResult(key, isCorrect, elapsed, learningElapsed);
    var newlyMastered = answerResult.mastered;

    if (isCorrect){
      state.today.correct++;
      var newGameRewards = syncRewardMilestones();
      sessionRewardUnlocks += newGameRewards;
      if (newlyMastered){
        playFanfareSound();
        feedbackText.textContent = "⭐ " + masteryLabel + " sitzt jetzt! Stark!" +
          (newGameRewards ? " 🎮 Belohnungsspiel freigeschaltet!" : "");
      } else {
        if (newGameRewards) playFanfareSound();
        else playCorrectSound();
        feedbackText.textContent = GOOD_MESSAGES[Math.floor(Math.random() * GOOD_MESSAGES.length)] +
          (newGameRewards ? " 🎮 Belohnungsspiel freigeschaltet!" : "");
      }
      if (answerResult.divisionUnlocked && state.config.divisionEnabled){
        feedbackText.textContent += " ➗ Division freigeschaltet!";
      }
      feedbackText.className = 'feedback good';
    } else {
      playWrongSound();
      var prefix = BAD_MESSAGES_PREFIX[Math.floor(Math.random() * BAD_MESSAGES_PREFIX.length)];
      feedbackText.textContent = prefix + " Richtig ist " + correct + ".";
      feedbackText.className = 'feedback bad';
      // Missed facts come back later in the same session, capped so a hard
      // fact can't stretch the session endlessly.
      var rq = state.today.requeueCounts = state.today.requeueCounts || {};
      if ((rq[key] || 0) < 2){
        rq[key] = (rq[key] || 0) + 1;
        enqueueRetry(key);
      }
    }

    state.today.index++;
    saveState();

    if (isCorrect){
      setTimeout(function(){ renderQuestion(); }, newlyMastered ? 2400 : CORRECT_ADVANCE_DELAY_MS);
    } else {
      setTimeout(function(){ awaitTap = true; }, WRONG_TAP_DELAY_MS);
    }
  }

  var STICKER_POOL = ["🦄","🐬","🦊","🐢","🚀","🌈","🍦","🐼","🦖","⚽","🎨","🐙","🌟","🧁","🐨","🎸","🦋","🍩","🤖","🐳"];
  var BADGE_MILESTONES = [7, 14, 30, 60, 100];

  function finishSession(){
    var wasBonus = state.today.bonus;
    var newSticker = null;
    var newBadge = null;
    var unlockedTable = null;
    var streakRecovered = false;
    if (!wasBonus){
      state.today.completed = true;
      var today = state.today.date;
      completeRegularStreak(today);

      state.stickers = state.stickers || [];
      var hasStickerToday = state.stickers.some(function(s){ return s.date === today; });
      if (!hasStickerToday){
        newSticker = STICKER_POOL[Math.floor(Math.random() * STICKER_POOL.length)];
        state.stickers.push({ date: today, emoji: newSticker });
      }
      unlockedTable = maybeUnlockNextTable();
    } else {
      streakRecovered = completeStreakRecovery(state.today.date);
    }
    state.badges = state.badges || [];
    BADGE_MILESTONES.forEach(function(m){
      if (state.streak >= m && state.badges.indexOf(m) === -1){
        state.badges.push(m);
        newBadge = m;
      }
    });
    saveState();

    if (newSticker || newBadge || unlockedTable || streakRecovered){
      var parts = [];
      if (newSticker) parts.push("Dein Sticker für heute: " + newSticker);
      if (streakRecovered) parts.push("🔥 Serie gerettet: " + state.streak + " Tage!");
      if (newBadge) parts.push("🏅 Neues Abzeichen: " + newBadge + "-Tage-Serie!");
      if (unlockedTable) parts.push("🔓 Die " + unlockedTable + "er-Reihe ist jetzt freigeschaltet!");
      if (sessionRewardUnlocks) parts.push("🎮 Belohnungsspiel freigeschaltet!");
      doneReward.textContent = parts.join(" — ");
      doneReward.style.display = 'block';
    } else if (sessionRewardUnlocks){
      doneReward.textContent = "🎮 Belohnungsspiel freigeschaltet!";
      doneReward.style.display = 'block';
    } else {
      doneReward.style.display = 'none';
    }

    var recoveryPending = state.streakRecovery && state.streakRecovery.date === state.today.date;
    doneSubtitle.textContent = streakRecovered
      ? "Doppelte Runde geschafft — deine Serie ist wieder da! 🔥"
      : (recoveryPending
        ? "Eine zweite Runde noch, dann ist deine Serie gerettet! 💪"
        : (wasBonus ? "Bonus-Runde geschafft! Extra-Übung hilft immer. 🌈"
          : "Du hast alle Aufgaben für heute geschafft."));
    doneStreakVal.textContent = state.streak;
    doneCorrectVal.textContent = state.today.correct + "/" + state.today.queue.length;
    doneRewardGameBtn.style.display = state.reward.availablePlays > 0 ? 'block' : 'none';
    doneRewardGameBtn.style.marginBottom = state.reward.availablePlays > 0 ? '12px' : '';
    doneBonusBtn.style.display = 'block';
    doneBonusBtn.textContent = recoveryPending ? "Serie retten: zweite Runde 🔥" : "Bonus-Runde spielen ⭐";
    showScreen(screenDone);
    playFanfareSound();
    launchConfetti();
  }

  // After a wrong answer, any tap/click advances (except on the gear button
  // or inside modals, so the parent area stays usable). touchstart is handled
  // too because iOS does not reliably emit click on non-interactive elements.
  var awaitTap = false;
  function tapAdvance(e){
    if (!awaitTap) return;
    if (e.target.closest && e.target.closest('.gear-btn, .modal-overlay')) return;
    awaitTap = false;
    renderQuestion();
  }
  document.addEventListener('click', tapAdvance);
  document.addEventListener('touchstart', tapAdvance, { passive: true });

  startBtn.addEventListener('click', function(){ startSession(false); });
  bonusBtn.addEventListener('click', function(){ startSession(true); });
  doneBonusBtn.addEventListener('click', function(){ startSession(true); });
  doneHomeBtn.addEventListener('click', function(){ renderHome(); });
  stickersBtn.addEventListener('click', function(){ renderStickers(); });
  stickersBackBtn.addEventListener('click', function(){ renderHome(); });
  function openRewardGameChoice(){
    if (!state.reward || state.reward.availablePlays < 1) return;
    rewardGameChoiceOrigin = screenDone.classList.contains('active') ? screenDone : screenHome;
    showScreen(screenGameChoice);
  }
  rewardBtn.addEventListener('click', openRewardGameChoice);
  doneRewardGameBtn.addEventListener('click', openRewardGameChoice);
  chooseDinoBtn.addEventListener('click', startRewardGame);
  chooseFlappyBtn.addEventListener('click', startFlappyGame);
  chooseTowerBtn.addEventListener('click', startTowerGame);
  gameChoiceBackBtn.addEventListener('click', function(){
    if (rewardGameChoiceOrigin === screenDone){
      applyAccentTheme(state.config.accentTheme);
      if (document.activeElement && typeof document.activeElement.blur === 'function'){
        document.activeElement.blur();
      }
      showScreen(screenDone);
    } else {
      renderHome();
    }
    rewardGameChoiceOrigin = null;
  });

  // ---------- Dino reward game ----------
  var rewardGame = null;
  var rewardGameFrame = null;

  function consumeRewardPlay(game){
    if (game.rewardConsumed) return true;
    if (!state.reward || state.reward.availablePlays < 1) return false;
    state.reward.availablePlays--;
    game.rewardConsumed = true;
    saveState();
    return true;
  }

  function updatePlayAgainButton(button, isDemo){
    var remaining = state.reward ? state.reward.availablePlays : 0;
    button.textContent = 'Nochmal spielen (' + remaining + ' übrig)';
    button.style.display = !isDemo && remaining > 0 ? 'block' : 'none';
  }

  function formatGameTime(ms){
    var seconds = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, '0');
  }

  function rewardGameDifficulty(elapsedMs){
    var level = Math.min(6, Math.floor(elapsedMs / 20000) + 1);
    var index = level - 1;
    return {
      level:level,
      speed:[250, 300, 350, 400, 450, 500][index],
      spawnBase:[1.08, 1.00, 0.94, 0.88, 0.82, 0.76][index],
      spawnJitter:[0.82, 0.78, 0.74, 0.70, 0.66, 0.62][index],
      closePairChance:[0.12, 0.18, 0.25, 0.32, 0.39, 0.46][index],
      closeGapBase:[0.92, 0.88, 0.84, 0.80, 0.76, 0.72][index],
      closeGapJitter:0.10,
      doubleChance:[0, 0.05, 0.14, 0.24, 0.34, 0.44][index],
      flyingChance:[0, 0, 0.10, 0.16, 0.22, 0.28][index],
      collectibleChance:[0.12, 0.14, 0.16, 0.18, 0.20, 0.22][index],
      minHeight:[28, 30, 32, 35, 38, 40][index],
      maxHeight:[47, 50, 54, 58, 62, 65][index]
    };
  }

  function rewardGameScore(){
    if (!rewardGame) return 0;
    var elapsed = rewardGame.startedAt ? Date.now() - rewardGame.startedAt : 0;
    var survivalPoints = Math.floor(Math.min(elapsed, GAME_DURATION_MS) / 1000);
    return survivalPoints + rewardGame.bonusScore;
  }

  function updateGameHud(){
    if (!rewardGame) return;
    var elapsed = rewardGame.startedAt ? Date.now() - rewardGame.startedAt : 0;
    var remaining = GAME_DURATION_MS - elapsed;
    var difficulty = rewardGameDifficulty(elapsed);
    gameTime.textContent = remaining <= 0 ? "0:00 · letzter Versuch" : formatGameTime(remaining);
    gameAttempts.textContent = "Versuch: " + Math.min(rewardGame.attempts + 1, rewardGame.maxAttempts) +
      "/" + rewardGame.maxAttempts;
    gameScore.textContent = "Punkte: " + rewardGameScore() + " · Rekord: " + state.reward.bestDinoScore;
    gameLevel.textContent = "Stufe: " + difficulty.level + "/6";
    var superRemaining = Math.max(0, rewardGame.superUntil - Date.now());
    gameStars.textContent = superRemaining
      ? "⭐ " + rewardGame.stars + " · 🌈 " + Math.ceil(superRemaining / 1000) + " s"
      : "⭐ " + rewardGame.stars + " · Super " + rewardGame.powerStars + "/3";
    gameCombo.textContent = "Combo ×" + rewardGame.multiplier + " (" + rewardGame.combo + ")";
  }

  function resetGameAttempt(){
    if (!rewardGame) return;
    rewardGame.dino = { x:58, y:188, w:34, h:38, vy:0, grounded:true };
    rewardGame.obstacles = [];
    rewardGame.collectibles = [];
    rewardGame.spawnIn = 1.15;
    rewardGame.compactNext = false;
    rewardGame.combo = 0;
    rewardGame.multiplier = 1;
    rewardGame.superUntil = 0;
  }

  function startRewardGame(){
    if (!state.reward || state.reward.availablePlays < 1) return;
    gameAgainBtn.style.display = 'none';

    rewardGame = {
      active:true,
      running:false,
      awaitingStart:true,
      rewardConsumed:false,
      startedAt:null,
      lastFrame:performance.now(),
      attempts:0,
      maxAttempts:GAME_MAX_ATTEMPTS,
      passed:0,
      bonusScore:0,
      combo:0,
      bestCombo:0,
      multiplier:1,
      stars:0,
      powerStars:0,
      superUntil:0,
      eggCollected:false,
      eggSpawned:false,
      timeExpired:false,
      obstacles:[],
      collectibles:[],
      clouds:[{ x:65, y:48 }, { x:225, y:76 }, { x:355, y:105 }],
      spawnIn:1.15,
      dino:null
    };
    resetGameAttempt();
    gameOverlayTitle.textContent = 'Bereit?';
    gameOverlayText.textContent = 'Tippe zum Loslaufen und Springen!';
    gameOverlay.hidden = false;
    showScreen(screenGame);
    updateGameHud();
    drawRewardGame();
    rewardGameFrame = requestAnimationFrame(runRewardGame);
  }

  function beginRewardGame(){
    if (!rewardGame || !rewardGame.active || !rewardGame.awaitingStart) return false;
    if (!consumeRewardPlay(rewardGame)) return false;
    rewardGame.startedAt = Date.now();
    rewardGame.awaitingStart = false;
    rewardGame.running = true;
    rewardGame.lastFrame = performance.now();
    gameOverlay.hidden = true;
    return true;
  }

  function jumpRewardDino(){
    if (!rewardGame || !rewardGame.active) return;
    if (rewardGame.awaitingStart && !beginRewardGame()) return;
    if (!rewardGame.running) return;
    var dino = rewardGame.dino;
    if (dino.grounded){
      dino.vy = -475;
      dino.grounded = false;
    }
  }

  function gameRectanglesOverlap(a, b){
    var margin = 4;
    return a.x + margin < b.x + b.w &&
      a.x + a.w - margin > b.x &&
      a.y + margin < b.y + b.h &&
      a.y + a.h - margin > b.y;
  }

  function crashRewardDino(){
    if (!rewardGame || !rewardGame.running) return;
    rewardGame.running = false;
    rewardGame.attempts++;
    rewardGame.combo = 0;
    rewardGame.multiplier = 1;
    rewardGame.superUntil = 0;
    updateGameHud();
    playWrongSound();

    if (rewardGame.attempts >= rewardGame.maxAttempts){
      finishRewardGame(rewardGame.maxAttempts === GAME_MAX_ATTEMPTS ? "Drei Versuche gespielt!" : "Bonus-Versuch gespielt!",
        "Stark gelaufen — deine nächste Belohnung wartet beim nächsten Lernziel.");
      return;
    }
    if (rewardGame.timeExpired || Date.now() - rewardGame.startedAt >= GAME_DURATION_MS){
      rewardGame.timeExpired = true;
      finishRewardGame("Zeit geschafft!", "Dein letzter laufender Versuch ist jetzt beendet — super gespielt!");
      return;
    }

    gameOverlayTitle.textContent = "Autsch! Noch " + (GAME_MAX_ATTEMPTS - rewardGame.attempts) +
      (GAME_MAX_ATTEMPTS - rewardGame.attempts === 1 ? " Versuch" : " Versuche");
    gameOverlayText.textContent = "Gleich geht es weiter …";
    gameOverlay.hidden = false;
    var currentGame = rewardGame;
    setTimeout(function(){
      if (rewardGame !== currentGame || !rewardGame.active) return;
      if (Date.now() - rewardGame.startedAt >= GAME_DURATION_MS){
        rewardGame.timeExpired = true;
        finishRewardGame("Zeit geschafft!", "Nach zwei Minuten startet kein weiterer Versuch — super gespielt!");
        return;
      }
      resetGameAttempt();
      rewardGame.running = true;
      rewardGame.lastFrame = performance.now();
      gameOverlay.hidden = true;
    }, 900);
  }

  function finishRewardGame(title, message){
    if (!rewardGame || !rewardGame.active) return;
    rewardGame.active = false;
    if (rewardGameFrame) cancelAnimationFrame(rewardGameFrame);
    rewardGameFrame = null;
    var finalScore = rewardGameScore();
    var isRecord = finalScore > state.reward.bestDinoScore;
    if (isRecord){
      state.reward.bestDinoScore = finalScore;
      saveState();
    }
    updateGameHud();
    gameOverlayTitle.textContent = title;
    gameOverlayText.textContent = message + " ⭐ " + rewardGame.stars + " Sterne · beste Combo " +
      rewardGame.bestCombo + " · " + finalScore + " Punkte" +
      (isRecord ? " · Neuer Rekord! 🏆" : " · Rekord: " + state.reward.bestDinoScore);
    gameOverlay.hidden = false;
    updatePlayAgainButton(gameAgainBtn, false);
    playFanfareSound();
    launchConfetti();
  }

  function stopRewardGame(){
    if (rewardGame){
      var score = rewardGameScore();
      if (score > state.reward.bestDinoScore){
        state.reward.bestDinoScore = score;
        saveState();
      }
      rewardGame.active = false;
    }
    if (rewardGameFrame) cancelAnimationFrame(rewardGameFrame);
    rewardGameFrame = null;
    rewardGame = null;
    gameOverlay.hidden = true;
  }

  function countPassedObstacle(obstacle, destroyed){
    if (obstacle.counted) return;
    obstacle.counted = true;
    rewardGame.passed++;
    rewardGame.combo++;
    rewardGame.bestCombo = Math.max(rewardGame.bestCombo, rewardGame.combo);
    rewardGame.multiplier = Math.min(5, 1 + Math.floor(rewardGame.combo / 3));
    rewardGame.bonusScore += (destroyed ? 15 : 10) * rewardGame.multiplier;
  }

  function collectRewardItem(item){
    if (item.collected) return;
    item.collected = true;
    if (item.type === 'egg'){
      rewardGame.eggCollected = true;
      rewardGame.maxAttempts = Math.min(GAME_MAX_ATTEMPTS + 1, rewardGame.maxAttempts + 1);
      rewardGame.bonusScore += 100;
      playFanfareSound();
      return;
    }
    rewardGame.stars++;
    rewardGame.powerStars++;
    rewardGame.bonusScore += 25 * rewardGame.multiplier;
    playCorrectSound();
    if (rewardGame.powerStars >= 3){
      rewardGame.powerStars = 0;
      rewardGame.superUntil = Date.now() + 5000;
      playFanfareSound();
    }
  }

  function updateRewardGame(dt){
    var game = rewardGame;
    if (!game.running) return;
    var dino = game.dino;
    var groundY = 226;

    dino.vy += 1250 * dt;
    dino.y += dino.vy * dt;
    if (dino.y + dino.h >= groundY){
      dino.y = groundY - dino.h;
      dino.vy = 0;
      dino.grounded = true;
    }

    var difficulty = rewardGameDifficulty(Date.now() - game.startedAt);
    var speed = difficulty.speed;
    game.clouds.forEach(function(cloud){
      cloud.x -= speed * 0.5 * dt;
      if (cloud.x + 50 < 0) cloud.x = 494;
    });
    game.spawnIn -= dt;
    if (game.spawnIn <= 0){
      // Close pairs are generated deliberately. Their second cactus stays
      // short and single so the small gap is demanding but still jumpable.
      var compactObstacle = !!game.compactNext;
      game.compactNext = false;
      var isFlying = !compactObstacle && Math.random() < difficulty.flyingChance;
      var obstacle;
      if (isFlying){
        obstacle = { x:500, y:150, w:38, h:24, type:'flying', double:false, counted:false };
      } else {
        var minHeight = compactObstacle ? 26 : difficulty.minHeight;
        var maxHeight = compactObstacle ? Math.min(38, difficulty.maxHeight) : difficulty.maxHeight;
        var height = minHeight + Math.random() * (maxHeight - minHeight);
        var isDouble = !compactObstacle && Math.random() < difficulty.doubleChance;
        var width = isDouble ? 40 + Math.random() * 8 : 20 + Math.random() * 8;
        obstacle = {
          x:500, y:groundY - height, w:width, h:height,
          type:'cactus', double:isDouble, counted:false
        };
        if (!compactObstacle && Math.random() < difficulty.collectibleChance){
          var itemType = !game.eggSpawned && Math.random() < 0.03 ? 'egg' : 'star';
          if (itemType === 'egg') game.eggSpawned = true;
          game.collectibles.push({
            x:obstacle.x + obstacle.w / 2,
            y:Math.max(105, obstacle.y - 24),
            r:itemType === 'egg' ? 11 : 9,
            type:itemType,
            collected:false
          });
        }
      }
      game.obstacles.push(obstacle);
      var startClosePair = !compactObstacle && !isFlying && !obstacle.double &&
        Math.random() < difficulty.closePairChance;
      if (startClosePair){
        game.spawnIn = difficulty.closeGapBase + Math.random() * difficulty.closeGapJitter;
        game.compactNext = true;
      } else {
        game.spawnIn = difficulty.spawnBase + Math.random() * difficulty.spawnJitter;
      }
    }

    game.obstacles.forEach(function(obstacle){
      if (!game.running) return;
      obstacle.x -= speed * dt;
      if (!obstacle.counted && obstacle.x + obstacle.w < dino.x){
        countPassedObstacle(obstacle, false);
      }
      if (gameRectanglesOverlap(dino, obstacle)){
        if (Date.now() < game.superUntil){
          countPassedObstacle(obstacle, true);
          obstacle.destroyed = true;
        } else {
          crashRewardDino();
        }
      }
    });
    game.obstacles = game.obstacles.filter(function(obstacle){
      return !obstacle.destroyed && obstacle.x + obstacle.w > -10;
    });

    if (!game.running) return;
    game.collectibles.forEach(function(item){
      item.x -= speed * dt;
      var hitbox = { x:item.x - item.r, y:item.y - item.r, w:item.r * 2, h:item.r * 2 };
      if (gameRectanglesOverlap(dino, hitbox)) collectRewardItem(item);
    });
    game.collectibles = game.collectibles.filter(function(item){
      return !item.collected && item.x + item.r > -10;
    });
  }

  function drawGameStar(ctx, x, y, radius){
    ctx.beginPath();
    for (var point = 0; point < 10; point++){
      var angle = -Math.PI / 2 + point * Math.PI / 5;
      var distance = point % 2 === 0 ? radius : radius * 0.45;
      var px = x + Math.cos(angle) * distance;
      var py = y + Math.sin(angle) * distance;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawRewardGame(){
    var ctx = gameCtx;
    var game = rewardGame;
    ctx.clearRect(0, 0, 480, 270);

    var sky = ctx.createLinearGradient(0, 0, 0, 230);
    sky.addColorStop(0, '#dff6ff');
    sky.addColorStop(1, '#fff7d6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 480, 270);

    ctx.fillStyle = '#fdcb6e';
    ctx.beginPath();
    ctx.arc(415, 48, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    game.clouds.forEach(function(cloud){
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 14, 0, Math.PI * 2);
      ctx.arc(cloud.x + 17, cloud.y - 5, 18, 0, Math.PI * 2);
      ctx.arc(cloud.x + 36, cloud.y, 13, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#c7e6a2';
    ctx.fillRect(0, 226, 480, 44);
    ctx.fillStyle = '#81b64c';
    ctx.fillRect(0, 226, 480, 5);

    if (!game || !game.dino) return;
    game.obstacles.forEach(function(obstacle){
      if (obstacle.type === 'flying'){
        ctx.fillStyle = '#e17055';
        ctx.beginPath();
        ctx.ellipse(obstacle.x + 19, obstacle.y + 13, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        var flap = Math.sin(Date.now() / 90) * 5;
        ctx.moveTo(obstacle.x + 16, obstacle.y + 12);
        ctx.lineTo(obstacle.x + 2, obstacle.y - 4 - flap);
        ctx.lineTo(obstacle.x + 25, obstacle.y + 9);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillRect(obstacle.x + 28, obstacle.y + 8, 4, 4);
        ctx.fillStyle = '#2d2d3a';
        ctx.fillRect(obstacle.x + 30, obstacle.y + 9, 2, 2);
        return;
      }
      ctx.fillStyle = '#2e9b62';
      if (obstacle.double){
        var stemWidth = 18;
        ctx.fillRect(obstacle.x, obstacle.y + 8, stemWidth, obstacle.h - 8);
        ctx.fillRect(obstacle.x + obstacle.w - stemWidth, obstacle.y, stemWidth, obstacle.h);
        ctx.fillRect(obstacle.x - 5, obstacle.y + 20, 6, 7);
        ctx.fillRect(obstacle.x + obstacle.w - 1, obstacle.y + 14, 6, 7);
      } else {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillRect(obstacle.x - 6, obstacle.y + 10, 7, 7);
        ctx.fillRect(obstacle.x - 6, obstacle.y + 4, 4, 12);
        ctx.fillRect(obstacle.x + obstacle.w - 1, obstacle.y + 17, 7, 7);
        ctx.fillRect(obstacle.x + obstacle.w + 3, obstacle.y + 10, 4, 14);
      }
    });

    game.collectibles.forEach(function(item){
      if (item.type === 'egg'){
        ctx.fillStyle = '#ffeaa7';
        ctx.strokeStyle = '#e1a800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, 9, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fd79a8';
        ctx.beginPath();
        ctx.arc(item.x - 2, item.y + 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f6c90e';
        ctx.strokeStyle = '#d99a00';
        ctx.lineWidth = 1.5;
        drawGameStar(ctx, item.x, item.y, item.r + 2);
        ctx.stroke();
      }
    });

    var d = game.dino;
    var superActive = Date.now() < game.superUntil;
    if (superActive){
      ['#e84393','#fdcb6e','#00b894','#0984e3'].forEach(function(color, index){
        ctx.globalAlpha = 0.18 + index * 0.08;
        ctx.fillStyle = color;
        ctx.fillRect(d.x - 18 - index * 13, d.y + 12 + index * 2, 22, 16);
      });
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = superActive
      ? ['#e84393','#fdcb6e','#00b894','#0984e3'][Math.floor(Date.now() / 100) % 4]
      : ACCENT_THEMES[state.config.accentTheme].primary;
    ctx.fillRect(4, 10, 24, 22);
    ctx.fillRect(18, 0, 25, 20);
    ctx.fillRect(0, 18, 10, 8);
    ctx.fillRect(5, 30, 7, 8);
    ctx.fillRect(23, 30, 7, 8);
    ctx.fillStyle = 'white';
    ctx.fillRect(34, 4, 5, 5);
    ctx.fillStyle = '#2d2d3a';
    ctx.fillRect(36, 5, 2, 2);
    ctx.restore();
  }

  function runRewardGame(now){
    if (!rewardGame || !rewardGame.active) return;
    var elapsed = rewardGame.startedAt ? Date.now() - rewardGame.startedAt : 0;
    if (elapsed >= GAME_DURATION_MS) rewardGame.timeExpired = true;

    var dt = Math.min(0.04, (now - rewardGame.lastFrame) / 1000);
    rewardGame.lastFrame = now;
    updateRewardGame(dt);
    drawRewardGame();
    updateGameHud();
    if (rewardGame && rewardGame.active) rewardGameFrame = requestAnimationFrame(runRewardGame);
  }

  gameWrap.addEventListener('pointerdown', function(e){
    e.preventDefault();
    jumpRewardDino();
  });
  ['contextmenu', 'selectstart', 'dragstart'].forEach(function(eventName){
    gameWrap.addEventListener(eventName, function(e){ e.preventDefault(); });
  });
  document.addEventListener('keydown', function(e){
    if ((e.key === ' ' || e.key === 'ArrowUp') && rewardGame && rewardGame.active){
      e.preventDefault();
      jumpRewardDino();
    } else if ((e.key === ' ' || e.key === 'ArrowUp') && flappyGame && flappyGame.active){
      e.preventDefault();
      flapRewardBird();
    } else if ((e.key === ' ' || e.key === 'ArrowDown') && towerGame && towerGame.active){
      e.preventDefault();
      placeTowerBlock();
    }
  });
  gameHomeBtn.addEventListener('click', function(){
    stopRewardGame();
    renderHome();
  });
  gameAgainBtn.addEventListener('click', function(){
    stopRewardGame();
    openRewardGameChoice();
  });

  // ---------- Flattervogel reward game ----------
  var flappyGame = null;
  var flappyGameFrame = null;

  function flappyDifficulty(elapsedMs){
    var progress = Math.min(1, elapsedMs / GAME_DURATION_MS);
    return { speed:140 + progress * 60, gap:132 - progress * 28 };
  }

  function flappyGameScore(){
    if (!flappyGame) return 0;
    var survival = flappyGame.startedAt
      ? Math.floor(Math.min(Date.now() - flappyGame.startedAt, GAME_DURATION_MS) / 1000)
      : 0;
    return survival + flappyGame.passed * 25;
  }

  function updateFlappyHud(){
    if (!flappyGame) return;
    var elapsed = flappyGame.startedAt ? Date.now() - flappyGame.startedAt : 0;
    var remaining = GAME_DURATION_MS - elapsed;
    flappyTime.textContent = remaining <= 0 ? '0:00 · letzter Versuch' : formatGameTime(remaining);
    flappyAttempts.textContent = 'Versuch: ' + Math.min(flappyGame.attempts + 1, GAME_MAX_ATTEMPTS) +
      '/' + GAME_MAX_ATTEMPTS;
    flappyScore.textContent = 'Punkte: ' + flappyGameScore();
    flappyBest.textContent = 'Rekord: ' + state.reward.bestFlappyScore;
  }

  function resetFlappyAttempt(){
    if (!flappyGame) return;
    flappyGame.bird = { x:116, y:166, w:32, h:25, vy:0, angle:0 };
    flappyGame.pipes = [];
    flappyGame.spawnIn = 1.25;
    flappyGame.running = false;
    flappyGame.awaitingStart = true;
  }

  function startFlappyGame(demoMode){
    var isDemo = demoMode === true;
    if (!isDemo && (!state.reward || state.reward.availablePlays < 1)) return;
    flappyAgainBtn.style.display = 'none';
    flappyGame = {
      active:true,
      running:false,
      awaitingStart:true,
      isDemo:isDemo,
      rewardConsumed:false,
      startedAt:null,
      lastFrame:performance.now(),
      attempts:0,
      passed:0,
      pipes:[],
      spawnIn:1.25,
      bird:null,
      clouds:[{x:55,y:62,s:.8},{x:245,y:96,s:1.1},{x:410,y:45,s:.7}]
    };
    resetFlappyAttempt();
    flappyOverlayTitle.textContent = 'Bereit?';
    flappyOverlayText.textContent = 'Tippe zum Losflattern!';
    flappyOverlay.hidden = false;
    showScreen(screenFlappy);
    updateFlappyHud();
    drawFlappyGame();
    flappyGameFrame = requestAnimationFrame(runFlappyGame);
  }

  function flapRewardBird(){
    if (!flappyGame || !flappyGame.active) return;
    if (flappyGame.awaitingStart){
      if (flappyGame.startedAt && Date.now() - flappyGame.startedAt >= GAME_DURATION_MS){
        finishFlappyGame('Zeit geschafft!', 'Nach zwei Minuten startet kein weiterer Versuch — super gespielt!');
        return;
      }
      if (!flappyGame.startedAt){
        if (!flappyGame.isDemo && !consumeRewardPlay(flappyGame)) return;
        flappyGame.startedAt = Date.now();
      }
      flappyGame.awaitingStart = false;
      flappyGame.running = true;
      flappyGame.lastFrame = performance.now();
      flappyOverlay.hidden = true;
    }
    if (flappyGame.running) flappyGame.bird.vy = -345;
  }

  function flappyOverlap(a, b){
    var margin = 4;
    return a.x + margin < b.x + b.w && a.x + a.w - margin > b.x &&
      a.y + margin < b.y + b.h && a.y + a.h - margin > b.y;
  }

  function crashFlappyBird(){
    if (!flappyGame || !flappyGame.running) return;
    flappyGame.running = false;
    flappyGame.attempts++;
    playWrongSound();
    updateFlappyHud();
    if (flappyGame.attempts >= GAME_MAX_ATTEMPTS){
      finishFlappyGame('Drei Versuche gespielt!', 'Stark geflattert — deine nächste Belohnung wartet beim nächsten Lernziel.');
      return;
    }
    if (Date.now() - flappyGame.startedAt >= GAME_DURATION_MS){
      finishFlappyGame('Zeit geschafft!', 'Dein letzter laufender Versuch ist jetzt beendet — super gespielt!');
      return;
    }
    resetFlappyAttempt();
    flappyOverlayTitle.textContent = 'Fast! Noch ' + (GAME_MAX_ATTEMPTS - flappyGame.attempts) +
      (GAME_MAX_ATTEMPTS - flappyGame.attempts === 1 ? ' Versuch' : ' Versuche');
    flappyOverlayText.textContent = 'Tippe zum Weiterflattern.';
    flappyOverlay.hidden = false;
  }

  function finishFlappyGame(title, message){
    if (!flappyGame || !flappyGame.active) return;
    flappyGame.active = false;
    flappyGame.running = false;
    var finalScore = flappyGameScore();
    var isRecord = finalScore > state.reward.bestFlappyScore;
    if (isRecord){
      state.reward.bestFlappyScore = finalScore;
      saveState();
    }
    updateFlappyHud();
    flappyOverlayTitle.textContent = title;
    flappyOverlayText.textContent = message + ' ' + flappyGame.passed +
      (flappyGame.passed === 1 ? ' Röhre' : ' Röhren') + ' · ' + finalScore + ' Punkte' +
      (isRecord ? ' · Neuer Rekord! 🏆' : ' · Rekord: ' + state.reward.bestFlappyScore);
    flappyOverlay.hidden = false;
    updatePlayAgainButton(flappyAgainBtn, flappyGame.isDemo);
    playFanfareSound();
    launchConfetti();
  }

  function stopFlappyGame(){
    if (flappyGame){
      var score = flappyGameScore();
      if (score > state.reward.bestFlappyScore){
        state.reward.bestFlappyScore = score;
        saveState();
      }
      flappyGame.active = false;
    }
    if (flappyGameFrame) cancelAnimationFrame(flappyGameFrame);
    flappyGameFrame = null;
    flappyGame = null;
    flappyOverlay.hidden = true;
  }

  function updateFlappyGame(dt){
    var game = flappyGame;
    if (!game.running) return;
    var bird = game.bird;
    var elapsed = Date.now() - game.startedAt;
    var difficulty = flappyDifficulty(elapsed);
    bird.vy += 980 * dt;
    bird.y += bird.vy * dt;
    bird.angle = Math.max(-.45, Math.min(1.05, bird.vy / 430));
    game.clouds.forEach(function(cloud){
      cloud.x -= 18 * cloud.s * dt;
      if (cloud.x < -60) cloud.x = 520;
    });
    game.spawnIn -= dt;
    if (game.spawnIn <= 0){
      var edge = 54;
      var gapTop = edge + Math.random() * (306 - edge * 2 - difficulty.gap);
      game.pipes.push({ x:500, w:58, gapTop:gapTop, gap:difficulty.gap, counted:false });
      game.spawnIn = 1.48 + Math.random() * .18;
    }
    game.pipes.forEach(function(pipe){
      if (!game.running) return;
      pipe.x -= difficulty.speed * dt;
      if (!pipe.counted && pipe.x + pipe.w < bird.x){
        pipe.counted = true;
        game.passed++;
      }
      var topPipe = { x:pipe.x, y:0, w:pipe.w, h:pipe.gapTop };
      var bottomPipe = { x:pipe.x, y:pipe.gapTop + pipe.gap, w:pipe.w,
        h:320 - pipe.gapTop - pipe.gap };
      if (flappyOverlap(bird, topPipe) || flappyOverlap(bird, bottomPipe)) crashFlappyBird();
    });
    game.pipes = game.pipes.filter(function(pipe){ return pipe.x + pipe.w > -8; });
    if (game.running && (bird.y < -8 || bird.y + bird.h > 320)) crashFlappyBird();
  }

  function drawFlappyCloud(cloud){
    flappyCtx.save();
    flappyCtx.translate(cloud.x, cloud.y);
    flappyCtx.scale(cloud.s, cloud.s);
    flappyCtx.beginPath();
    flappyCtx.arc(0, 5, 14, 0, Math.PI * 2);
    flappyCtx.arc(17, 0, 19, 0, Math.PI * 2);
    flappyCtx.arc(37, 6, 13, 0, Math.PI * 2);
    flappyCtx.fill();
    flappyCtx.restore();
  }

  function drawFlappyPipe(pipe){
    var bottomY = pipe.gapTop + pipe.gap;
    flappyCtx.fillStyle = '#38ad68';
    flappyCtx.strokeStyle = '#207c48';
    flappyCtx.lineWidth = 3;
    flappyCtx.fillRect(pipe.x + 7, 0, pipe.w - 14, pipe.gapTop - 16);
    flappyCtx.strokeRect(pipe.x + 7, -3, pipe.w - 14, pipe.gapTop - 13);
    flappyCtx.fillRect(pipe.x, pipe.gapTop - 18, pipe.w, 18);
    flappyCtx.strokeRect(pipe.x, pipe.gapTop - 18, pipe.w, 18);
    flappyCtx.fillRect(pipe.x + 7, bottomY + 16, pipe.w - 14, 320 - bottomY - 16);
    flappyCtx.strokeRect(pipe.x + 7, bottomY + 16, pipe.w - 14, 323 - bottomY - 16);
    flappyCtx.fillRect(pipe.x, bottomY, pipe.w, 18);
    flappyCtx.strokeRect(pipe.x, bottomY, pipe.w, 18);
  }

  function drawFlappyBird(bird){
    var wingY = Math.sin(Date.now() / 70) * 4;
    flappyCtx.save();
    flappyCtx.translate(bird.x + bird.w / 2, bird.y + bird.h / 2);
    flappyCtx.rotate(bird.angle);
    flappyCtx.fillStyle = '#ffd34e';
    flappyCtx.strokeStyle = '#d99b24';
    flappyCtx.lineWidth = 2;
    flappyCtx.beginPath();
    flappyCtx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2);
    flappyCtx.fill(); flappyCtx.stroke();
    flappyCtx.fillStyle = '#ff9f43';
    flappyCtx.beginPath();
    flappyCtx.moveTo(14, -1); flappyCtx.lineTo(26, 3); flappyCtx.lineTo(14, 7); flappyCtx.closePath(); flappyCtx.fill();
    flappyCtx.fillStyle = '#f5b82e';
    flappyCtx.beginPath(); flappyCtx.ellipse(-9, wingY, 11, 7, -.35, 0, Math.PI * 2); flappyCtx.fill();
    flappyCtx.fillStyle = 'white';
    flappyCtx.beginPath(); flappyCtx.arc(8, -5, 5, 0, Math.PI * 2); flappyCtx.fill();
    flappyCtx.fillStyle = '#26344a';
    flappyCtx.beginPath(); flappyCtx.arc(10, -5, 2, 0, Math.PI * 2); flappyCtx.fill();
    flappyCtx.restore();
  }

  function drawFlappyGame(){
    var ctx = flappyCtx;
    var sky = ctx.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, '#72d4eb'); sky.addColorStop(1, '#d9f6f1');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 480, 360);
    if (!flappyGame) return;
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    flappyGame.clouds.forEach(drawFlappyCloud);
    flappyGame.pipes.forEach(drawFlappyPipe);
    drawFlappyBird(flappyGame.bird);
    ctx.fillStyle = '#9bd36a'; ctx.fillRect(0, 320, 480, 40);
    ctx.fillStyle = '#68ad46'; ctx.fillRect(0, 320, 480, 6);
  }

  function runFlappyGame(now){
    if (!flappyGame || !flappyGame.active) return;
    var dt = Math.min(.035, (now - flappyGame.lastFrame) / 1000);
    flappyGame.lastFrame = now;
    updateFlappyGame(dt);
    drawFlappyGame();
    updateFlappyHud();
    if (flappyGame && flappyGame.active) flappyGameFrame = requestAnimationFrame(runFlappyGame);
  }

  flappyWrap.addEventListener('pointerdown', function(e){
    e.preventDefault();
    flapRewardBird();
  });
  ['contextmenu','selectstart','dragstart'].forEach(function(eventName){
    flappyWrap.addEventListener(eventName, function(e){ e.preventDefault(); });
  });
  flappyHomeBtn.addEventListener('click', function(){
    stopFlappyGame();
    renderHome();
  });
  flappyAgainBtn.addEventListener('click', function(){
    stopFlappyGame();
    openRewardGameChoice();
  });

  // ---------- Turmbauer reward game ----------
  var towerGame = null;
  var towerGameFrame = null;
  var TOWER_BLOCK_HEIGHT = 27;
  var TOWER_COLORS = ['#6c5ce7','#00b894','#fdcb6e','#e17055','#0984e3','#e84393'];

  function towerGameScore(){
    if (!towerGame) return 0;
    return towerGame.totalPlaced * 20 + towerGame.perfects * 10;
  }

  function updateTowerHud(){
    if (!towerGame) return;
    var elapsed = towerGame.startedAt ? Date.now() - towerGame.startedAt : 0;
    var remaining = GAME_DURATION_MS - elapsed;
    towerTime.textContent = remaining <= 0 ? '0:00 · letzter Versuch' : formatGameTime(remaining);
    towerAttempts.textContent = 'Versuch: ' + Math.min(towerGame.attempts + 1, GAME_MAX_ATTEMPTS) +
      '/' + GAME_MAX_ATTEMPTS;
    towerScore.textContent = 'Punkte: ' + towerGameScore() + ' · Höhe: ' + towerGame.height;
    towerBest.textContent = 'Rekord: ' + state.reward.bestTowerScore;
  }

  function createTowerMovingBlock(){
    var top = towerGame.blocks[towerGame.blocks.length - 1];
    var direction = towerGame.height % 2 === 0 ? 1 : -1;
    var colorIndex = (towerGame.totalPlaced + 1) % TOWER_COLORS.length;
    var blockColor = colorIndex === 0
      ? ACCENT_THEMES[state.config.accentTheme].primary
      : TOWER_COLORS[colorIndex];
    towerGame.moving = {
      x:direction > 0 ? 8 : 472 - top.w,
      y:top.y - TOWER_BLOCK_HEIGHT,
      w:top.w,
      h:TOWER_BLOCK_HEIGHT,
      vx:direction * (145 + Math.min(170, towerGame.totalPlaced * 4.5)),
      color:blockColor
    };
  }

  function resetTowerAttempt(){
    if (!towerGame) return;
    towerGame.height = 0;
    towerGame.flash = 0;
    towerGame.blocks = [{
      x:140, y:438, w:200, h:TOWER_BLOCK_HEIGHT,
      color:ACCENT_THEMES[state.config.accentTheme].primary
    }];
    towerGame.moving = null;
    towerGame.running = false;
    towerGame.awaitingStart = true;
    createTowerMovingBlock();
  }

  function startTowerGame(demoMode){
    var isDemo = demoMode === true;
    if (!isDemo && (!state.reward || state.reward.availablePlays < 1)) return;
    towerAgainBtn.style.display = 'none';
    towerGame = {
      active:true,
      running:false,
      awaitingStart:true,
      isDemo:isDemo,
      rewardConsumed:false,
      startedAt:null,
      lastFrame:performance.now(),
      attempts:0,
      height:0,
      totalPlaced:0,
      perfects:0,
      flash:0,
      blocks:[],
      moving:null
    };
    resetTowerAttempt();
    towerOverlayTitle.textContent = 'Bereit?';
    towerOverlayText.textContent = 'Tippe zum Starten und dann zum Stapeln!';
    towerOverlay.hidden = false;
    showScreen(screenTower);
    updateTowerHud();
    drawTowerGame();
    towerGameFrame = requestAnimationFrame(runTowerGame);
  }

  function beginTowerAttempt(){
    if (!towerGame || !towerGame.active || !towerGame.awaitingStart) return false;
    if (towerGame.startedAt && Date.now() - towerGame.startedAt >= GAME_DURATION_MS){
      finishTowerGame('Zeit geschafft!', 'Nach zwei Minuten startet kein weiterer Versuch — super gebaut!');
      return false;
    }
    if (!towerGame.startedAt){
      if (!towerGame.isDemo && !consumeRewardPlay(towerGame)) return false;
      towerGame.startedAt = Date.now();
    }
    towerGame.awaitingStart = false;
    towerGame.running = true;
    towerGame.lastFrame = performance.now();
    towerOverlay.hidden = true;
    return true;
  }

  function placeTowerBlock(){
    if (!towerGame || !towerGame.active) return;
    if (towerGame.awaitingStart){
      beginTowerAttempt();
      return;
    }
    if (!towerGame.running) return;
    var moving = towerGame.moving;
    var top = towerGame.blocks[towerGame.blocks.length - 1];
    var left = Math.max(moving.x, top.x);
    var right = Math.min(moving.x + moving.w, top.x + top.w);
    var overlap = right - left;
    if (overlap <= 0){
      crashTowerBlock();
      return;
    }
    if (Math.abs(moving.x - top.x) <= 4){
      left = top.x;
      overlap = top.w;
      towerGame.perfects++;
      towerGame.flash = .22;
    }
    towerGame.blocks.push({
      x:left, y:moving.y, w:overlap, h:TOWER_BLOCK_HEIGHT, color:moving.color
    });
    towerGame.height++;
    towerGame.totalPlaced++;
    if (moving.y < 92){
      towerGame.blocks.forEach(function(block){ block.y += TOWER_BLOCK_HEIGHT; });
    }
    createTowerMovingBlock();
    updateTowerHud();
  }

  function crashTowerBlock(){
    if (!towerGame || !towerGame.running) return;
    towerGame.running = false;
    towerGame.attempts++;
    playWrongSound();
    updateTowerHud();
    if (towerGame.attempts >= GAME_MAX_ATTEMPTS){
      finishTowerGame('Drei Türme gebaut!', 'Deine nächste Belohnung wartet beim nächsten Lernziel.');
      return;
    }
    if (Date.now() - towerGame.startedAt >= GAME_DURATION_MS){
      finishTowerGame('Zeit geschafft!', 'Dein letzter laufender Turm ist jetzt beendet — super gebaut!');
      return;
    }
    resetTowerAttempt();
    towerOverlayTitle.textContent = 'Knapp! Noch ' + (GAME_MAX_ATTEMPTS - towerGame.attempts) +
      (GAME_MAX_ATTEMPTS - towerGame.attempts === 1 ? ' Versuch' : ' Versuche');
    towerOverlayText.textContent = 'Tippe für den nächsten Turm.';
    towerOverlay.hidden = false;
  }

  function finishTowerGame(title, message){
    if (!towerGame || !towerGame.active) return;
    towerGame.active = false;
    towerGame.running = false;
    var finalScore = towerGameScore();
    var isRecord = finalScore > state.reward.bestTowerScore;
    if (isRecord){
      state.reward.bestTowerScore = finalScore;
      saveState();
    }
    updateTowerHud();
    towerOverlayTitle.textContent = title;
    towerOverlayText.textContent = message + ' ' + towerGame.totalPlaced +
      (towerGame.totalPlaced === 1 ? ' Etage' : ' Etagen') + ' · ' + towerGame.perfects +
      ' perfekt · ' + finalScore + ' Punkte' +
      (isRecord ? ' · Neuer Rekord! 🏆' : ' · Rekord: ' + state.reward.bestTowerScore);
    towerOverlay.hidden = false;
    updatePlayAgainButton(towerAgainBtn, towerGame.isDemo);
    playFanfareSound();
    launchConfetti();
  }

  function stopTowerGame(){
    if (towerGame){
      var score = towerGameScore();
      if (score > state.reward.bestTowerScore){
        state.reward.bestTowerScore = score;
        saveState();
      }
      towerGame.active = false;
    }
    if (towerGameFrame) cancelAnimationFrame(towerGameFrame);
    towerGameFrame = null;
    towerGame = null;
    towerOverlay.hidden = true;
  }

  function updateTowerGame(dt){
    if (!towerGame.running) return;
    var moving = towerGame.moving;
    moving.x += moving.vx * dt;
    if (moving.x < 8){
      moving.x = 8;
      moving.vx = Math.abs(moving.vx);
    }
    if (moving.x + moving.w > 472){
      moving.x = 472 - moving.w;
      moving.vx = -Math.abs(moving.vx);
    }
    towerGame.flash = Math.max(0, towerGame.flash - dt);
  }

  function drawTowerBlock(block){
    var inset = Math.min(6, block.w / 3);
    towerCtx.fillStyle = block.color;
    towerCtx.fillRect(block.x, block.y, block.w, block.h - 2);
    towerCtx.fillStyle = 'rgba(255,255,255,.18)';
    towerCtx.fillRect(block.x + inset, block.y + 3, Math.max(0, block.w - inset * 2), 4);
  }

  function drawTowerGame(){
    var sky = towerCtx.createLinearGradient(0, 0, 0, 480);
    sky.addColorStop(0, '#dff6ff');
    sky.addColorStop(1, '#fff2d3');
    towerCtx.fillStyle = sky;
    towerCtx.fillRect(0, 0, 480, 480);
    towerCtx.fillStyle = 'rgba(255,255,255,.7)';
    towerCtx.beginPath();
    towerCtx.arc(62, 70, 20, 0, Math.PI * 2);
    towerCtx.arc(86, 63, 27, 0, Math.PI * 2);
    towerCtx.arc(115, 72, 18, 0, Math.PI * 2);
    towerCtx.fill();
    towerCtx.fillStyle = '#b8dc87';
    towerCtx.fillRect(0, 465, 480, 15);
    if (!towerGame) return;
    towerGame.blocks.forEach(drawTowerBlock);
    if (towerGame.moving) drawTowerBlock(towerGame.moving);
    if (towerGame.flash > 0){
      towerCtx.fillStyle = 'rgba(255,255,255,' + (towerGame.flash * 2) + ')';
      towerCtx.fillRect(0, 0, 480, 480);
    }
  }

  function runTowerGame(now){
    if (!towerGame || !towerGame.active) return;
    var dt = Math.min(.035, (now - towerGame.lastFrame) / 1000);
    towerGame.lastFrame = now;
    updateTowerGame(dt);
    drawTowerGame();
    updateTowerHud();
    if (towerGame && towerGame.active) towerGameFrame = requestAnimationFrame(runTowerGame);
  }

  towerWrap.addEventListener('pointerdown', function(e){
    e.preventDefault();
    placeTowerBlock();
  });
  ['contextmenu','selectstart','dragstart'].forEach(function(eventName){
    towerWrap.addEventListener(eventName, function(e){ e.preventDefault(); });
  });
  towerHomeBtn.addEventListener('click', function(){
    stopTowerGame();
    renderHome();
  });
  towerAgainBtn.addEventListener('click', function(){
    stopTowerGame();
    openRewardGameChoice();
  });

  // ---------- Profiles ----------
  function openProfileOverlay(){
    profileList.innerHTML = '';
    Object.keys(root.profiles).forEach(function(id){
      var p = root.profiles[id];
      var btn = document.createElement('button');
      btn.className = id === root.activeProfileId ? 'primary-btn' : 'secondary-btn';
      btn.style.marginTop = '12px';
      btn.textContent = p.config.childName || 'Ohne Namen';
      btn.addEventListener('click', function(){
        setActiveProfile(id);
        profileOverlay.classList.remove('active');
        renderHome();
      });
      profileList.appendChild(btn);
    });
    profileOverlay.classList.add('active');
  }

  profileBtn.addEventListener('click', openProfileOverlay);
  profileClose.addEventListener('click', function(){ profileOverlay.classList.remove('active'); });
  profileOverlay.addEventListener('click', function(e){
    if (e.target === profileOverlay) profileOverlay.classList.remove('active');
  });

  function renderAdminProfiles(){
    adminProfileList.innerHTML = '';
    var ids = Object.keys(root.profiles);
    ids.forEach(function(id){
      var p = root.profiles[id];
      var row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0eff8;';
      var nameSpan = document.createElement('span');
      nameSpan.textContent = (p.config.childName || 'Ohne Namen') + (id === root.activeProfileId ? ' ✓ aktiv' : '');
      if (id === root.activeProfileId) nameSpan.style.fontWeight = '700';
      row.appendChild(nameSpan);
      if (ids.length > 1){
        var del = document.createElement('button');
        del.textContent = 'Löschen';
        del.style.cssText = 'border:none; background:none; color:var(--bad); font-weight:600; cursor:pointer; font-size:0.85rem;';
        del.addEventListener('click', function(){
          if (!confirm('Profil "' + (p.config.childName || 'Ohne Namen') + '" mit gesamtem Fortschritt löschen?')) return;
          delete root.profiles[id];
          if (root.activeProfileId === id){
            setActiveProfile(Object.keys(root.profiles)[0]);
          } else {
            saveState();
          }
          openAdmin(); // refresh all admin fields for the (possibly new) active profile
        });
        row.appendChild(del);
      }
      adminProfileList.appendChild(row);
    });
  }

  addProfileBtn.addEventListener('click', function(){
    var name = newProfileNameInput.value.trim();
    if (!name) return;
    var id = 'p' + Date.now();
    var prof = defaultProfile();
    prof.config.childName = name;
    root.profiles[id] = prof;
    setActiveProfile(id);
    newProfileNameInput.value = '';
    openAdmin(); // refresh admin fields for the new active profile
  });

  // ---------- Admin ----------
  function populateRangeSelects(){
    rangeMinSel.innerHTML = '';
    rangeMaxSel.innerHTML = '';
    for (var i = 1; i <= 20; i++){
      var o1 = document.createElement('option'); o1.value = i; o1.textContent = i;
      var o2 = document.createElement('option'); o2.value = i; o2.textContent = i;
      rangeMinSel.appendChild(o1);
      rangeMaxSel.appendChild(o2);
    }
  }

  function selectedTablesFromControls(){
    var selected = [];
    tableChoices.querySelectorAll('input[type=checkbox]').forEach(function(input){
      if (input.checked) selected.push(parseInt(input.value, 10));
    });
    return selected;
  }

  function renderTableChoices(preferred){
    var min = parseInt(rangeMinSel.value, 10);
    var max = parseInt(rangeMaxSel.value, 10);
    if (min > max){ var temp = min; min = max; max = temp; }
    preferred = preferred || selectedTablesFromControls();
    var hasPreferredInRange = preferred.some(function(v){ return v >= min && v <= max; });
    tableChoices.innerHTML = '';
    for (var table = min; table <= max; table++){
      var label = document.createElement('label');
      label.className = 'table-choice';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = table;
      input.checked = hasPreferredInRange ? preferred.indexOf(table) !== -1 : true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(table + 'er'));
      tableChoices.appendChild(label);
    }
    updateUnlockStatus();
  }

  function updateUnlockStatus(){
    var selected = selectedTablesFromControls();
    if (!autoUnlockTablesToggle.checked){
      unlockStatus.textContent = 'Alle gewählten Reihen sind sofort aktiv.';
    } else if (selected.length){
      var saved = configuredTables();
      var reflectsSavedPlan = state.config.autoUnlockTables && selected.join(',') === saved.join(',');
      if (reflectsSavedPlan){
        var active = activeTables();
        var nextIndex = selected.indexOf(active[active.length - 1]) + 1;
        unlockStatus.textContent = 'Aktiv: ' + active.map(function(v){ return v + 'er'; }).join(', ') +
          (nextIndex < selected.length ? ' · Als Nächstes: ' + selected[nextIndex] + 'er.' : ' · Alle Reihen freigeschaltet.');
      } else {
        unlockStatus.textContent = 'Startet mit der ' + selected[0] + 'er-Reihe; die nächsten werden bei 80 % Lernstand freigeschaltet.';
      }
    } else {
      unlockStatus.textContent = 'Wähle mindestens eine Reihe aus.';
    }
  }

  var BOX_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#a8d861", "#6dc06d", "#27ae60", "#1e8e5a", "#0f6b45"];

  function renderFactDetail(key){
    var skill = practiceSkill(key);
    if (!skill) return;
    var f = skill.fact;
    var record = skill.record;
    var attempts = record.correctCount + record.wrongCount;
    var accuracy = attempts ? Math.round(record.correctCount / attempts * 100) : 0;
    var timedAttempts = Number(record.timedAttemptCount) || 0;
    var average = timedAttempts ? (record.totalResponseMs / timedAttempts / 1000).toFixed(1) + ' s' : '–';
    var label;
    if (skill.operation === 'divide'){
      label = (f.a * f.b) + ' ÷ ' + f.a + ' = ' + f.b;
      if (f.a !== f.b) label += ' / ' + (f.a * f.b) + ' ÷ ' + f.b + ' = ' + f.a;
    } else {
      label = f.a + ' × ' + f.b + ' = ' + (f.a * f.b);
    }
    var lockText = skill.operation === 'divide' && !record.unlocked ? ' · noch gesperrt' : '';
    factDetail.textContent = label + ' · Stufe ' + record.box + ' · ' + accuracy + ' % richtig · Ø ' + average +
      ' · zuletzt ' + (record.lastPracticedDate || 'noch nie') + ' · fällig ' + record.dueDate + lockText;
  }

  function renderLearningDashboard(){
    var today = todayStr();
    var pool = factsInRange().map(function(f){
      return practiceSkill(dashboardOperation === 'divide' ? divisionSkillKey(f.a, f.b) : factKey(f.a, f.b));
    });
    var available = pool.filter(function(skill){
      return dashboardOperation === 'multiply' || skill.record.unlocked;
    });
    var newCount = available.filter(function(skill){ return !skill.record.seen; }).length;
    var dueCount = available.filter(function(skill){ return skill.record.seen && skill.record.dueDate === today; }).length;
    var overdueCount = available.filter(function(skill){ return skill.record.seen && skill.record.dueDate < today; }).length;
    var mastered = available.filter(function(skill){ return skill.record.box >= MAX_BOX - 1; }).length;
    learningSummary.innerHTML = '<div><strong>' + newCount + '</strong>Neu</div>' +
      '<div><strong>' + dueCount + '</strong>Heute fällig</div>' +
      '<div><strong>' + overdueCount + '</strong>Überfällig</div>' +
      '<div><strong>' + mastered + '</strong>Gemeistert</div>' +
      (dashboardOperation === 'divide'
        ? '<div><strong>' + (pool.length - available.length) + '</strong>Gesperrt</div>'
        : '');

    historySummary.innerHTML = '<div class="hint">Letzte 7 Tage: Genauigkeit ' +
      (dashboardOperation === 'divide' ? 'Division' : 'Multiplikation') + '</div>';
    for (var offset = 6; offset >= 0; offset--){
      var date = addDays(today, -offset);
      var historyDay = state.history[date] || {};
      var day = historyDay.byOperation && historyDay.byOperation[dashboardOperation]
        ? historyDay.byOperation[dashboardOperation]
        : { attempts:0, correct:0 };
      var percent = day.attempts ? Math.round(day.correct / day.attempts * 100) : 0;
      var row = document.createElement('div');
      row.className = 'history-row';
      var label = document.createElement('span');
      label.textContent = date.slice(8, 10) + '.' + date.slice(5, 7) + '.';
      var bar = document.createElement('div');
      bar.className = 'history-bar';
      var fill = document.createElement('i');
      fill.style.width = percent + '%';
      bar.appendChild(fill);
      var value = document.createElement('small');
      value.textContent = day.attempts ? percent + '% (' + day.attempts + ')' : '–';
      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(value);
      historySummary.appendChild(row);
    }

    troubleList.innerHTML = '';
    var trouble = available.filter(function(skill){ return skill.record.seen && skill.record.wrongCount > 0; });
    trouble.sort(function(x, y){
      var xAttempts = x.record.correctCount + x.record.wrongCount;
      var yAttempts = y.record.correctCount + y.record.wrongCount;
      var rateDiff = (y.record.wrongCount / yAttempts) - (x.record.wrongCount / xAttempts);
      return rateDiff || y.record.wrongCount - x.record.wrongCount;
    });
    if (!trouble.length){
      troubleList.textContent = 'Noch keine auffälligen Aufgaben.';
    } else {
      trouble.slice(0, 5).forEach(function(skill){
        var button = document.createElement('button');
        button.type = 'button';
        var f = skill.fact;
        button.textContent = (skill.operation === 'divide'
          ? (f.a * f.b) + '÷' + f.a + '/' + f.b
          : f.a + '×' + f.b) + ' · ' + skill.record.wrongCount + '× falsch';
        button.addEventListener('click', function(){ renderFactDetail(skill.key); });
        troubleList.appendChild(button);
      });
    }
  }

  function renderBackupReminder(){
    var last = root.lastBackupDate;
    var old = !last || daysBetween(last, todayStr()) >= 30;
    backupReminder.className = 'backup-reminder' + (old ? ' warning' : '');
    backupReminder.textContent = !last
      ? 'Noch kein Backup erstellt. Der Fortschritt liegt nur auf diesem Gerät.'
      : old
        ? 'Letztes Backup: ' + last + '. Bitte wieder sichern.'
        : 'Letztes Backup: ' + last + '.';
  }

  function renderProgressGridTable(){
    var cfg = state.config;
    var tables = activeTables();
    var planned = configuredTables();
    var html = '<tr><th></th>';
    for (var b = cfg.min; b <= cfg.max; b++) html += '<th>' + b + '</th>';
    html += '</tr>';
    for (var a = cfg.min; a <= cfg.max; a++){
      html += '<tr><th>' + a + '</th>';
      for (var b2 = cfg.min; b2 <= cfg.max; b2++){
        var key = factKey(Math.min(a,b2), Math.max(a,b2));
        var f = state.facts[key];
        var record = f ? (dashboardOperation === 'divide' ? f.division : f) : null;
        var skillKey = dashboardOperation === 'divide' ? 'd:' + key : key;
        var box = record ? record.box : 0;
        var seen = record && record.seen;
        var baseActive = f && factUsesOnlyTables(f, planned) && factTouchesTables(f, tables);
        var unlocked = dashboardOperation === 'multiply' || (record && record.unlocked);
        var active = baseActive && unlocked && (dashboardOperation === 'multiply' || state.config.divisionEnabled);
        var cellClass = 'box-cell' + (active ? '' : ' inactive') + (!unlocked ? ' locked' : '');
        var color = seen ? BOX_COLORS[Math.min(box, BOX_COLORS.length - 1)] : '#d7d6e0';
        var info = !unlocked ? 'gesperrt bis Multiplikationsstufe 4'
          : (seen ? ('Stufe ' + box + ' | fällig ' + record.dueDate) : 'noch nicht geübt');
        html += '<td><button type="button" class="' + cellClass +
          '" data-key="' + skillKey + '" style="background:' + color + '" title="' +
          (dashboardOperation === 'divide'
            ? (a*b2) + '÷' + a + ' = ' + b2
            : a + '×' + b2 + ' = ' + (a*b2)) + ' | ' + info + '" aria-label="' +
          (dashboardOperation === 'divide' ? 'Division ' : 'Multiplikation ') + a + ' und ' + b2 + ', ' + info + '">&nbsp;</button></td>';
      }
      html += '</tr>';
    }
    progressGrid.innerHTML = html;
  }

  function selectDashboardOperation(operation){
    dashboardOperation = operation === 'divide' ? 'divide' : 'multiply';
    operationSwitch.querySelectorAll('button').forEach(function(button){
      var selected = button.dataset.operation === dashboardOperation;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    factDetail.textContent = 'Tippe auf eine Aufgabe, um Details zu sehen.';
    renderLearningDashboard();
    renderProgressGridTable();
  }

  function showAdminTab(panelId, moveFocus){
    adminTabs.forEach(function(tab){
      var selected = tab.getAttribute('aria-controls') === panelId;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });
    adminTabPanels.forEach(function(panel){
      var selected = panel.id === panelId;
      panel.hidden = !selected;
      panel.classList.toggle('active', selected);
    });
    adminSaveActions.hidden = panelId === 'adminPanelOverview';
  }

  function openAdmin(){
    populateRangeSelects();
    renderAdminProfiles();
    childNameInput.value = state.config.childName || '';
    accentThemeSel.value = state.config.accentTheme || 'purple';
    rangeMinSel.value = state.config.min;
    rangeMaxSel.value = state.config.max;
    renderTableChoices(configuredTables());
    tasksPerDayInput.value = state.config.tasksPerDay;
    newFactsPerRoundInput.value = state.config.newFactsPerRound;
    autoUnlockTablesToggle.checked = state.config.autoUnlockTables;
    updateUnlockStatus();
    rewardEveryInput.value = state.config.rewardEvery;
    soundToggle.checked = state.config.sound !== false;
    answerModeSel.value = state.config.answerMode || 'choice';
    gapToggle.checked = !!state.config.gapTasks;
    divisionToggle.checked = !!state.config.divisionEnabled;
    newPinInput.value = '';
    selectDashboardOperation('multiply');
    renderBackupReminder();
    showAdminTab('adminPanelOverview', false);
    adminOverlay.classList.add('active');
  }
  function closeAdminModal(){
    adminOverlay.classList.remove('active');
  }

  function openPinPrompt(){
    pinInput.value = '';
    pinError.textContent = '';
    pinOverlay.classList.add('active');
    // Keep focus inside the original tap gesture so mobile browsers open the
    // numeric keyboard immediately. The animation-frame retry covers slower
    // modal rendering without delaying the primary focus call.
    pinInput.focus();
    requestAnimationFrame(function(){ pinInput.focus(); });
  }
  function closePinPrompt(){
    pinOverlay.classList.remove('active');
  }
  function submitPin(){
    if (pinInput.value === (root.pin || "6969")){
      closePinPrompt();
      openAdmin();
    } else {
      pinError.textContent = 'Falscher PIN. Nochmal versuchen.';
      pinInput.value = '';
      pinInput.focus();
      pinModal.classList.remove('shake');
      void pinModal.offsetWidth;
      pinModal.classList.add('shake');
    }
  }

  gearBtn.addEventListener('click', openPinPrompt);
  pinClose.addEventListener('click', closePinPrompt);
  pinOverlay.addEventListener('click', function(e){
    if (e.target === pinOverlay) closePinPrompt();
  });
  pinSubmit.addEventListener('click', submitPin);
  pinInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter') submitPin();
  });

  closeAdmin.addEventListener('click', closeAdminModal);
  adminOverlay.addEventListener('click', function(e){
    if (e.target === adminOverlay) closeAdminModal();
  });
  adminTabs.forEach(function(tab, index){
    tab.addEventListener('click', function(){
      showAdminTab(tab.getAttribute('aria-controls'), false);
    });
    tab.addEventListener('keydown', function(e){
      var nextIndex = index;
      if (e.key === 'ArrowRight') nextIndex = (index + 1) % adminTabs.length;
      else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + adminTabs.length) % adminTabs.length;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = adminTabs.length - 1;
      else return;
      e.preventDefault();
      showAdminTab(adminTabs[nextIndex].getAttribute('aria-controls'), true);
    });
  });
  rangeMinSel.addEventListener('change', function(){ renderTableChoices(selectedTablesFromControls()); });
  rangeMaxSel.addEventListener('change', function(){ renderTableChoices(selectedTablesFromControls()); });
  tableChoices.addEventListener('change', updateUnlockStatus);
  autoUnlockTablesToggle.addEventListener('change', updateUnlockStatus);
  operationSwitch.addEventListener('click', function(e){
    var button = e.target.closest && e.target.closest('button[data-operation]');
    if (button) selectDashboardOperation(button.dataset.operation);
  });
  progressGrid.addEventListener('click', function(e){
    var cell = e.target.closest && e.target.closest('.box-cell');
    if (cell && cell.dataset.key) renderFactDetail(cell.dataset.key);
  });

  saveAdminBtn.addEventListener('click', function(){
    var min = parseInt(rangeMinSel.value, 10);
    var max = parseInt(rangeMaxSel.value, 10);
    if (min > max){ var t = min; min = max; max = t; }
    var tasks = parseInt(tasksPerDayInput.value, 10);
    if (!tasks || tasks < 1) tasks = 5;
    if (tasks > 20) tasks = 20;
    var newFactsPerRound = parseInt(newFactsPerRoundInput.value, 10);
    if (!newFactsPerRound || newFactsPerRound < 1) newFactsPerRound = 2;
    if (newFactsPerRound > 10) newFactsPerRound = 10;
    var tables = selectedTablesFromControls().filter(function(v){ return v >= min && v <= max; });
    if (!tables.length) tables = [min];
    var rewardEvery = parseInt(rewardEveryInput.value, 10);
    if (!rewardEvery || rewardEvery < 1) rewardEvery = 10;
    if (rewardEvery > 100) rewardEvery = 100;
    var rewardIntervalChanged = rewardEvery !== state.config.rewardEvery;
    var wasAutoUnlocking = state.config.autoUnlockTables;

    state.config.min = min;
    state.config.max = max;
    state.config.enabledTables = tables;
    state.config.tasksPerDay = tasks;
    state.config.newFactsPerRound = newFactsPerRound;
    state.config.newFactsPerDay = newFactsPerRound;
    state.config.autoUnlockTables = autoUnlockTablesToggle.checked;
    state.config.rewardEvery = rewardEvery;
    state.config.childName = childNameInput.value.trim();
    state.config.accentTheme = ACCENT_THEMES[accentThemeSel.value] ? accentThemeSel.value : 'purple';
    state.config.sound = soundToggle.checked;
    state.config.answerMode = answerModeSel.value;
    state.config.gapTasks = gapToggle.checked;
    state.config.divisionEnabled = divisionToggle.checked;
    state.curriculum.unlockedTables = state.curriculum.unlockedTables.filter(function(v){
      return tables.indexOf(v) !== -1;
    });
    if (state.config.autoUnlockTables && (!wasAutoUnlocking || !state.curriculum.unlockedTables.length)){
      state.curriculum.unlockedTables = [tables[0]];
    }
    if (/^\d{4}$/.test(newPinInput.value)) root.pin = newPinInput.value;
    if (rewardIntervalChanged){
      // Preserve unlocked games, but rebase the counter so toggling this
      // setting cannot grant duplicates or postpone the next interval.
      state.reward.totalEarned = Math.floor(totalCorrectAnswers() / rewardEvery);
    }

    ensureFactPool();
    state.today.newFactKeys = [];
    state.today.queue = buildQueue(tasks);
    state.today.index = 0;
    state.today.correct = 0;
    state.today.completed = false;
    state.today.bonus = false;
    state.today.requeueCounts = {};
    applyAccentTheme(state.config.accentTheme);
    saveState();

    closeAdminModal();
    renderHome();
  });

  exportBtn.addEventListener('click', function(){
    root.lastBackupDate = todayStr();
    saveState();
    var blob = new Blob([JSON.stringify(root, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '1x1-trainer-backup-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    renderBackupReminder();
  });

  importBtn.addEventListener('click', function(){ importFile.click(); });
  importFile.addEventListener('change', function(){
    var file = importFile.files && importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var parsed = JSON.parse(reader.result);
        if (!parsed || !parsed.profiles || !parsed.activeProfileId || !parsed.profiles[parsed.activeProfileId]){
          alert('Diese Datei ist kein gültiges 1×1-Trainer-Backup.');
        } else if (confirm('Backup einspielen? Der aktuelle Stand auf diesem Gerät wird überschrieben.')){
          for (var id in parsed.profiles) normalizeProfile(parsed.profiles[id]);
          if (!parsed.pin) parsed.pin = "6969";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.lastBackupDate || '')) parsed.lastBackupDate = null;
          root = parsed;
          state = root.profiles[root.activeProfileId];
          ensureFactPool();
          applyAccentTheme(state.config.accentTheme);
          saveState();
          renderHome();
          openAdmin();
          alert('Backup erfolgreich geladen!');
        }
      } catch(e){
        alert('Datei konnte nicht gelesen werden.');
      }
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  resetProgressBtn.addEventListener('click', function(){
    if (!confirm('Wirklich den gesamten Lernfortschritt dieses Profils löschen? Das kann nicht rückgängig gemacht werden.')) return;
    var cfg = state.config;
    var fresh = defaultProfile();
    fresh.config = cfg;
    normalizeProfile(fresh);
    root.profiles[root.activeProfileId] = fresh;
    state = fresh;
    ensureFactPool();
    applyAccentTheme(state.config.accentTheme);
    saveState();
    renderProgressGridTable();
    renderHome();
  });

  // ---------- init ----------
  ensureFactPool();
  applyAccentTheme(state.config.accentTheme);
  saveState();
  renderHome();

  var demoMatch = location.search.match(/[?&]demo=(flappy|tower)(?:&|$)/);
  if (demoMatch){
    if (demoMatch[1] === 'flappy') startFlappyGame(true);
    else startTowerGame(true);
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:'){
    navigator.serviceWorker.register('sw.js').catch(function(){ /* offline support only */ });
  }

})();
