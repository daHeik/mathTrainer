(function(){
  "use strict";

  function el(id){return document.getElementById(id);}
  function makeIcon(name){
    var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');
    svg.setAttribute('class','icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    use.setAttribute('href','icons.svg#'+name);svg.appendChild(use);return svg;
  }
  function iconLabel(node,value,name){node.textContent='';node.appendChild(makeIcon(name));node.appendChild(document.createTextNode(' '+value));}
  function text(id,value){el(id).textContent=value;}

  var STORAGE_KEY = "km_1x1_trainer_v1"; // legacy single-profile storage
  var ROOT_KEY = "km_1x1_trainer_v2";
  var INTERVALS = [1, 1, 2, 4, 7, 12, 20, 32]; // days, indexed by box level
  var MAX_BOX = INTERVALS.length - 1;
  var FAST_MS = 3500;
  var SLOW_MS = 9000;
  var INPUT_TIME_COMPENSATION_MS = 2000;
  var CORRECT_ADVANCE_DELAY_MS = 1400;
  var WRONG_TAP_DELAY_MS = 1200; // minimum time to look at the correct answer before a tap advances
  var GAME_DURATION_MS = 3 * 60 * 1000;
  function gameDurationMs(game){ return game && game.kind === 'brick' ? 5 * 60 * 1000 : GAME_DURATION_MS; }
  function gameElapsedMs(g){return g&&g.playTimeMs||0;}
  function gameTimeStamp(g){return (g&&g.startedAt||0)+gameElapsedMs(g);}
  function finishGameTime(g){
    if(g===rewardGame)finishRewardGame('Drei Minuten geschafft!','Super gespielt!');
    else if(g===flappyGame)finishFlappyGame('Drei Minuten geschafft!','Super geflattert!');
    else if(g===towerGame)finishTowerGame('Drei Minuten geschafft!','Super gebaut!');
    else if(g===gravityGame)finishGravityGame('Drei Minuten geschafft!');
    else finishArcadeGame(g.kind,g.kind === 'brick' ? 'Fünf Minuten geschafft!' : 'Drei Minuten geschafft!');
  }
  function activeGameStep(g,dt){
    if(!g||!g.running||g.pausedAt!=null)return 0;
    var duration=gameDurationMs(g);
    var used=Math.min(Math.max(0,dt),(duration-gameElapsedMs(g))/1000);
    g.playTimeMs=gameElapsedMs(g)+used*1000;
    if(g.playTimeMs>=duration-.00001){g.playTimeMs=duration;finishGameTime(g);return 0;}
    return used;
  }
  function simulateGameFrame(g,now,update){
    if(gameElapsedMs(g)>=gameDurationMs(g)){finishGameTime(g);return 0;}
    var dt=Math.min(.25,Math.max(0,(now-g.lastFrame)/1000));g.lastFrame=now;
    // Consume ordinary slow frames in small physics steps; never charge time
    // while waiting, paused or hidden. Long stalls have a bounded catch-up.
    for(var left=dt;left>1e-8&&g.active&&g.running;left-=1/60)update(Math.min(left,1/60));
    return dt;
  }

  var GAME_MAX_ATTEMPTS = 3;
  var DIVISION_UNLOCK_BOX = 4;
  var STICKER_POOL = [
    '🦄','🐬','🦊','🐢','🚀','🌈','🍦','🐼','🦖','⚽','🎨','🐙','🌟','🧁','🐨','🎸','🦋','🍩','🤖','🐳',
    '🐶','🐱','🐰','🐹','🐻','🐯','🦁','🐸','🐵','🐷',
    '🐧','🐥','🦉','🦅','🦆','🦜','🦩','🦚','🦢','🐝',
    '🐞','🐌','🦀','🦈','🐠','🦑','🦔','🦒','🐘','🦓',
    '🌻','🌷','🌹','🌵','🌴','🍀','🍄','🌙','☀️','❄️',
    '🍓','🍒','🍉','🍍','🍎','🍌','🥝','🍇','🍪','🍿',
    '🏀','🎾','🏓','🎯','🪁','🎈','🎁','👑','💎','🏰'
  ];
  var SESSION_MODES = ['mixed', 'table', 'hundreds', 'terms', 'riddles', 'written', 'semi', 'semiFree', 'semiRest'];
  var RIDDLE_TYPES = ['halfAdd', 'doubleAdd', 'halfSubtract', 'doubleSubtract',
    'sumDouble', 'differenceHalf', 'productAdd', 'quotientAdd'];
  var TERM_CONCEPTS = ['addition', 'subtraction', 'multiplication', 'division',
    'sum', 'difference', 'product', 'quotient'];
  var TERM_LABELS = {
    addition:'Addition', subtraction:'Subtraktion', multiplication:'Multiplikation',
    division:'Division', sum:'Summe', difference:'Differenz', product:'Produkt', quotient:'Quotient'
  };

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
  function hundredsSkillKey(operation, a, b){
    return 'h:' + (operation === 'divide' ? 'd:' : 'm:') + factKey(a, b);
  }
  function termSkillKey(concept){ return 't:' + concept; }
  function learningDefaults(today){
    return {
      box:0, dueDate:today, seen:false,
      correctCount:0, wrongCount:0, correctStreak:0,
      totalResponseMs:0, timedAttemptCount:0, lastPracticedDate:null
    };
  }
  function divisionDefaults(today){
    var record = learningDefaults(today);
    record.unlocked = false;
    return record;
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
        mode: 'mixed',
        focusTable: null,
        requeueCounts: {}, // fact key -> times re-added to this session after a wrong answer
        newFactKeys: []   // legacy field retained when loading older backups
      },
      termSkills: {},
      riddleSkills: {},
      writtenSkills: {},
      semiSkills: {},
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
        bestTowerScore: 0,
        bestGravityScore: 0,
        bestBrickScore: 0,
        bestSnakeScore: 0,
        bestSnowScore: 0,
        bestRunnerScore: 0,
        bestDoodleScore: 0,
        bestTilesScore: 0,
        bestMazeScore: 0,
        bestAsteroidScore: 0,
        gamesPlayed: 0,
        gamesTrackedSince: today
      }
    };
  }

  function correctAnswersForProfile(profile){
    var total = 0;
    var facts = profile.facts || {};
    for (var key in facts){
      total += Number(facts[key].correctCount) || 0;
      if (facts[key].division) total += Number(facts[key].division.correctCount) || 0;
      if (facts[key].hundreds){
        total += Number(facts[key].hundreds.multiply.correctCount) || 0;
        total += Number(facts[key].hundreds.divide.correctCount) || 0;
      }
    }
    var termSkills = profile.termSkills || {};
    TERM_CONCEPTS.forEach(function(concept){
      if (termSkills[concept]) total += Number(termSkills[concept].correctCount) || 0;
    });
    var riddleSkills = profile.riddleSkills || {};
    RIDDLE_TYPES.forEach(function(type){
      if (riddleSkills[type]) total += Number(riddleSkills[type].correctCount) || 0;
    });
    writtenSkillKeys().forEach(function(key){
      if (profile.writtenSkills && profile.writtenSkills[key]) total += Number(profile.writtenSkills[key].correctCount) || 0;
    });
    semiSkillKeys().forEach(function(key){
      if (profile.semiSkills && profile.semiSkills[key]) total += Number(profile.semiSkills[key].correctCount) || 0;
    });
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
      if (!fact.hundreds || typeof fact.hundreds !== 'object') fact.hundreds = {};
      if (!fact.hundreds.multiply) fact.hundreds.multiply = learningDefaults(normalizationDate);
      if (!fact.hundreds.divide) fact.hundreds.divide = learningDefaults(normalizationDate);
      normalizeLearningRecord(fact.hundreds.multiply, normalizationDate);
      normalizeLearningRecord(fact.hundreds.divide, normalizationDate);
    }
    if (!p.termSkills || typeof p.termSkills !== 'object') p.termSkills = {};
    TERM_CONCEPTS.forEach(function(concept){
      if (!p.termSkills[concept]) p.termSkills[concept] = learningDefaults(normalizationDate);
      normalizeLearningRecord(p.termSkills[concept], normalizationDate);
    });
    if (!p.riddleSkills || typeof p.riddleSkills !== 'object') p.riddleSkills = {};
    RIDDLE_TYPES.forEach(function(type){
      if (!p.riddleSkills[type]) p.riddleSkills[type] = learningDefaults(normalizationDate);
      normalizeLearningRecord(p.riddleSkills[type], normalizationDate);
    });
    if (!p.today) p.today = defaultProfile().today;
    if (!p.writtenSkills || typeof p.writtenSkills !== 'object') p.writtenSkills = {};
    writtenSkillKeys().forEach(function(key){
      if (!p.writtenSkills[key]) p.writtenSkills[key] = learningDefaults(normalizationDate);
      normalizeLearningRecord(p.writtenSkills[key], normalizationDate);
    });
    if (!p.today.requeueCounts) p.today.requeueCounts = {};
    if (!p.semiSkills || typeof p.semiSkills !== 'object') p.semiSkills = {};
    semiSkillKeys().forEach(function(key){
      if (!p.semiSkills[key]) p.semiSkills[key] = learningDefaults(normalizationDate);
      normalizeLearningRecord(p.semiSkills[key], normalizationDate);
    });
    if (!Array.isArray(p.today.newFactKeys)) p.today.newFactKeys = [];
    var focusTable = parseInt(p.today.focusTable, 10);
    p.today.focusTable = tables.indexOf(focusTable) !== -1 ? focusTable : null;
    if (SESSION_MODES.indexOf(p.today.mode) === -1) p.today.mode = p.today.focusTable ? 'table' : 'mixed';
    if (p.today.mode === 'table' && !p.today.focusTable) p.today.mode = 'mixed';
    if (p.today.focusTable) p.today.mode = 'table';
    if (p.today.mode === 'mixed' || p.today.mode === 'table') trimRepeatedQueueFacts(p.today);
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
      ['multiply','divide','hundredsMultiply','hundredsDivide','terms','riddles','writtenDivide','semiDivide'].forEach(function(operation){
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
    replaceDuplicateStickers(p.stickers);
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
    ['bestGravityScore','bestBrickScore','bestSnakeScore','bestSnowScore','bestRunnerScore','bestDoodleScore','bestTilesScore','bestMazeScore','bestAsteroidScore','gamesPlayed'].forEach(function(key){
      if (!Number.isFinite(p.reward[key]) || p.reward[key] < 0) p.reward[key] = 0;
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.reward.gamesTrackedSince || '')) p.reward.gamesTrackedSince = todayStr();
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
    if (themeMeta) themeMeta.setAttribute('content', '#f2f2f7');
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
    var poolMax = Math.max(10, cfg.max);
    for (var a = 1; a <= poolMax; a++){
      for (var b = a; b <= poolMax; b++){
        var key = factKey(a, b);
        if (!state.facts[key]){
          state.facts[key] = {
            a:a, b:b, box:0, dueDate:today, seen:false,
            correctCount:0, wrongCount:0, correctStreak:0,
            totalResponseMs:0, timedAttemptCount:0, lastPracticedDate:null,
            division:divisionDefaults(today),
            hundreds:{ multiply:learningDefaults(today), divide:learningDefaults(today) }
          };
        } else if (!state.facts[key].division){
          state.facts[key].division = divisionDefaults(today);
        }
        if (!state.facts[key].hundreds) state.facts[key].hundreds = {};
        if (!state.facts[key].hundreds.multiply) state.facts[key].hundreds.multiply = learningDefaults(today);
        if (!state.facts[key].hundreds.divide) state.facts[key].hundreds.divide = learningDefaults(today);
        if (state.facts[key].box >= DIVISION_UNLOCK_BOX) state.facts[key].division.unlocked = true;
      }
    }
    if (!state.termSkills) state.termSkills = {};
    TERM_CONCEPTS.forEach(function(concept){
      if (!state.termSkills[concept]) state.termSkills[concept] = learningDefaults(today);
    });
    if (!state.riddleSkills) state.riddleSkills = {};
    RIDDLE_TYPES.forEach(function(type){
      if (!state.riddleSkills[type]) state.riddleSkills[type] = learningDefaults(today);
    });
    if (!state.writtenSkills) state.writtenSkills = {};
    if (!state.semiSkills) state.semiSkills = {};
    semiSkillKeys().forEach(function(key){
      if (!state.semiSkills[key]) state.semiSkills[key] = learningDefaults(today);
    });
    writtenSkillKeys().forEach(function(key){
      if (!state.writtenSkills[key]) state.writtenSkills[key] = learningDefaults(today);
    });
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

  function isSemiMode(mode){return ['semi','semiFree','semiRest'].indexOf(mode)!==-1;}
  function semiModeLabel(mode){return {semi:'Halbschriftlich · mit Hilfe',semiFree:'Halbschriftlich · eigener Weg',semiRest:'Halbschriftlich · mit Rest'}[mode];}
  function semiSkillKeys(mode){
    var keys=[];
    ['semi','semiFree','semiRest'].forEach(function(stage){
      if(mode&&stage!==mode)return;
      for(var divisor=2;divisor<=9;divisor++)keys.push('sd:'+stage+':'+divisor);
    });
    return keys;
  }
  function semiSuggestedPart(remaining,divisor){
    var quotient=Math.floor(remaining/divisor);
    if(!quotient)return 0;
    var place=Math.pow(10,String(quotient).length-1);
    return Math.floor(quotient/place)*place*divisor;
  }
  function semiDivisionQuestion(skill){
    var minimum=Math.ceil(100/skill.divisor);
    var maximum=skill.mode==='semi'?Math.min(99,Math.floor(999/skill.divisor)):Math.floor((999-(skill.mode==='semiRest'?skill.divisor-1:0))/skill.divisor);
    var quotient=minimum+Math.floor(Math.random()*(maximum-minimum+1));
    if(skill.mode==='semi'&&quotient%10===0)quotient++;
    var rest=skill.mode==='semiRest'?1+Math.floor(Math.random()*(skill.divisor-1)):0;
    return {dividend:quotient*skill.divisor+rest,divisor:skill.divisor,correct:quotient,rest:rest,mode:skill.mode};
  }
  function checkSemiPart(exercise,remaining,chunk,quotient){
    if(!/^[0-9]{1,4}$/.test(String(chunk))||!Number(chunk))return 'Wähle eine ganze Zahl größer als 0 als Teil.';
    chunk=Number(chunk);
    if(chunk>remaining)return 'Dieser Teil ist größer als die noch übrige Zahl '+remaining+'.';
    if(chunk%exercise.divisor)return 'Dieser Teil lässt sich nicht ohne Rest durch '+exercise.divisor+' teilen. Suche ein passendes Vielfaches.';
    if(!/^[0-9]{1,4}$/.test(String(quotient))||Number(quotient)*exercise.divisor!==chunk)return 'Prüfe die Teilrechnung: Welche Zahl mal '+exercise.divisor+' ergibt '+chunk+'?';
    return '';
  }

  function writtenSkillKeys(){
    var keys = [];
    for (var divisor = 2; divisor <= 9; divisor++){
      keys.push('w:' + divisor + ':2', 'w:' + divisor + ':3');
    }
    return keys;
  }

  function writtenDivisionQuestion(skill){
    var min = Math.max(Math.ceil(100 / skill.divisor), skill.digits === 3 ? 100 : 10);
    var max = Math.min(Math.floor(999 / skill.divisor), skill.digits === 3 ? 999 : 99);
    var quotient = min + Math.floor(Math.random() * (max - min + 1));
    var steps = String(quotient).split('').map(function(digit, index, digits){
      var part = Number(digit) * Math.pow(10, digits.length - index - 1);
      return { dividend:part * skill.divisor, quotient:part };
    }).filter(function(step){ return step.quotient !== 0; });
    return { dividend:quotient * skill.divisor, divisor:skill.divisor, correct:quotient, steps:steps };
  }

  function practiceSkill(key){
    if (typeof key !== 'string') return null;
    if (semiSkillKeys().indexOf(key) !== -1){
      var semiParts = key.split(':');
      return {key:key,kind:'semi',operation:'semiDivide',mode:semiParts[1],divisor:Number(semiParts[2]),record:state.semiSkills[key],fact:null};
    }
    if (writtenSkillKeys().indexOf(key) !== -1){
      var writtenParts = key.split(':');
      return { key:key, kind:'written', operation:'writtenDivide', fact:null,
        divisor:Number(writtenParts[1]), digits:Number(writtenParts[2]), record:state.writtenSkills[key] };
    }
    if (key.indexOf('r:') === 0){
      var riddleType = key.slice(2);
      if (RIDDLE_TYPES.indexOf(riddleType) === -1 || !state.riddleSkills[riddleType]) return null;
      return { key:key, kind:'riddle', riddleType:riddleType, operation:'riddles', fact:null,
        record:state.riddleSkills[riddleType] };
    }
    if (key.indexOf('t:') === 0){
      var concept = key.slice(2);
      if (TERM_CONCEPTS.indexOf(concept) === -1 || !state.termSkills[concept]) return null;
      return {
        key:key, kind:'term', concept:concept, operation:'terms', fact:null,
        record:state.termSkills[concept]
      };
    }
    if (key.indexOf('h:') === 0){
      var hundredsParts = key.split(':');
      if (hundredsParts.length !== 3 || ['m', 'd'].indexOf(hundredsParts[1]) === -1) return null;
      var hundredsOperation = hundredsParts[1] === 'd' ? 'divide' : 'multiply';
      var hundredsFact = state.facts[hundredsParts.slice(2).join(':')];
      if (!hundredsFact || !hundredsFact.hundreds) return null;
      return {
        key:key, kind:'hundreds', operation:hundredsOperation === 'divide' ? 'hundredsDivide' : 'hundredsMultiply',
        displayOperation:hundredsOperation, fact:hundredsFact,
        record:hundredsFact.hundreds[hundredsOperation]
      };
    }
    var isDivision = key.indexOf('d:') === 0;
    var baseKey = isDivision ? key.slice(2) : key;
    var fact = state.facts[baseKey];
    if (!fact) return null;
    return {
      key:isDivision ? divisionSkillKey(fact.a, fact.b) : baseKey,
      kind:'fact',
      operation:isDivision ? 'divide' : 'multiply',
      fact:fact,
      record:isDivision ? fact.division : fact
    };
  }

  function focusedFactsForTable(table){
    var cfg = state.config;
    var facts = [];
    for (var factor = cfg.min; factor <= cfg.max; factor++){
      var a = Math.min(table, factor);
      var b = Math.max(table, factor);
      var fact = state.facts[factKey(a, b)];
      if (fact) facts.push(fact);
    }
    return facts;
  }

  function hundredsPracticeSkills(){
    var skills = [];
    for (var a = 1; a <= 10; a++){
      for (var b = a; b <= 10; b++){
        skills.push(practiceSkill(hundredsSkillKey('multiply', a, b)));
        skills.push(practiceSkill(hundredsSkillKey('divide', a, b)));
      }
    }
    return skills.filter(function(skill){ return !!skill; });
  }

  function termPracticeSkills(){
    return TERM_CONCEPTS.map(function(concept){ return practiceSkill(termSkillKey(concept)); })
      .filter(function(skill){ return !!skill; });
  }

  function practiceSkillsInRange(focusTable, mode){
    if (isSemiMode(mode)) return semiSkillKeys(mode).map(practiceSkill);
    if (mode === 'written') return writtenSkillKeys().map(practiceSkill);
    if (mode === 'hundreds') return hundredsPracticeSkills();
    if (mode === 'terms') return termPracticeSkills();
    if (mode === 'riddles') return RIDDLE_TYPES.map(function(type){ return practiceSkill('r:' + type); });
    var skills = [];
    var facts = focusTable ? focusedFactsForTable(focusTable) : factsInRange();
    facts.forEach(function(fact){
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

  function skillIsDivision(skill){
    return skill.operation === 'divide' || skill.operation === 'hundredsDivide';
  }

  function buildQueue(size, focusTable, mode){
    var today = todayStr();
    mode = SESSION_MODES.indexOf(mode) === -1 ? (focusTable ? 'table' : 'mixed') : mode;
    var pool = shuffle(practiceSkillsInRange(focusTable, mode));
    // A focused table round should cover as many different members of the
    // selected row as its configured size permits. Mixed rounds keep the
    // normal limit for newly introduced facts.
    var broadMode = !!focusTable || mode === 'hundreds' || mode === 'terms' || mode === 'riddles' || mode === 'written' || isSemiMode(mode);
    var newLimit = Math.min(size, broadMode ? size : state.config.newFactsPerRound);
    var dueReviews = pool.filter(function(skill){ return skill.record.seen && skill.record.dueDate <= today; });
    var newCandidates = pool.filter(function(skill){ return !skill.record.seen; });

    // When division is enabled, every round with eligible division facts gets
    // one division slot. Prefer a due review, then a new division, and only
    // bring a future review forward when neither is available.
    var reservedDivision = null;
    if ((state.config.divisionEnabled || mode === 'hundreds') && mode !== 'terms' && size > 0){
      reservedDivision = dueReviews.filter(skillIsDivision)[0] ||
        newCandidates.filter(skillIsDivision)[0] || null;
      if (!reservedDivision){
        var futureDivisions = pool.filter(function(skill){
          return skillIsDivision(skill) && skill.record.seen && skill.record.dueDate > today;
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
    var plannedNew;
    if (broadMode){
      var availableFocusedSlots = Math.max(0, size - (reservedDivision ? 1 : 0));
      var focusedReviewSlots = Math.min(dueReviews.length, availableFocusedSlots);
      plannedNew = Math.min(remainingNewLimit, newCandidates.length,
        availableFocusedSlots - focusedReviewSlots);
    } else {
      plannedNew = Math.min(remainingNewLimit, newCandidates.length);
    }
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
    // Fill the configured round size by distributing repetitions as evenly
    // as possible without introducing more distinct new facts than allowed.
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
    while (chosen.length < size && repeatable.length){
      var lowestCount = Math.min.apply(null, repeatable.map(function(skill){
        return occurrenceCounts[skill.key] || 0;
      }));
      var fillers = repeatable.filter(function(skill){
        return (occurrenceCounts[skill.key] || 0) === lowestCount;
      });
      var filler = fillers[Math.floor(Math.random() * fillers.length)];
      chosen.push(filler);
      occurrenceCounts[filler.key] = (occurrenceCounts[filler.key] || 0) + 1;
    }
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
        mode: 'mixed',
        focusTable: null,
        requeueCounts: {},
        newFactKeys: []
      };
      state.today.queue = buildQueue(state.config.tasksPerDay, null, 'mixed');
      saveState();
    } else if (!state.today.queue || state.today.queue.length === 0){
      state.today.queue = buildQueue(state.config.tasksPerDay, state.today.focusTable, state.today.mode);
      saveState();
    } else if (state.today.index === 0 && (state.config.divisionEnabled || state.today.mode === 'hundreds') &&
               state.today.mode !== 'terms' &&
               state.today.queue.every(function(key){
                 var skill = practiceSkill(key);
                 return !skill || !skillIsDivision(skill);
               }) &&
               practiceSkillsInRange(state.today.focusTable, state.today.mode).some(skillIsDivision)){
      // Repair a not-yet-started queue created by older versions that could
      // omit division even though eligible facts existed.
      state.today.queue = buildQueue(state.config.tasksPerDay, state.today.focusTable, state.today.mode);
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

  function numericChoices(correct, step){
    var candidates = [correct - step, correct + step, correct + 2 * step,
      correct - 2 * step, correct + 3 * step, correct + 4 * step];
    var distractors = shuffle(candidates.filter(function(value){ return value >= 0 && value !== correct; })).slice(0, 3);
    return { correct:correct, options:shuffle(distractors.concat([correct])) };
  }

  function operationChoices(a, b, correct){
    // Different operations with the same operands reveal confusion about the
    // term. Use exact, nonnegative results and show coinciding answers once.
    var results = [correct, a + b, Math.abs(a - b), a * b];
    if (b !== 0 && a % b === 0) results.push(a / b);
    if (a !== 0 && b % a === 0) results.push(b / a);
    var options = results.filter(function(value, index, values){
      return values.indexOf(value) === index;
    });
    var anchor = options[Math.floor(Math.random() * options.length)];
    for (var distance = 1; options.length < 4; distance++){
      [anchor - distance, anchor + distance].forEach(function(value){
        if (options.length < 4 && value >= 0 && options.indexOf(value) === -1) options.push(value);
      });
    }
    return { correct:correct, options:shuffle(options) };
  }

  function hundredsChoices(correct, operation){
    var divide = operation === 'divide';
    // Include a missing/extra zero alongside nearby results.
    var scaleError = divide ? correct * 10 : correct / 10;
    var nearby = numericChoices(correct, divide ? 1 : 10).options.filter(function(value){
      return value !== correct && value !== scaleError;
    }).slice(0, 2);
    return { correct:correct, options:shuffle([correct, scaleError].concat(nearby)) };
  }

  function specialQuestion(skill){
    var a, b, correct, prompt, explanation;
    if (skill.kind === 'riddle') return riddleQuestion(skill.riddleType);
    if (skill.kind === 'hundreds'){
      var swap = Math.random() < 0.5;
      a = swap ? skill.fact.b : skill.fact.a;
      b = swap ? skill.fact.a : skill.fact.b;
      if (skill.displayOperation === 'divide'){
        prompt = (a * b * 10) + ' ÷ ' + (a * 10);
        correct = b;
      } else {
        prompt = (a * 10) + ' × ' + b;
        correct = a * b * 10;
      }
      return { prompt:prompt, gen:hundredsChoices(correct, skill.displayOperation) };
    }
    var concept = skill.concept;
    var operationNames = ['addition', 'subtraction', 'multiplication', 'division'].map(function(name){ return TERM_LABELS[name]; });
    var resultNames = ['sum', 'difference', 'product', 'quotient'].map(function(name){ return TERM_LABELS[name]; });
    var operationIndex = TERM_CONCEPTS.slice(0, 4).indexOf(concept);
    if (operationIndex !== -1){
      a = (Math.floor(Math.random() * 5) + 5) * 10;
      b = (Math.floor(Math.random() * 4) + 1) * 10;
      if (operationIndex === 2 || operationIndex === 3){
        a = Math.floor(Math.random() * 10) + 1;
        b = Math.floor(Math.random() * 10) + 1;
        if (operationIndex === 3) a *= b;
      }
      prompt = 'Wie heißt die Rechenart bei ' + a + ' ' + ['+', '−', '×', '÷'][operationIndex] + ' ' + b + '?';
      correct = operationNames[operationIndex];
      explanation = correct + ': Das Ergebnis heißt ' + resultNames[operationIndex] + '.';
      return { prompt:prompt, gen:{ correct:correct, options:shuffle(operationNames.slice()) }, explanation:explanation };
    }
    a = (Math.floor(Math.random() * 9) + 1) * 10;
    b = (Math.floor(Math.random() * 9) + 1) * 10;
    if (concept === 'sum'){
      prompt = 'Die Summe aus ' + a + ' und ' + b;
      correct = a + b;
      explanation = 'Addition: ' + a + ' + ' + b + ' = ' + correct + '. Das Ergebnis heißt Summe.';
    } else if (concept === 'difference'){
      var large = Math.max(a, b); b = Math.min(a, b); a = large;
      prompt = 'Die Differenz aus ' + a + ' und ' + b;
      correct = a - b;
      explanation = 'Subtraktion: ' + a + ' − ' + b + ' = ' + correct + '. Das Ergebnis heißt Differenz.';
    } else {
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      if (concept === 'product'){
        prompt = 'Das Produkt aus ' + a + ' und ' + b;
        correct = a * b;
        explanation = 'Multiplikation: ' + a + ' × ' + b + ' = ' + correct + '. Das Ergebnis heißt Produkt.';
      } else {
        var dividend = a * b;
        prompt = 'Der Quotient aus ' + dividend + ' und ' + a;
        correct = b;
        explanation = 'Division: ' + dividend + ' ÷ ' + a + ' = ' + correct + '. Das Ergebnis heißt Quotient.';
        b = a;
        a = dividend;
      }
    }
    return { prompt:prompt, gen:operationChoices(a, b, correct), explanation:explanation };
  }

  function riddleChoices(correct, mistakes){
    var options = [correct];
    mistakes.forEach(function(value){
      if (options.length < 4 && value >= 0 && value % 1 === 0 && options.indexOf(value) === -1){
        options.push(value);
      }
    });
    // Coinciding or negative error results need distinct, nearby fillers.
    var step = correct % 10 === 0 ? 10 : 5;
    for (var distance = 1; options.length < 4; distance++){
      [correct - distance * step, correct + distance * step].forEach(function(value){
        if (options.length < 4 && value >= 0 && options.indexOf(value) === -1) options.push(value);
      });
    }
    return { correct:correct, options:shuffle(options) };
  }

  function riddleQuestion(type){
    var a = (Math.floor(Math.random() * 9) + 2) * 10;
    var b = (Math.floor(Math.random() * 5) + 1) * 10;
    var intermediate, correct, prompt, explanation, mistakes;
    if (type === 'halfAdd' || type === 'halfSubtract'){
      intermediate = a / 2;
      if (type === 'halfSubtract') b = Math.min(b, intermediate);
      correct = type === 'halfAdd' ? intermediate + b : intermediate - b;
      mistakes = type === 'halfAdd'
        ? [a + b, (a + b) / 2, intermediate, intermediate - b]
        : [a - b, (a - b) / 2, intermediate, intermediate + b];
      prompt = type === 'halfAdd'
        ? 'Addiere die Hälfte von ' + a + ' mit ' + b + '.'
        : 'Ziehe ' + b + ' von der Hälfte von ' + a + ' ab.';
      explanation = 'Die Hälfte von ' + a + ' ist ' + intermediate + '. Dann: ' + intermediate +
        (type === 'halfAdd' ? ' + ' : ' − ') + b + ' = ' + correct + '.';
    } else if (type === 'doubleAdd' || type === 'doubleSubtract'){
      intermediate = a * 2;
      if (type === 'doubleSubtract') b = Math.min(b, intermediate);
      correct = type === 'doubleAdd' ? intermediate + b : intermediate - b;
      mistakes = type === 'doubleAdd'
        ? [a + b, (a + b) * 2, intermediate, intermediate - b]
        : [a - b, (a - b) * 2, intermediate, intermediate + b];
      prompt = type === 'doubleAdd'
        ? 'Meine Zahl ist die Summe aus dem Doppelten von ' + a + ' und ' + b + '.'
        : 'Subtrahiere ' + b + ' vom Doppelten von ' + a + '.';
      explanation = 'Das Doppelte von ' + a + ' ist ' + intermediate + '. Dann: ' + intermediate +
        (type === 'doubleAdd' ? ' + ' : ' − ') + b + ' = ' + correct + '.';
    } else if (type === 'sumDouble'){
      intermediate = a + b;
      correct = intermediate * 2;
      mistakes = [a * 2 + b, a * 2 - b, intermediate, a + b * 2];
      prompt = 'Verdopple die Summe aus ' + a + ' und ' + b + '.';
      explanation = a + ' + ' + b + ' = ' + intermediate + '. Das Doppelte davon ist ' + correct + '.';
    } else if (type === 'differenceHalf'){
      a *= 2; b *= 2;
      var large = Math.max(a, b); b = Math.min(a, b); a = large;
      intermediate = a - b;
      correct = intermediate / 2;
      mistakes = [intermediate, a / 2 - b, a - b / 2, (a + b) / 2];
      prompt = 'Halbiere die Differenz aus ' + a + ' und ' + b + '.';
      explanation = a + ' − ' + b + ' = ' + intermediate + '. Die Hälfte davon ist ' + correct + '.';
    } else {
      a = Math.floor(Math.random() * 9) + 2;
      var factor = Math.floor(Math.random() * 9) + 2;
      intermediate = type === 'productAdd' ? a * factor : factor;
      prompt = type === 'productAdd'
        ? 'Addiere zum Produkt aus ' + a + ' und ' + factor + ' die Zahl ' + b + '.'
        : 'Addiere zum Quotienten aus ' + (a * factor) + ' und ' + a + ' die Zahl ' + b + '.';
      correct = intermediate + b;
      mistakes = type === 'productAdd'
        ? [a + factor + b, a * (factor + b), intermediate, intermediate - b]
        : [a * factor + b, (a * factor) / (a + b), intermediate, intermediate - b, intermediate * b];
      explanation = type === 'productAdd'
        ? a + ' × ' + factor + ' = ' + intermediate + '.'
        : (a * factor) + ' ÷ ' + a + ' = ' + intermediate + '.';
      explanation += ' Dann: ' + intermediate + ' + ' + b + ' = ' + correct + '.';
    }
    return { prompt:prompt, gen:riddleChoices(correct, mistakes), explanation:explanation };
  }

  // ---------- Confetti ----------
  var CONFETTI_COLORS = ['#6c5ce7','#fdcb6e','#00b894','#e17055','#0984e3','#e84393'];
  var confettiLayer = null;
  function clearConfetti(){
    if (confettiLayer) confettiLayer.remove();
    confettiLayer = null;
  }
  function launchConfetti(){
    clearConfetti();
    var layer = document.createElement('div');
    confettiLayer = layer;
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
    setTimeout(function(){ if (confettiLayer === layer) clearConfetti(); }, 5000);
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
  var screenTablePractice = document.getElementById('screen-table-practice');
  var screenQuestion = document.getElementById('screen-question');
  var screenDone = document.getElementById('screen-done');

  var homeGreeting = document.getElementById('homeGreeting');
  var homeSubtitle = document.getElementById('homeSubtitle');
  var streakVal = document.getElementById('streakVal');
  var todayVal = document.getElementById('todayVal');
  var startBtn = document.getElementById('startBtn');
  var bonusBtn = document.getElementById('bonusBtn');
  var tablePracticeBtn = document.getElementById('tablePracticeBtn');
  var hundredsBtn = document.getElementById('hundredsBtn');
  var termsBtn = document.getElementById('termsBtn');
  var riddlesBtn = document.getElementById('riddlesBtn');
  var writtenBtn = document.getElementById('writtenBtn');
  var writtenForm = document.getElementById('writtenDivisionForm');
  var practiceTableGrid = document.getElementById('practiceTableGrid');
  var tablePracticeBackBtn = document.getElementById('tablePracticeBackBtn');
  var rewardBtn = document.getElementById('rewardBtn');
  var rewardNote = document.getElementById('rewardNote');

  var progressDots = document.getElementById('progressDots');
  var questionText = document.getElementById('questionText');
  var choicesWrap = document.getElementById('choicesWrap');
  var feedbackText = document.getElementById('feedbackText');
  var abortSessionBtn = document.getElementById('abortSessionBtn');

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
  var sessionRevision = 0;
  var questionExplanation = '';
  var rewardGameChoiceOrigin = null;

  function showScreen(screen){
    el('screen-semi-intro').classList.toggle('active',screen===el('screen-semi-intro'));
    if (screen !== screenDone) clearConfetti();
    if(fullscreenScreen && fullscreenScreen!==screen)exitGameFullscreen();
    ['screen-home','screen-question','screen-table-practice','screen-done','screen-stickers','screen-statistics','screen-achievements','screen-game-choice','screen-game','screen-flappy','screen-tower','screen-gravity','screen-brick','screen-snake','screen-snow','screen-runner','screen-doodle','screen-tiles','screen-maze','screen-asteroid'].map(el).forEach(function(s){s.classList.toggle('active',s===screen);});
    var game=[screenGame,screenFlappy,screenTower,el('screen-gravity'),el('screen-brick'),el('screen-snake'),el('screen-snow'),el('screen-runner'),el('screen-doodle'),el('screen-tiles'),el('screen-maze'),el('screen-asteroid')].indexOf(screen)!==-1;
    gearBtn.style.display=game || screen===screenQuestion?'none':'';
    profileBtn.style.display=game || screen===screenQuestion || Object.keys(root.profiles).length<2?'none':'';
    abortSessionBtn.style.display=!game && screen!==screenHome?'':'none';
    abortSessionBtn.setAttribute('aria-label',screen===screenQuestion?'Runde abbrechen und zurück zur Startseite':'Zurück');
    abortSessionBtn.setAttribute('title',screen===screenQuestion?'Runde abbrechen und zurück zur Startseite':'Zurück');
    var focused=game || screen===screenQuestion;
    document.body.classList.toggle('focused-view',focused);
    el('appBar').hidden=game;
    var selected=screen===screenGameChoice?'navGames':screen===el('screen-statistics')||screen===el('screen-achievements')||screen===screenStickers?'navStatistics':'navLearn';
    ['navLearn','navGames','navStatistics'].forEach(function(id){el(id).setAttribute('aria-current',id===selected?'page':'false');});
    if(screen===screenGameChoice)renderGameAvailability();
    if(game)enterGameFullscreen(screen);
    screen.scrollTop=0;window.scrollTo(0,0);
  }
  function renderStatistics(){
    var day=todayStr(),today=state.history[day]||{correct:0,wrong:0},week=0,total=0;
    Object.keys(state.history).forEach(function(date){var h=state.history[date],count=h.correct+h.wrong;total+=count;if(date>=addDays(day,-6)&&date<=day)week+=count;});
    text('statToday',today.correct+today.wrong);text('statWeek',week);text('statTotal',total);text('statGames',state.reward.gamesPlayed||0);
    var since=state.reward.gamesTrackedSince||day;text('statGamesSince','Erfasst seit '+since.slice(8,10)+'.'+since.slice(5,7)+'.'+since.slice(0,4));
    showScreen(el('screen-statistics'));
  }
  function renderAchievements(){
    var day=todayStr(),streak=state.lastCompletedDate===day||state.lastCompletedDate===addDays(day,-1)?state.streak:0;
    text('achievementSummary',streak+' Tage Lernserie · '+state.badges.length+' Abzeichen');el('achievementBadges').textContent='';
    [3,7,14,30,60,100].forEach(function(n){var badge=document.createElement('span');badge.className='badge'+(state.badges.indexOf(n)!==-1?'':' locked');iconLabel(badge,n+' Tage',state.badges.indexOf(n)!==-1?'award':'lock');el('achievementBadges').appendChild(badge);});
    showScreen(el('screen-achievements'));
  }
  function renderGameAvailability(){
    var plays=state.reward.availablePlays; text('gameAvailability',plays?plays+(plays===1?' Spiel freigeschaltet':' Spiele freigeschaltet'):'Verdiene dein nächstes Spiel mit einer Lernrunde.');
    ['Dino','Flappy','Tower','Gravity','Brick','Snake','Snow','Runner','Doodle','Tiles','Maze','Asteroid'].forEach(function(name){el('choose'+name+'Btn').disabled=plays<1;});
  }
  el('navLearn').addEventListener('click',renderHome);
  el('navGames').addEventListener('click',function(){rewardGameChoiceOrigin=screenHome;showScreen(screenGameChoice);});
  el('navStatistics').addEventListener('click',renderStatistics);
  el('achievementsBtn').addEventListener('click',renderAchievements);el('achievementsBackBtn').addEventListener('click',renderStatistics);

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

  function repeatRoundLabel(recoveryPending){
    if (recoveryPending) return 'Serie retten: zweite Runde 🔥';
    if (isSemiMode(state.today.mode)) return 'Noch einmal: ' + semiModeLabel(state.today.mode) + ' 🔁';
    if (state.today.mode === 'hundreds') return 'Noch einmal: Rechnen mit 100ern 🔁';
    if (state.today.mode === 'terms') return 'Noch einmal: Rechenbegriffe 🔁';
    if (state.today.mode === 'riddles') return 'Noch einmal: Zahlenrätsel 🔁';
    if (state.today.mode === 'written') return 'Noch einmal: Schriftlich dividieren 🔁';
    return state.today.focusTable
      ? 'Noch einmal: ' + state.today.focusTable + 'er-Reihe 🔁'
      : 'Noch einmal 🔁';
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
      iconLabel(profileBtn, name || 'Profil', 'user');
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
      bonusBtn.textContent = recoveryPending
        ? 'Serie retten: zweite Runde 🔥'
        : 'Gemischte Runde spielen 🚀';
    } else {
      startBtn.style.display = 'block';
      bonusBtn.style.display = 'none';
      startBtn.textContent = state.today.index > 0
        ? "Weiter üben! 🚀"
        : (recoveryPending ? "Erste Rettungsrunde starten 🔥" : "Los geht's! 🚀");
    }
    [[startBtn,'play'],[bonusBtn,'play'],[tablePracticeBtn,'cards'],[hundredsBtn,'cards'],[termsBtn,'chat'],[riddlesBtn,'cards'],[writtenBtn,'cards'],[el('semiBtn'),'cards']].forEach(function(item){
      iconLabel(item[0],item[0].textContent.replace(/ (🚀|🔥|🔢|💬|🧩)/g,''),item[1]);
    });
    showScreen(screenHome);
  }

  function startSession(bonus, focusTable, mode){
    sessionRevision++;
    sessionRewardUnlocks = 0;
    var selectedTable = parseInt(focusTable, 10);
    var focused = configuredTables().indexOf(selectedTable) !== -1;
    var specialMode = mode === 'hundreds' || mode === 'terms' || mode === 'riddles' || mode === 'written' || isSemiMode(mode);
    if (bonus || focused || specialMode){
      state.today.focusTable = focused ? selectedTable : null;
      state.today.mode = specialMode ? mode : (focused ? 'table' : 'mixed');
      state.today.queue = buildQueue(state.config.tasksPerDay, state.today.focusTable, state.today.mode);
      state.today.index = 0;
      state.today.correct = 0;
      state.today.bonus = !!bonus;
      state.today.requeueCounts = {};
      saveState();
    }
    showScreen(screenQuestion);
    renderQuestion();
  }

  function abortSession(){
    // Answers and rewards are saved immediately in onAnswer(). Only discard
    // the unfinished round, never its learning records or earned rewards.
    sessionRevision++;
    answering = false;
    awaitTap = false;
    state.today.index = 0;
    state.today.correct = 0;
    state.today.bonus = false;
    state.today.mode = 'mixed';
    state.today.focusTable = null;
    state.today.requeueCounts = {};
    state.today.newFactKeys = [];
    state.today.queue = buildQueue(state.config.tasksPerDay, null, 'mixed');
    saveState();
    renderHome();
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

  function renderMathText(element, value){
    // Keep calculations intact, while the surrounding sentence wraps normally.
    // Use DOM nodes rather than HTML so all text stays literal and safe.
    element.textContent = '';
    var expression = /[0-9?▢]+(?:[ \t]*(?:[+−\-×*÷/:=]|und)[ \t]*[0-9?▢]+)+/g;
    var match, cursor = 0;
    while ((match = expression.exec(value)) !== null){
      if (match.index > cursor) element.appendChild(document.createTextNode(value.slice(cursor, match.index)));
      var group = document.createElement('span');
      group.className = 'math-expression';
      group.textContent = match[0];
      element.appendChild(group);
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) element.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function setQuestionText(value){
    if (questionText.classList.contains('word-question')) renderMathText(questionText, value);
    else questionText.textContent = value;
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
    questionExplanation = '';
    writtenForm.hidden = skill.kind !== 'written';
    el('semiDivisionForm').hidden = skill.kind !== 'semi';
    questionText.hidden = skill.kind === 'written' || skill.kind === 'semi';
    choicesWrap.hidden = skill.kind === 'written' || skill.kind === 'semi';
    if (skill.kind === 'semi'){
      feedbackText.textContent = '';feedbackText.className = 'feedback';awaitTap = false;choicesWrap.innerHTML = '';
      questionStartTime = Date.now();renderSemiDivision(key,semiDivisionQuestion(skill));return;
    }
    if (skill.kind === 'written'){
      feedbackText.textContent = '';
      feedbackText.className = 'feedback';
      awaitTap = false;
      choicesWrap.innerHTML = '';
      questionStartTime = Date.now();
      renderWrittenDivision(key, writtenDivisionQuestion(skill));
      return;
    }
    questionText.classList.toggle('word-question', skill.kind === 'term' || skill.kind === 'riddle');
    choicesWrap.classList.toggle('word-choices', skill.kind === 'term');
    if (skill.kind === 'hundreds' || skill.kind === 'term' || skill.kind === 'riddle'){
      var special = specialQuestion(skill);
      gen = special.gen;
      questionExplanation = special.explanation || '';
      fmt = function(val){ return special.prompt + ' = ' + val; };
      placeholder = '?';
      setQuestionText(special.prompt);
    } else if (skill.operation === 'divide'){
      var divideByA = state.today.focusTable === f.a
        ? true
        : (state.today.focusTable === f.b ? false : (f.a === f.b || Math.random() < 0.5));
      var divisor = divideByA ? f.a : f.b;
      var quotient = divideByA ? f.b : f.a;
      var dividend = f.a * f.b;
      gen = genDivisionChoices(quotient);
      fmt = function(val){ return dividend + " ÷ " + divisor + " = " + val; };
      placeholder = "?";
      setQuestionText(dividend + " ÷ " + divisor);
    } else {
      // Facts are stored with a <= b; show both orders so 3×8 and 8×3 get practiced.
      var swapFactors = state.today.focusTable === f.b
        ? true
        : (state.today.focusTable === f.a ? false : Math.random() < 0.5);
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
      setQuestionText(gapTask ? fmt(placeholder) : (fx + " × " + fy));
    }
    feedbackText.textContent = '';
    feedbackText.className = 'feedback';
    awaitTap = false;

    choicesWrap.innerHTML = '';
    var answerMode = state.config.answerMode;
    if (answerMode === 'adaptive') answerMode = skill.record.seen && skill.record.box >= 2 ? 'input' : 'choice';
    if (typeof gen.correct === 'string') answerMode = 'choice';
    if (answerMode === 'input'){
      renderKeypad(key, fmt, gen.correct, placeholder, fmt(gen.correct));
    } else {
      choicesWrap.classList.remove('keypad');
      gen.options.forEach(function(opt){
        var btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = opt;
        btn.dataset.answer = String(opt);
        btn.addEventListener('click', function(){
          if (answering && gapTask) setQuestionText(fmt(gen.correct));
          onAnswer(key, opt, gen.correct, btn, false, fmt(gen.correct));
        });
        choicesWrap.appendChild(btn);
      });
    }

    questionStartTime = Date.now();
  }

  function renderSemiDivision(key,exercise){
    var form=el('semiDivisionForm'),revision=sessionRevision,remaining=exercise.dividend,parts=[],quotients=[],phase='parts';
    form.innerHTML='';
    function node(tag,cls,value){var n=document.createElement(tag);n.className=cls||'';if(value!==undefined)n.textContent=value;return n;}
    function field(label,id){
      var wrapper=node('label','semi-field',label),input=node('input','semi-input');
      input.id=id;input.type='text';input.inputMode='numeric';input.pattern='[0-9]*';input.maxLength=3;input.value='';input.placeholder='?';input.autocomplete='off';
      input.setAttribute('aria-label',label);input.setAttribute('enterkeyhint','next');wrapper.appendChild(input);return {wrapper:wrapper,input:input};
    }
    function focus(input){input.focus();if(input.setSelectionRange)input.setSelectionRange(0,(input.value||'').length);}
    function live(){return answering&&revision===sessionRevision;}
    function say(message,bad){feedbackText.className='feedback '+(bad?'bad':'good');feedbackText.textContent=message;}
    form.appendChild(node('h2','written-title',semiModeLabel(exercise.mode)));
    form.appendChild(node('p','semi-problem',exercise.dividend+' : '+exercise.divisor+' = ?'));
    var progress=node('p','semi-remaining'),breakdown=node('p','semi-breakdown');progress.setAttribute('aria-live','polite');
    form.appendChild(progress);form.appendChild(breakdown);
    var history=node('ol','semi-steps');form.appendChild(history);
    var work=node('div','semi-work'),chunk=field('Teil zum Dividieren','semiChunk'),result=field('Teilergebnis','semiPartResult');
    work.appendChild(chunk.wrapper);work.appendChild(node('span','semi-operator',': '+exercise.divisor+' ='));work.appendChild(result.wrapper);form.appendChild(work);
    chunk.input.readOnly=exercise.mode==='semi';
    chunk.input.addEventListener('keydown',function(event){if(event.key==='Enter'&&live()){event.preventDefault();focus(result.input);}});
    var tip=node('button','secondary-btn','Tipp anzeigen');tip.type='button';form.appendChild(tip);
    var tipText=node('p','semi-tip');tipText.setAttribute('role','status');form.appendChild(tipText);
    tip.addEventListener('click',function(){
      if(!live())return;
      var part=semiSuggestedPart(remaining,exercise.divisor);
      tipText.textContent=phase==='parts'?'Ein möglicher Teil ist '+part+'. Nutze die passende Einmaleins-Aufgabe und die Stellenwerte. Andere passende Teile sind auch richtig.':phase==='total'?'Addiere deine Teilergebnisse: '+quotients.join(' + ')+'. Ein Rest ist kleiner als '+exercise.divisor+'.':'Multipliziere das Ergebnis mit '+exercise.divisor+' und addiere gegebenenfalls den Rest. Du erhältst die Zahl aus der Aufgabe.';
    });
    var final=node('div','semi-final'),total=field('Summe deiner Teilergebnisse','semiTotal'),rest=field('Rest','semiRest');
    final.hidden=true;final.appendChild(node('p','','Addiere jetzt deine Teilergebnisse.'));
    final.appendChild(total.wrapper);if(exercise.mode==='semiRest')final.appendChild(rest.wrapper);form.appendChild(final);
    total.input.addEventListener('keydown',function(event){if(event.key==='Enter'&&exercise.mode==='semiRest'&&live()){event.preventDefault();focus(rest.input);}});
    var proof=node('div','semi-proof'),probe=field('Ergebnis der Probe','semiProbe'),proofEquation=node('p','semi-breakdown');
    proof.hidden=true;proof.appendChild(proofEquation);proof.appendChild(probe.wrapper);form.appendChild(proof);
    var check=node('button','secondary-btn','Teilrechnung prüfen');check.type='submit';form.appendChild(check);
    function update(){
      progress.textContent='Noch aufzuteilen: '+remaining;
      breakdown.textContent=parts.length?'Zerlegt: '+parts.join(' + ')+(remaining?' + '+remaining:'')+' = '+exercise.dividend:'Zerlege die '+exercise.dividend+' in Teile, die durch '+exercise.divisor+' teilbar sind. Die '+exercise.divisor+' bleibt immer gleich.';
      chunk.input.value=exercise.mode==='semi'?String(semiSuggestedPart(remaining,exercise.divisor)):'';result.input.value='';tipText.textContent='';
      focus(exercise.mode==='semi'?result.input:chunk.input);
    }
    form.onsubmit=function(event){
      event.preventDefault();if(!live())return;
      if(phase==='parts'){
        var error=checkSemiPart(exercise,remaining,chunk.input.value,result.input.value);
        if(error){say(error,true);return;}
        var part=Number(chunk.input.value),q=Number(result.input.value);
        parts.push(part);quotients.push(q);remaining-=part;
        history.appendChild(node('li','',part+' : '+exercise.divisor+' = '+q));
        if(remaining>=exercise.divisor){update();say('Das stimmt! Wähle den nächsten passenden Teil.');return;}
        phase='total';work.hidden=true;final.hidden=false;check.textContent='Ergebnis prüfen';tipText.textContent='';
        progress.textContent=remaining?'Es bleiben '+remaining+' übrig. Das ist kleiner als '+exercise.divisor+'.':'Alles verteilt – es bleibt kein Rest.';
        breakdown.textContent=parts.join(' + ')+(remaining?' + '+remaining:'')+' = '+exercise.dividend;
        say('Gut zerlegt! Addiere jetzt '+quotients.join(' + ')+'.');focus(total.input);return;
      }
      if(phase==='total'){
        if(!/^[0-9]{1,4}$/.test(total.input.value)||exercise.mode==='semiRest'&&!/^[0-9]{1,4}$/.test(rest.input.value)){say('Trage das Ergebnis'+(exercise.mode==='semiRest'?' und den Rest':'')+' ein.',true);return;}
        var enteredRest=exercise.mode==='semiRest'?Number(rest.input.value):0;
        if(enteredRest>=exercise.divisor){say('Der Rest muss kleiner als '+exercise.divisor+' sein. Du kannst sonst noch weiter teilen.',true);focus(rest.input);return;}
        if(Number(total.input.value)!==exercise.correct||enteredRest!==exercise.rest){
          var chosen=String(Number(total.input.value))+(exercise.mode==='semiRest'?' Rest '+enteredRest:'');
          var correct=String(exercise.correct)+(exercise.mode==='semiRest'?' Rest '+exercise.rest:'');
          check.disabled=true;total.input.disabled=true;rest.input.disabled=true;
          questionExplanation='Addiere deine Teilergebnisse: '+quotients.join(' + ')+' = '+exercise.correct+(exercise.rest?'. Rest: '+exercise.rest:'')+'.';
          onAnswer(key,chosen,correct,null,true,exercise.dividend+' : '+exercise.divisor+' = '+correct);return;
        }
        phase='proof';final.hidden=true;proof.hidden=false;check.textContent='Probe prüfen';tipText.textContent='';
        proofEquation.textContent='Probe: '+exercise.correct+' × '+exercise.divisor+(exercise.rest?' + '+exercise.rest:'')+' = ?';
        say('Das Ergebnis stimmt. Prüfe es jetzt mit der Umkehraufgabe.');focus(probe.input);return;
      }
      if(!/^[0-9]{1,4}$/.test(probe.input.value)||Number(probe.input.value)!==exercise.dividend){say('Prüfe die Multiplikation'+(exercise.rest?' und addiere den Rest':'')+' noch einmal.',true);focus(probe.input);return;}
      check.disabled=true;probe.input.disabled=true;
      var answer=String(exercise.correct)+(exercise.mode==='semiRest'?' Rest '+exercise.rest:'');
      questionExplanation='Dein Rechenweg passt: '+quotients.join(' + ')+' = '+exercise.correct+'. Probe: '+exercise.correct+' × '+exercise.divisor+(exercise.rest?' + '+exercise.rest:'')+' = '+exercise.dividend+'.';
      onAnswer(key,answer,answer,null,true,exercise.dividend+' : '+exercise.divisor+' = '+answer);
    };
    update();
  }

  function renderWrittenDivision(key, exercise){
    writtenForm.innerHTML = '';
    var revision = sessionRevision;
    var currentStep = 0;
    var rows = [];
    var places = ['Hunderter', 'Zehner', 'Einer'];

    function focusField(input){
      input.focus();
      if (input.setSelectionRange) input.setSelectionRange(0, (input.value || '').length);
    }
    function numberGroup(label, fixedValue){
      var group = { element:document.createElement('div'), inputs:[] };
      group.element.className = 'written-number';
      group.element.setAttribute('role', 'group');
      group.element.setAttribute('aria-label', label);
      var digits = fixedValue === undefined ? null : ('00' + fixedValue).slice(-3);
      places.forEach(function(place, index){
        var cell = document.createElement(digits ? 'span' : 'input');
        cell.className = 'written-digit';
        cell.dataset.place = place;
        if (digits){
          cell.textContent = digits[index];
        } else {
          cell.type = 'text';
          cell.inputMode = 'numeric';
          cell.maxLength = 1;
          cell.placeholder = '?';
          cell.autocomplete = 'off';
          cell.value = '';
          cell.setAttribute('aria-label', label + ': ' + place);
          cell.setAttribute('enterkeyhint', 'next');
          group.inputs.push(cell);
        }
        group.element.appendChild(cell);
      });
      return group;
    }
    function enable(group, enabled){
      group.inputs.forEach(function(input){ input.disabled = !enabled; });
    }
    function value(group){
      return Number(group.inputs.map(function(input){ return input.value || '0'; }).join(''));
    }
    function invalidField(group, expected){
      var digits = ('00' + expected).slice(-3);
      var invalid = null;
      group.inputs.forEach(function(input, index){
        var correct = (input.value === '' || /^\d$/.test(input.value)) && Number(input.value || 0) === Number(digits[index]);
        input.setAttribute('aria-invalid', correct ? 'false' : 'true');
        if (!correct && !invalid) invalid = input;
      });
      return invalid;
    }
    function wireInputs(inputs){
      inputs.forEach(function(input, index){
        function advance(){
          if (!answering || revision !== sessionRevision || input.disabled) return;
          if (index + 1 < inputs.length) focusField(inputs[index + 1]);
          else writtenForm.onsubmit({ preventDefault:function(){} });
        }
        input.addEventListener('input', function(){
          input.value = input.value.replace(/[^0-9]/g, '').slice(-1);
          input.removeAttribute('aria-invalid');
          if (input.value !== '') advance();
        });
        input.addEventListener('keydown', function(event){
          if (event.key === 'Enter'){
            event.preventDefault();
            advance();
          } else if ((event.key === 'Backspace' && input.value === '' || event.key === 'ArrowLeft') && index > 0){
            event.preventDefault(); focusField(inputs[index - 1]);
          } else if (event.key === 'ArrowRight' && index + 1 < inputs.length){
            event.preventDefault(); focusField(inputs[index + 1]);
          }
        });
      });
    }
    function separator(){
      var span = document.createElement('span');
      span.className = 'written-operator';
      span.textContent = ': ' + exercise.divisor + ' =';
      return span;
    }
    var title = document.createElement('h2');
    title.className = 'written-title';
    title.textContent = 'Schriftlich dividieren';
    writtenForm.appendChild(title);
    var totalRow = document.createElement('div');
    totalRow.className = 'written-equation written-total';
    totalRow.appendChild(numberGroup('Aufgabe: ' + exercise.dividend, exercise.dividend).element);
    totalRow.appendChild(separator());
    var total = numberGroup('Gesamtergebnis');
    enable(total, false);
    wireInputs(total.inputs);
    total.inputs[2].setAttribute('enterkeyhint', 'done');
    totalRow.appendChild(total.element);
    writtenForm.appendChild(totalRow);
    var hint = document.createElement('p');
    hint.className = 'written-hint';
    hint.textContent = 'Achte auf die Stellen: Hunderter, Zehner, Einer. Leere Felder zählen als 0. Mit Enter oder Weiter überspringst du eine Stelle. Rechne zuerst die Teilrechnungen, danach das Ergebnis oben.';
    writtenForm.appendChild(hint);
    exercise.steps.forEach(function(step, index){
      var row = document.createElement('div');
      row.className = 'written-equation written-row';
      var chunk = numberGroup('Teilrechnung ' + (index + 1) + ': Zahl zum Teilen');
      var result = numberGroup('Teilrechnung ' + (index + 1) + ': Ergebnis');
      enable(chunk, index === 0); enable(result, index === 0);
      row.appendChild(chunk.element);
      row.appendChild(separator());
      row.appendChild(result.element);
      writtenForm.appendChild(row);
      rows.push({ element:row, chunk:chunk, result:result });
      wireInputs(chunk.inputs.concat(result.inputs));
    });
    var check = document.createElement('button');
    check.type = 'submit';
    check.className = 'secondary-btn';
    check.textContent = 'Teilrechnung prüfen';
    writtenForm.appendChild(check);
    writtenForm.onsubmit = function(event){
      event.preventDefault();
      if (!answering || revision !== sessionRevision) return;
      if (currentStep < rows.length){
        var row = rows[currentStep];
        var step = exercise.steps[currentStep];
        var invalidChunk = invalidField(row.chunk, step.dividend);
        var invalidResult = invalidField(row.result, step.quotient);
        var invalid = invalidChunk || invalidResult;
        if (invalid){
          feedbackText.className = 'feedback bad';
          feedbackText.textContent = 'Prüfe diese Teilrechnung und ihre Stellen noch einmal. Beginne mit der größten Stelle des Ergebnisses.';
          focusField(invalid);
          return;
        }
        enable(row.chunk, false); enable(row.result, false);
        row.element.classList.add('written-correct');
        currentStep++;
        feedbackText.className = 'feedback good';
        feedbackText.textContent = currentStep === rows.length
          ? 'Alle Teilrechnungen stimmen! Addiere die Teilergebnisse und trage das Ergebnis oben ein.'
          : 'Richtig! Jetzt die nächste Teilrechnung.';
        if (currentStep === rows.length){
          enable(total, true);
          check.textContent = 'Ergebnis prüfen';
          focusField(total.inputs[0]);
        } else {
          enable(rows[currentStep].chunk, true); enable(rows[currentStep].result, true);
          focusField(rows[currentStep].chunk.inputs[0]);
        }
        return;
      }
      enable(total, false); check.disabled = true;
      invalidField(total, exercise.correct);
      onAnswer(key, value(total), exercise.correct, null, true,
        exercise.dividend + ' : ' + exercise.divisor + ' = ' + exercise.correct);
    };
    focusField(rows[0].chunk.inputs[0]);
  }

  function renderKeypad(key, fmt, correct, placeholder, masteryLabel){
    var typedAnswer = '';
    function updateEquation(){
      setQuestionText(fmt(typedAnswer === '' ? placeholder : typedAnswer));
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
          setQuestionText(fmt(correct));
          onAnswer(key, chosen, correct, null, true, masteryLabel);
          return;
        } else if (typedAnswer.length < 4){
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
      if (b.dataset.answer === String(correct)) b.classList.add('correct');
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

    if (questionExplanation) feedbackText.textContent += ' ' + questionExplanation;
    renderMathText(feedbackText, feedbackText.textContent);
    state.today.index++;
    saveState();

    var answerRevision = sessionRevision;
    if (isCorrect){
      setTimeout(function(){
        if (answerRevision === sessionRevision) renderQuestion();
      }, questionExplanation ? 4500 : (newlyMastered ? 2400 : CORRECT_ADVANCE_DELAY_MS));
    } else {
      setTimeout(function(){
        if (answerRevision === sessionRevision) awaitTap = true;
      }, WRONG_TAP_DELAY_MS);
    }
  }

  var BADGE_MILESTONES = [7, 14, 30, 60, 100];

  function replaceDuplicateStickers(stickers){
    var missing = shuffle(STICKER_POOL.filter(function(emoji){
      return !stickers.some(function(sticker){ return sticker.emoji === emoji; });
    }));
    var seen = {};
    // Preserve the oldest copy, all dates and the album's original order.
    stickers.slice().sort(function(a, b){
      return String(a.date).localeCompare(String(b.date));
    }).forEach(function(sticker){
      if (seen[sticker.emoji] && missing.length) sticker.emoji = missing.pop();
      seen[sticker.emoji] = true;
    });
  }

  function pickNextSticker(stickers){
    var counts = {};
    STICKER_POOL.forEach(function(emoji){ counts[emoji] = 0; });
    var latest = null;
    (stickers || []).forEach(function(sticker){
      if (Object.prototype.hasOwnProperty.call(counts, sticker.emoji)) counts[sticker.emoji]++;
      if (!latest || sticker.date >= latest.date) latest = sticker;
    });
    var candidates = STICKER_POOL.filter(function(emoji){
      return !latest || emoji !== latest.emoji;
    });
    var lowestCount = Math.min.apply(null, candidates.map(function(emoji){ return counts[emoji]; }));
    candidates = candidates.filter(function(emoji){ return counts[emoji] === lowestCount; });
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function finishSession(){
    var wasBonus = state.today.bonus;
    var focusedTable = state.today.focusTable;
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
        newSticker = pickNextSticker(state.stickers);
        state.stickers.push({ date: today, emoji: newSticker });
      }
      if (state.today.mode === 'mixed' || state.today.mode === 'table') unlockedTable = maybeUnlockNextTable();
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
        : (focusedTable
          ? (wasBonus
            ? "Du hast die " + focusedTable + "er-Reihe noch einmal geschafft! 🌈"
            : "Du hast die " + focusedTable + "er-Reihe geschafft!")
          : (wasBonus ? "Noch eine Runde geschafft! Extra-Übung hilft immer. 🌈"
            : "Du hast alle Aufgaben für heute geschafft.")));
    doneStreakVal.textContent = state.streak;
    if (!recoveryPending && !streakRecovered && ['hundreds', 'terms', 'riddles', 'written','semi','semiFree','semiRest'].indexOf(state.today.mode) !== -1){
      doneSubtitle.textContent = { hundreds:'Rechnen mit 100ern geschafft! 🌟',
        terms:'Rechenbegriffe geübt! 🌟', riddles:'Zahlenrätsel gelöst! 🌟', written:'Schriftlich dividiert! 🌟',semi:'Halbschriftlich dividiert! 🌟',semiFree:'Deinen eigenen Rechenweg gefunden! 🌟',semiRest:'Mit Rest dividiert! 🌟' }[state.today.mode];
    }
    doneCorrectVal.textContent = state.today.correct + "/" + state.today.queue.length;
    doneRewardGameBtn.style.display = state.reward.availablePlays > 0 ? 'block' : 'none';
    doneRewardGameBtn.style.marginBottom = state.reward.availablePlays > 0 ? '12px' : '';
    doneBonusBtn.style.display = 'block';
    doneBonusBtn.textContent = repeatRoundLabel(recoveryPending);
    iconLabel(doneBonusBtn, doneBonusBtn.textContent.replace(/ (🔁|🔥)/g, ''), 'retry');
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
    if (e.target.closest && e.target.closest('.gear-btn, .modal-overlay, #abortSessionBtn')) return;
    awaitTap = false;
    renderQuestion();
  }
  document.addEventListener('click', tapAdvance);
  document.addEventListener('touchstart', tapAdvance, { passive: true });

  startBtn.addEventListener('click', function(){ startSession(false); });
  function navigateBack(){
    if (screenQuestion.classList.contains('active')) abortSession();
    else if (screenStickers.classList.contains('active') || el('screen-achievements').classList.contains('active')) renderStatistics();
    else if (screenGameChoice.classList.contains('active')) gameChoiceBackBtn.click();
    else renderHome();
  }
  abortSessionBtn.addEventListener('click', navigateBack);
  // Match the header back action; never intercept a game's swipe controls.
  var edgeBackTouch=null;
  function canSwipeBack(){return !fullscreenScreen&&abortSessionBtn.style.display!=='none'&&!document.querySelector('.modal-overlay.active');}
  document.addEventListener('touchstart',function(e){
    edgeBackTouch=null;
    if(!canSwipeBack()||e.touches.length!==1)return;
    var touch=e.touches[0],target=e.target;
    if(touch.clientX>32||target&&target.closest&&target.closest('input,textarea,select,[contenteditable="true"]'))return;
    edgeBackTouch={id:touch.identifier,x:touch.clientX,y:touch.clientY,time:performance.now(),screen:document.querySelector('.screen.active')};
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!edgeBackTouch)return;
    if(e.touches.length!==1){edgeBackTouch=null;return;}
    var touch=e.touches[0],dx=touch.clientX-edgeBackTouch.x,dy=Math.abs(touch.clientY-edgeBackTouch.y);
    if(touch.identifier!==edgeBackTouch.id||dx<-8||dy>20&&dy>Math.abs(dx)*.7){edgeBackTouch=null;return;}
    if(dx>16&&dx>dy*2&&e.cancelable)e.preventDefault();
  },{passive:false});
  document.addEventListener('touchend',function(e){
    var start=edgeBackTouch;edgeBackTouch=null;
    if(!start||!canSwipeBack()||e.touches.length||start.screen!==document.querySelector('.screen.active'))return;
    var touch=Array.from(e.changedTouches).find(function(t){return t.identifier===start.id;});if(!touch)return;
    var dx=touch.clientX-start.x,dy=Math.abs(touch.clientY-start.y);
    if(dx<72||dy>dx*.45||performance.now()-start.time>900)return;
    if(e.cancelable)e.preventDefault();
    navigateBack();
  },{passive:false});
  document.addEventListener('touchcancel',function(){edgeBackTouch=null;},{passive:true});

  bonusBtn.addEventListener('click', function(){ startSession(true, null); });
  doneBonusBtn.addEventListener('click', function(){ startSession(true, state.today.focusTable, state.today.mode); });
  hundredsBtn.addEventListener('click', function(){ startSession(state.today.completed, null, 'hundreds'); });
  termsBtn.addEventListener('click', function(){ startSession(state.today.completed, null, 'terms'); });
  riddlesBtn.addEventListener('click', function(){ startSession(state.today.completed, null, 'riddles'); });
  writtenBtn.addEventListener('click', function(){ startSession(state.today.completed, null, 'written'); });
  el('semiBtn').addEventListener('click',function(){showScreen(el('screen-semi-intro'));});
  ['semi','semiFree','semiRest'].forEach(function(mode){
    el(mode+'StartBtn').addEventListener('click',function(){startSession(state.today.completed,null,mode);});
  });
  el('semiIntroBackBtn').addEventListener('click',renderHome);
  tablePracticeBtn.addEventListener('click', function(){
    practiceTableGrid.innerHTML = '';
    configuredTables().forEach(function(table){
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'practice-table-btn';
      button.textContent = table + 'er-Reihe';
      button.addEventListener('click', function(){
        startSession(state.today.completed, table);
      });
      practiceTableGrid.appendChild(button);
    });
    showScreen(screenTablePractice);
  });
  tablePracticeBackBtn.addEventListener('click', function(){ renderHome(); });
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
    state.reward.gamesPlayed=(state.reward.gamesPlayed||0)+1;
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
    var elapsed = rewardGame.startedAt ? gameElapsedMs(rewardGame) : 0;
    var survivalPoints = Math.floor(Math.min(elapsed, GAME_DURATION_MS) / 1000);
    return survivalPoints + rewardGame.bonusScore;
  }

  function updateGameHud(){
    if (!rewardGame) return;
    var elapsed = rewardGame.startedAt ? gameElapsedMs(rewardGame) : 0;
    var remaining = GAME_DURATION_MS - elapsed;
    var difficulty = rewardGameDifficulty(elapsed);
    gameTime.textContent = remaining <= 0 ? "0:00 · letzter Versuch" : formatGameTime(remaining);
    gameAttempts.textContent = "Versuch: " + Math.min(rewardGame.attempts + 1, rewardGame.maxAttempts) +
      "/" + rewardGame.maxAttempts;
    gameScore.textContent = "Punkte: " + rewardGameScore() + " · Rekord: " + state.reward.bestDinoScore;
    gameLevel.textContent = "Stufe: " + difficulty.level + "/6";
    var superRemaining = Math.max(0, rewardGame.superUntil - gameTimeStamp(rewardGame));
    gameStars.textContent = superRemaining
      ? "Sterne: " + rewardGame.stars + " · Super: " + Math.ceil(superRemaining / 1000) + " s"
      : "Sterne: " + rewardGame.stars + " · Super " + rewardGame.powerStars + "/3";
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

  function jumpRewardDino(){if(rewardGame&&rewardGame.pausedAt!=null)return;
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
    if (rewardGame.timeExpired || gameElapsedMs(rewardGame) >= GAME_DURATION_MS){
      rewardGame.timeExpired = true;
      finishRewardGame("Zeit geschafft!", "Dein letzter laufender Versuch ist jetzt beendet — super gespielt!");
      return;
    }

    gameOverlayTitle.textContent = "Autsch! Noch " + (rewardGame.maxAttempts - rewardGame.attempts) +
      (rewardGame.maxAttempts - rewardGame.attempts === 1 ? " Versuch" : " Versuche");
    gameOverlayText.textContent = "Gleich geht es weiter …";
    gameOverlay.hidden = false;
    var currentGame = rewardGame;
    setTimeout(function(){
      if (rewardGame !== currentGame || !rewardGame.active) return;
      if (gameElapsedMs(rewardGame) >= GAME_DURATION_MS){
        rewardGame.timeExpired = true;
        finishRewardGame("Zeit geschafft!", "Nach drei Minuten startet kein weiterer Versuch — super gespielt!");
        return;
      }
      var dino=rewardGame.dino;dino.y=188;dino.vy=0;dino.grounded=true;
      rewardGame.obstacles=rewardGame.obstacles.filter(function(o){return o.x>dino.x+dino.w+45||o.x+o.w<dino.x;});
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
    gameOverlayText.textContent = message + " · " + rewardGame.stars + " Sterne · beste Combo " +
      rewardGame.bestCombo + " · " + finalScore + " Punkte" +
      (isRecord ? " · Neuer Rekord!" : " · Rekord: " + state.reward.bestDinoScore);
    gameOverlay.hidden = false;
    updatePlayAgainButton(gameAgainBtn, false);
    playFanfareSound();
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
      rewardGame.superUntil = gameTimeStamp(rewardGame) + 5000;
      playFanfareSound();
    }
  }

  function updateRewardGame(dt){
    var game = rewardGame;
    if (!game.running) return;
    dt=activeGameStep(game,dt);if(!dt)return;
    var dino = game.dino;
    var groundY = 226;

    dino.vy += 1250 * dt;
    dino.y += dino.vy * dt;
    if (dino.y + dino.h >= groundY){
      dino.y = groundY - dino.h;
      dino.vy = 0;
      dino.grounded = true;
    }

    var difficulty = rewardGameDifficulty(gameElapsedMs(game));
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
        if (gameTimeStamp(game) < game.superUntil){
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
    sky.addColorStop(0, '#16192f');
    sky.addColorStop(1, '#795069');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 480, 270);


    ctx.fillStyle = 'rgba(122,119,155,.45)';
    game.clouds.forEach(function(cloud){
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 14, 0, Math.PI * 2);
      ctx.arc(cloud.x + 17, cloud.y - 5, 18, 0, Math.PI * 2);
      ctx.arc(cloud.x + 36, cloud.y, 13, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#535442';
    ctx.fillRect(0, 226, 480, 44);
    ctx.fillStyle = '#8c7958';
    ctx.fillRect(0, 226, 480, 5);
    drawHalloweenSky(ctx,480,270,gameElapsedMs(game)/1000,false);drawPumpkin(ctx,452,249,12);

    if (!game || !game.dino) return;
    game.obstacles.forEach(function(obstacle){
      if (obstacle.type === 'flying'){
        ctx.fillStyle = '#e17055';
        ctx.beginPath();
        ctx.ellipse(obstacle.x + 19, obstacle.y + 13, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        var flap = Math.sin(gameElapsedMs(game) / 90) * 5;
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
    var superActive = gameTimeStamp(game) < game.superUntil;
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
      ? ['#e84393','#fdcb6e','#00b894','#0984e3'][Math.floor(gameElapsedMs(game) / 100) % 4]
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
    if(rewardGame.pausedAt!=null){rewardGame.lastFrame=now;rewardGameFrame=requestAnimationFrame(runRewardGame);return;}
    var elapsed = rewardGame.startedAt ? gameElapsedMs(rewardGame) : 0;
    if (elapsed >= GAME_DURATION_MS){finishRewardGame("Drei Minuten geschafft!","Super gespielt!");return;}

    simulateGameFrame(rewardGame,now,updateRewardGame);
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
    if(gameControlKey(e))return;
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
    exitGameFullscreen();
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
      ? Math.floor(Math.min(gameElapsedMs(flappyGame), GAME_DURATION_MS) / 1000)
      : 0;
    return survival + flappyGame.passed * 25;
  }

  function updateFlappyHud(){
    if (!flappyGame) return;
    var elapsed = flappyGame.startedAt ? gameElapsedMs(flappyGame) : 0;
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

  function flapRewardBird(){if(flappyGame&&flappyGame.pausedAt!=null)return;
    if (!flappyGame || !flappyGame.active) return;
    if (flappyGame.awaitingStart){
      if (flappyGame.startedAt && gameElapsedMs(flappyGame) >= GAME_DURATION_MS){
        finishFlappyGame('Zeit geschafft!', 'Nach drei Minuten startet kein weiterer Versuch — super gespielt!');
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
    if (gameElapsedMs(flappyGame) >= GAME_DURATION_MS){
      finishFlappyGame('Zeit geschafft!', 'Dein letzter laufender Versuch ist jetzt beendet — super gespielt!');
      return;
    }
    var bird=flappyGame.bird,pipe=flappyGame.pipes.find(function(o){return o.x<bird.x+bird.w+20&&o.x+o.w>bird.x;});
    bird.y=pipe?pipe.gapTop+(pipe.gap-bird.h)/2:Math.max(30,Math.min(280,bird.y));bird.vy=0;
    flappyGame.awaitingStart=true;
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
      (isRecord ? ' · Neuer Rekord!' : ' · Rekord: ' + state.reward.bestFlappyScore);
    flappyOverlay.hidden = false;
    updatePlayAgainButton(flappyAgainBtn, flappyGame.isDemo);
    playFanfareSound();
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
    dt=activeGameStep(game,dt);if(!dt)return;
    var bird = game.bird;
    var elapsed = gameElapsedMs(game);
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
    var wingY = Math.sin(gameElapsedMs(flappyGame) / 70) * 4;
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
    var decorTime=flappyGame&&flappyGame.startedAt?(gameElapsedMs(flappyGame))/1000:0,zone=Math.floor(decorTime/45)%3;
    sky.addColorStop(0,['#201b39','#362440','#101a32'][zone]);sky.addColorStop(1,['#76536e','#8a5664','#434c6d'][zone]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 480, 360);
    if (!flappyGame) return;
    ctx.fillStyle = 'rgba(144,132,163,.35)';
    flappyGame.clouds.forEach(drawFlappyCloud);
    ctx.fillStyle=['#514761','#624559','#303f59'][zone];
    for(var i=0;i<7;i++){var hillX=((i*115-decorTime*10)%780+780)%780-150;ctx.beginPath();ctx.moveTo(hillX,320);ctx.lineTo(hillX+90,220+(i%3)*15);ctx.lineTo(hillX+190,320);ctx.fill();}
    if(zone===2)for(var i=0;i<20;i++){ctx.fillRect((i*73)%480,18+(i*41)%155,2,2);}
    else if(Math.floor(decorTime/12)%2===1){ctx.fillStyle='#dc89a8';ctx.beginPath();ctx.ellipse(400-(decorTime*7)%500,105,14,20,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#bca78d';ctx.beginPath();ctx.moveTo(400-(decorTime*7)%500,125);ctx.lineTo(400-(decorTime*7)%500,150);ctx.stroke();}
    drawHalloweenSky(ctx,480,360,decorTime,false);
    flappyGame.pipes.forEach(drawFlappyPipe);
    drawFlappyBird(flappyGame.bird);
    ctx.fillStyle = '#4a5148'; ctx.fillRect(0, 320, 480, 40);
    ctx.fillStyle = '#9b825b'; ctx.fillRect(0, 320, 480, 6);drawPumpkin(ctx,455,343,10);
    for(var i=0;i<12;i++){var flowerX=((i*47-decorTime*14)%500+500)%500;ctx.fillStyle=['#ef96af','#f3d079','#abbef9'][i%3];ctx.beginPath();ctx.arc(flowerX,338+(i%3)*6,3,0,Math.PI*2);ctx.fill();}
  }

  function runFlappyGame(now){
    if (!flappyGame || !flappyGame.active) return;
    if(flappyGame.pausedAt!=null){flappyGame.lastFrame=now;flappyGameFrame=requestAnimationFrame(runFlappyGame);return;}
    if(flappyGame.startedAt&&gameElapsedMs(flappyGame)>=GAME_DURATION_MS){finishFlappyGame("Drei Minuten geschafft!","Super geflattert!");return;}
    simulateGameFrame(flappyGame,now,updateFlappyGame);
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
    exitGameFullscreen();
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
    var elapsed = towerGame.startedAt ? gameElapsedMs(towerGame) : 0;
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
    towerGame.cameraY = 0;
    towerGame.altitudeNotice = null;
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
    if (towerGame.startedAt && gameElapsedMs(towerGame) >= GAME_DURATION_MS){
      finishTowerGame('Zeit geschafft!', 'Nach drei Minuten startet kein weiterer Versuch — super gebaut!');
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

  function placeTowerBlock(){if(towerGame&&towerGame.pausedAt!=null)return;
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
    // Keep fixed world coordinates. The camera moves the entire scene, so
    // ground and scenery descend together rather than leaving grass attached.
    towerGame.cameraY = Math.max(0, 120 - moving.y);
    if (towerGame.height % 10 === 0){
      towerGame.altitudeNotice = { text:towerGame.height + '. Etage · ' +
        (towerGame.height < 20 ? 'Vogelflug!' : towerGame.height < 30 ? 'Flughöhe erreicht!' :
          towerGame.height % 20 === 10 ? 'Shuttle voraus!' : 'Hallo, Raumstation!'),
        until:gameElapsedMs(towerGame) + 3500 };
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
    if (gameElapsedMs(towerGame) >= GAME_DURATION_MS){
      finishTowerGame('Zeit geschafft!', 'Dein letzter laufender Turm ist jetzt beendet — super gebaut!');
      return;
    }
    createTowerMovingBlock();towerGame.awaitingStart=true;
    towerOverlayTitle.textContent = 'Knapp! Noch ' + (GAME_MAX_ATTEMPTS - towerGame.attempts) +
      (GAME_MAX_ATTEMPTS - towerGame.attempts === 1 ? ' Versuch' : ' Versuche');
    towerOverlayText.textContent = 'Tippe, um deinen Turm weiterzubauen.';
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
      (isRecord ? ' · Neuer Rekord!' : ' · Rekord: ' + state.reward.bestTowerScore);
    towerOverlay.hidden = false;
    updatePlayAgainButton(towerAgainBtn, towerGame.isDemo);
    playFanfareSound();
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
    dt=activeGameStep(towerGame,dt);if(!dt)return;
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

  function towerSceneSpec(height, cameraY){
    var objects = [];
    function add(kind, level){
      var y = 438 - level * TOWER_BLOCK_HEIGHT - 80 + cameraY;
      if (height >= level && y > -90 && y < 540) objects.push({ kind:kind, level:level, y:y });
    }
    [10, 14, 18].forEach(function(level){ add('birds', level); });
    [20, 24, 28].forEach(function(level){ add('plane', level); });
    for (var level = Math.max(30, Math.floor((height - 25) / 10) * 10); level <= height; level += 10){
      add(level % 20 === 10 ? 'shuttle' : 'station', level);
    }
    return { space:Math.max(0, Math.min(1, (height - 20) / 10)), groundY:465 + cameraY, objects:objects };
  }

  function towerBlendColor(from, to, blend){
    return 'rgb(' + from.map(function(value, index){ return Math.round(value + (to[index] - value) * blend); }).join(',') + ')';
  }

  function drawTowerSkyObject(object, time, space){
    var ctx = towerCtx;
    ctx.save();
    if (object.kind === 'birds'){
      ctx.globalAlpha = 1 - space;
      var x = (time * 32 + object.level * 47) % 620 - 70;
      for (var bird = 0; bird < 3; bird++){
        var bx = x + bird * 28, by = object.y + Math.sin(time * 2 + bird) * 7 + bird % 2 * 12;
        var wing = Math.sin(time * 9 + bird) * 8;
        ctx.strokeStyle = '#384e69'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx - 11, by - wing); ctx.quadraticCurveTo(bx - 4, by - 7, bx, by);
        ctx.quadraticCurveTo(bx + 4, by - 7, bx + 11, by - wing); ctx.stroke();
        ctx.fillStyle = '#ffd36c'; ctx.beginPath(); ctx.moveTo(bx + 2, by); ctx.lineTo(bx + 7, by + 2); ctx.lineTo(bx + 2, by + 4); ctx.fill();
      }
    } else if (object.kind === 'plane'){
      ctx.globalAlpha = 1 - space;
      ctx.translate((time * 26 + object.level * 61) % 720 - 120, object.y);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#477397'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-38, -5); ctx.lineTo(-47, -24); ctx.lineTo(-35, -24); ctx.lineTo(-20, -8);
      ctx.lineTo(32, -8); ctx.quadraticCurveTo(55, -6, 60, 2); ctx.quadraticCurveTo(50, 10, -36, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ef8e78'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-25, 29); ctx.lineTo(-10, 29); ctx.lineTo(20, 4); ctx.fill();
      ctx.fillStyle = '#66b9dc'; for (var window = 0; window < 5; window++) ctx.fillRect(-18 + window * 11, -3, 6, 5);
      ctx.strokeStyle = '#7493ab'; ctx.beginPath(); ctx.moveTo(-43, 1); ctx.lineTo(-66, 1); ctx.stroke();
      ctx.fillStyle = '#fff5b9'; ctx.fillRect(-142, -12, 76, 25); ctx.fillStyle = '#705a43'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Mathe-Air', -104, 5);
    } else {
      var left = Math.floor(object.level / 10) % 4 >= 2;
      ctx.translate((left ? 100 : 365) + Math.sin(time * .7 + object.level) * 18, object.y + Math.sin(time + object.level) * 6);
      if (object.kind === 'shuttle'){
        ctx.rotate(-.35);
        ctx.fillStyle = '#ffce68'; ctx.beginPath(); ctx.moveTo(-8, 27); ctx.lineTo(Math.sin(time * 12) * 5, 52); ctx.lineTo(8, 27); ctx.fill();
        ctx.fillStyle = '#edf6ff'; ctx.strokeStyle = '#869bb7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -35); ctx.quadraticCurveTo(13, -19, 10, 9); ctx.lineTo(29, 29); ctx.lineTo(7, 23); ctx.lineTo(-7, 23); ctx.lineTo(-29, 29); ctx.lineTo(-10, 9); ctx.quadraticCurveTo(-13, -19, 0, -35); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#65bee4'; ctx.fillRect(-5, -14, 10, 7);
        ctx.strokeStyle = '#2c425d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-27, 28); ctx.lineTo(-8, 22); ctx.lineTo(8, 22); ctx.lineTo(27, 28); ctx.stroke();
      } else {
        ctx.rotate(Math.sin(time * .2) * .12);
        ctx.strokeStyle = '#b6c7df'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-57, 0); ctx.lineTo(57, 0); ctx.stroke();
        ctx.fillStyle = '#4579cb'; ctx.strokeStyle = '#9dc9ff'; ctx.lineWidth = 1;
        [-57, 29].forEach(function(x){ ctx.fillRect(x, -24, 28, 48); ctx.strokeRect(x, -24, 28, 48);
          for (var grid = 1; grid < 4; grid++){ ctx.beginPath(); ctx.moveTo(x, -24 + grid * 12); ctx.lineTo(x + 28, -24 + grid * 12); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(x + 14, -24); ctx.lineTo(x + 14, 24); ctx.stroke();
        });
        ctx.fillStyle = '#e6eaf4'; ctx.fillRect(-22, -9, 44, 18); ctx.fillRect(-9, -23, 18, 46);
        ctx.fillStyle = '#74d7dd'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d5e1f2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(8, -34); ctx.stroke();
        ctx.fillStyle = '#ffdb7d'; ctx.beginPath(); ctx.arc(9, -35, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTowerGame(){
    if (!towerGame) return;
    var g = towerGame, ctx = towerCtx, camera = g.cameraY || 0;
    var scene = towerSceneSpec(g.height, camera), time = gameElapsedMs(g) / 1000;
    var sky = ctx.createLinearGradient(0, 0, 0, 480);
    sky.addColorStop(0, towerBlendColor([27,24,49], [7,12,36], scene.space));
    sky.addColorStop(1, towerBlendColor([119,70,88], [26,16,64], scene.space));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 480, 480);drawHalloweenSky(ctx,480,480,time,false);
    if (scene.space > 0){
      ctx.save(); ctx.globalAlpha = scene.space;
      for (var star = 0; star < 48; star++){
        ctx.fillStyle = star % 4 === 0 ? '#ffe5a0' : '#e9f3ff';
        var size = star % 7 === 0 ? 3 : 1.5;
        ctx.fillRect((star * 137 + 29) % 480, ((star * 83 + camera * .15) % 480 + 480) % 480, size, size);
      }
      ctx.restore();
    }
    // Clouds and distant hills move down too; nothing stays glued to the floor.
    ctx.save(); ctx.globalAlpha = 1 - scene.space; ctx.fillStyle = 'rgba(255,255,255,.7)';
    [0, 1, 2].forEach(function(index){
      var x = 50 + index * 165 + Math.sin(time * .2 + index) * 12;
      var y = 65 + index % 2 * 35 + camera * .6;
      if (y > 530) return;
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.arc(x + 23, y - 8, 26, 0, Math.PI * 2); ctx.arc(x + 49, y + 2, 18, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    if (scene.groundY < 560){
      ctx.fillStyle = '#a6ca85'; ctx.beginPath(); ctx.moveTo(0, scene.groundY); ctx.quadraticCurveTo(90, scene.groundY - 65, 200, scene.groundY); ctx.quadraticCurveTo(350, scene.groundY - 80, 480, scene.groundY); ctx.fill();
    }
    if (scene.groundY < 480){
      ctx.fillStyle = '#b8dc87'; ctx.fillRect(0, scene.groundY, 480, 15);
      ctx.fillStyle = '#7fba66'; ctx.fillRect(0, scene.groundY, 480, 4);
    }
    scene.objects.forEach(function(object){ drawTowerSkyObject(object, time, scene.space); });
    ctx.save(); ctx.translate(0, camera);
    g.blocks.forEach(function(block){
      if (block.y + camera + block.h >= 0 && block.y + camera <= 480) drawTowerBlock(block);
    });
    if (g.moving) drawTowerBlock(g.moving);
    ctx.restore();
    if (g.altitudeNotice && gameElapsedMs(g) < g.altitudeNotice.until){
      ctx.fillStyle = scene.space > .5 ? '#fff0a9' : '#3c526b'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.altitudeNotice.text, 240, 28);
    }
    if (g.flash > 0){
      ctx.fillStyle = 'rgba(255,255,255,' + (g.flash * 2) + ')'; ctx.fillRect(0, 0, 480, 480);
    }
  }

  function runTowerGame(now){
    if (!towerGame || !towerGame.active) return;
    if(towerGame.pausedAt!=null){towerGame.lastFrame=now;towerGameFrame=requestAnimationFrame(runTowerGame);return;}
    if(towerGame.startedAt&&gameElapsedMs(towerGame)>=GAME_DURATION_MS){finishTowerGame("Drei Minuten geschafft!","Super gebaut!");return;}
    simulateGameFrame(towerGame,now,updateTowerGame);
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
    exitGameFullscreen();
    stopTowerGame();
    renderHome();
  });
  towerAgainBtn.addEventListener('click', function(){
    stopTowerGame();
    openRewardGameChoice();
  });


  // Gravity Run: one-touch gravity, scrolling terrain and automatic recovery.
  var gravityGame=null, gravityFrame=null;
  var gravityCtx=el('gravityCanvas').getContext('2d');
  var GRAVITY_HOME_X=302, GRAVITY_ACCEL=530/(.5*.5); // 265 px crossing in 0.5 seconds.
  function resetGravityAttempt(){
    var g=gravityGame;
    g.elapsed=0;g.distance=0;g.spawnIn=1;g.wave=0;g.patternBag=[];g.patternHistory=[];g.patternPoolKey="";
    g.obstacles=[];g.gaps=[];g.platforms=[];g.items=[];g.superUntil=0;g.nextPowerAt=10;g.section="Auftakt";
    g.player={x:GRAVITY_HOME_X,y:293,w:36,h:39,vy:0,vx:0,gravity:1,grounded:true};
    g.running=false;g.awaitingStart=true;
  }
  function gravityScore(){return gravityGame?Math.floor(gravityGame.totalDistance/12)+gravityGame.bonusScore:0;}
  function updateGravityHud(){
    var g=gravityGame;if(!g)return;
    el('gravityTime').textContent=formatGameTime(Math.max(0,GAME_DURATION_MS-(g.startedAt?gameElapsedMs(g):0)));
    el('gravityAttempts').textContent='Versuch: '+Math.min(3,g.attempts+1)+'/3';
    el('gravityScore').textContent='Punkte: '+gravityScore();
    el('gravityBest').textContent='Rekord: '+state.reward.bestGravityScore;
    el('gravityLevel').textContent=g.section+' · '+gravityDifficulty(g.elapsed).level+'/6';
    el('gravityCoins').textContent='Münzen: '+g.coins+' · +'+g.bonusScore;
  }
  function startGravityGame(demo){
    if(demo!==true&&state.reward.availablePlays<1)return;
    stopGravityGame();
    gravityGame={active:true,isDemo:demo===true,rewardConsumed:false,startedAt:null,attempts:0,totalDistance:0,bonusScore:0,coins:0,lastFrame:performance.now()};
    resetGravityAttempt();el('gravityAgainBtn').style.display='none';
    el('gravityOverlayTitle').textContent='Bereit?';el('gravityOverlayText').textContent='Tippe zum Starten. Danach wechselt jedes Tippen die Schwerkraft.';el('gravityOverlay').hidden=false;
    showScreen(el('screen-gravity'));updateGravityHud();drawGravityGame();gravityFrame=requestAnimationFrame(runGravityGame);
  }
  function gravityTap(){if(gravityGame&&gravityGame.pausedAt!=null)return;
    var g=gravityGame;if(!g||!g.active)return;
    if(g.awaitingStart){
      if(g.startedAt&&gameElapsedMs(g)>=GAME_DURATION_MS){finishGravityGame('Zeit geschafft!');return;}
      if(!g.startedAt){if(!g.isDemo&&!consumeRewardPlay(g))return;g.startedAt=Date.now();}
      g.running=true;g.awaitingStart=false;g.lastFrame=performance.now();el('gravityOverlay').hidden=true;return;
    }
    if(g.running&&g.player.grounded){g.player.gravity*=-1;g.player.vy=0;g.player.grounded=false;}
  }
  function saveGravityRecord(){if(gravityGame&&gravityScore()>state.reward.bestGravityScore){state.reward.bestGravityScore=gravityScore();saveState();}}
  function finishGravityGame(title){
    var g=gravityGame;g.active=false;g.running=false;saveGravityRecord();updateGravityHud();
    el('gravityOverlayTitle').textContent=title;el('gravityOverlayText').textContent=gravityScore()+' Punkte · Deine nächste Belohnung wartet beim nächsten Lernziel.';el('gravityOverlay').hidden=false;updatePlayAgainButton(el('gravityAgainBtn'),g.isDemo);if(g.isDemo){el('gravityAgainBtn').style.display='block';el('gravityAgainBtn').textContent='Nochmal spielen';}
  }
  function loseGravityAttempt(){
    var g=gravityGame;if(!g.running)return;g.running=false;g.attempts++;playWrongSound();saveGravityRecord();
    if(g.attempts>=3||gameElapsedMs(g)>=GAME_DURATION_MS){finishGravityGame(g.attempts>=3?'Drei Versuche gespielt!':'Zeit geschafft!');return;}
    recoverGravity();el('gravityOverlayTitle').textContent='Noch '+(3-g.attempts)+' Versuche';el('gravityOverlayText').textContent='Tippe, um an dieser Stelle weiterzulaufen!';el('gravityOverlay').hidden=false;
  }
  function stopGravityGame(){saveGravityRecord();if(gravityFrame)cancelAnimationFrame(gravityFrame);gravityFrame=null;gravityGame=null;}
  function gravityDifficulty(elapsed){
    var level=Math.min(6,1+Math.floor(elapsed/15));
    return {level:level,speed:312+Math.min(108,elapsed*1.2),interval:1.65-(level-1)*.1,gapChance:.35+(level-1)*.065,pairedChance:(level-1)*.11};
  }
  function gravitySuperRemaining(){return gravityGame?Math.max(0,(gravityGame.superUntil-gameTimeStamp(gravityGame))/1000):0;}
  function collectGravityItems(){
    var g=gravityGame,p=g.player;
    g.items=g.items.filter(function(item){
      var dx=Math.max(p.x,Math.min(p.x+p.w,item.x))-item.x,dy=Math.max(p.y,Math.min(p.y+p.h,item.y))-item.y;
      if(dx*dx+dy*dy>item.r*item.r)return item.x+item.r>-20;
      if(item.type==='coin'){g.coins++;g.bonusScore+=20;}else{g.superUntil=gameTimeStamp(g)+10000;}
      return false;
    });
  }
  function recoverGravity(){
    var g=gravityGame,p=g.player;p.x=GRAVITY_HOME_X;p.vx=0;p.vy=0;p.gravity=1;p.y=293;p.grounded=true;
    // Remove only the hazard at the recovery point, not the world or its progression.
    g.obstacles=g.obstacles.filter(function(o){return o.x>p.x+p.w+50||o.x+o.w<p.x-50;});
    g.gaps=g.gaps.filter(function(o){return o.x>p.x+p.w+50||o.x+o.w<p.x-50;});
    g.awaitingStart=true;
  }
  var GRAVITY_SECTIONS=['Sprungtreppe','Slalom','Schluchtbrücken','Doppeldecker','Tunnel','Schluchtenwechsel','Inselkette','Mittelkorridor','Münzenbogen','Wolkenstufen','Tiefflug','Wechseltore','Trittsteine','Doppelbrücke','Münzensprint','Weggabelung','Zickzack','Felsenschlucht'];
  function nextGravityPattern(g,d){
    var pool=g.elapsed<10?[0,1,5,6,8,10,11,14]:GRAVITY_SECTIONS.map(function(_,i){return i;});
    var key=pool.join(',');
    if(!g.patternBag.length||g.patternPoolKey!==key){
      g.patternBag=pool.slice();g.patternPoolKey=key;
      for(var i=g.patternBag.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=g.patternBag[i];g.patternBag[i]=g.patternBag[j];g.patternBag[j]=v;}
    }
    var index=g.patternBag.findIndex(function(pattern){return g.patternHistory.indexOf(pattern)===-1;});
    if(index<0)index=0;
    var pattern=g.patternBag.splice(index,1)[0];g.patternHistory.push(pattern);if(g.patternHistory.length>3)g.patternHistory.shift();
    return pattern;
  }
  function spawnGravityTerrain(){
    var g=gravityGame,d=gravityDifficulty(g.elapsed),side=Math.random()<.5?1:-1,x=820,span=0;
    var pattern=nextGravityPattern(g,d),count=d.level===1?2:3,step=d.speed*(.82+Math.random()*.24),height=44+d.level*5;
    g.lastPattern=pattern;g.section=GRAVITY_SECTIONS[pattern];
    function block(at,lane,h,w){g.obstacles.push({x:at,y:lane===1?332-h:28,w:w,h:h});}
    function gap(at,lane,w){g.gaps.push({x:at,w:w,side:lane});}
    function platform(at,y,w){g.platforms.push({x:at,y:y,w:w,h:12});}
    function coins(at,y,n,spacing){for(var i=0;i<n;i++)g.items.push({x:at+i*spacing,y:y,r:9,type:'coin'});}
    function laneCoins(at,lane,n,spacing){coins(at,lane===1?307:53,n,spacing);}
    if(pattern===0){
      var stair=105+Math.random()*40;for(var i=0;i<count;i++)block(x+i*stair,side,35+i*19,38+Math.random()*14);
      coins(x+20,side===1?225:133,count*2,50);span=(count-1)*stair+55;
    }else if(pattern===1){
      for(var i=0;i<count;i++){var lane=i%2?-side:side;block(x+i*step,lane,height,50);laneCoins(x+i*step+65,-lane,2,42);}span=step*(count-1)+150;
    }else if(pattern===2){
      gap(x,side,210);gap(x+300,side,180);platform(x-55,174,560);coins(x+20,154,8,60);span=505;
    }else if(pattern===3){
      platform(x-50,154,280);platform(x+300,198,260);block(x,side,68,48);gap(x+220,side,180);coins(x+20,134,4,50);coins(x+330,178,4,50);span=560;
    }else if(pattern===4){
      block(x,side,90,110);platform(x-50,174,360);gap(x+210,-side,150);coins(x+10,side===1?214:146,5,55);span=360;
    }else if(pattern===5){
      for(var i=0;i<count-1;i++){var at=x+i*(step+190),lane=i%2?-side:side;gap(at,lane,140+d.level*8);laneCoins(at+20,-lane,3,46);}span=(count-2)*(step+190)+220;
    }else if(pattern===6){
      var islands=d.level===1?1:3;for(var i=0;i<islands;i++){gap(x+i*270,side,145+d.level*5);laneCoins(x+i*270+25,-side,3,45);}span=(islands-1)*270+210;
    }else if(pattern===7){
      platform(x-90,174,600);for(var i=0;i<3;i++){block(x+i*190,1,90,55);block(x+i*190,-1,80,55);}coins(x-30,154,10,58);span=510;
    }else if(pattern===8){
      block(x,side,height,65);block(x+175,side,height+18,50);for(var i=0;i<8;i++)coins(x-10+i*50,side===1?260-Math.sin(i/7*Math.PI)*110:100+Math.sin(i/7*Math.PI)*110,1,0);span=400;
    }else if(pattern===9){
      for(var i=0;i<3;i++){var py=[130,208,164][i];platform(x-45+i*230,py,165);coins(x-20+i*230,py-20,3,48);}block(x+180,side,65,65);span=620;
    }else if(pattern===10){
      block(x,side,150+d.level*3,200+Math.random()*80);laneCoins(x+15,-side,6,42);span=290;
    }else if(pattern===11){
      block(x,side,height,70);gap(x+80,side,130+d.level*8);laneCoins(x,-side,5,45);
      if(d.level>1){block(x+step+250,-side,height,60);gap(x+step+315,-side,150);laneCoins(x+step+250,side,5,45);span=step+510;}else span=260;
    }else if(pattern===12){
      gap(x,side,480);for(var i=0;i<3;i++){platform(x-55+i*210,side===1?232:116,155);coins(x-30+i*210,side===1?212:148,3,45);}span=575;
    }else if(pattern===13){
      gap(x,side,180);gap(x+step+230,-side,180);platform(x-50,174,240);platform(x+step+180,174,240);coins(x,154,4,48);coins(x+step+230,206,4,48);span=step+430;
    }else if(pattern===14){
      for(var i=0;i<count;i++)block(x+i*100,side,32+i*12,34);laneCoins(x-10,-side,9,43);span=380;
    }else if(pattern===15){
      platform(x-70,174,600);gap(x+60,side,340);block(x+120,-side,65,70);coins(x-20,154,9,60);laneCoins(x+80,-side,5,48);span=560;
    }else if(pattern===16){
      for(var i=0;i<3;i++){var lane=i%2?-side:side;block(x+i*step,lane,70,90);platform(x+i*step-45,lane===1?210:138,160);coins(x+i*step, lane===1?190:170,3,42);}span=step*2+160;
    }else{
      block(x,side,70,65);gap(x+90,side,210);platform(x-55,174,425);block(x+410,-side,80,75);coins(x-20,154,7,55);span=530;
    }
    // Later stages add a separate gap, with a full flip's clear approach.
    if(d.level>=4&&Math.random()<.65){gap(x+span+140,side,150+d.level*8);laneCoins(x+span+150,-side,4,48);span+=400;}
    if(g.elapsed>=g.nextPowerAt){
      g.section+=' · Heldenroute';var platformY=170;
      platform(x+span+120,platformY,260);g.obstacles.push({x:x+span+155,y:platformY-32,w:40,h:32});
      g.items.push({x:x+span+265,y:platformY-20,r:15,type:'super'});coins(x+span+230,platformY-20,2,60);span+=410;g.nextPowerAt=g.elapsed+35;
    }
    g.wave++;g.spawnIn=Math.max(d.interval,span/d.speed+.95)+Math.random()*.25;
  }
  function gravitySupport(side,x){
    return !gravityGame.gaps.some(function(gap){return gap.side===side&&x>gap.x&&x<gap.x+gap.w;});
  }
  function updateGravityGame(dt){
    var g=gravityGame;if(!g)return;if(g.startedAt&&gameElapsedMs(g)>=GAME_DURATION_MS){finishGravityGame('Drei Minuten geschafft!');return;}if(!g.running)return;dt=activeGameStep(g,dt);if(!dt)return;
    var p=g.player,speed=gravityDifficulty(g.elapsed).speed,dx=speed*dt;
    g.elapsed+=dt;g.distance+=dx;g.totalDistance+=dx;g.spawnIn-=dt;
    if(g.spawnIn<=0)spawnGravityTerrain();
    [g.obstacles,g.gaps,g.platforms,g.items].forEach(function(list){list.forEach(function(o){o.x-=dx;});});
    collectGravityItems();var powered=gravitySuperRemaining()>0;
    var oldY=p.y;
    p.y+=p.vy*dt+.5*p.gravity*GRAVITY_ACCEL*dt*dt;p.vy+=p.gravity*GRAVITY_ACCEL*dt;p.grounded=false;
    // Land only while crossing the face toward which gravity points.
    var surfaces=[];
    if(powered||gravitySupport(1,p.x+p.w/2))surfaces.push({x:-1000,w:3000,y:332,h:28});
    if(powered||gravitySupport(-1,p.x+p.w/2))surfaces.push({x:-1000,w:3000,y:0,h:28});
    surfaces=surfaces.concat(g.platforms,powered?[]:g.obstacles);
    surfaces.forEach(function(o){
      if(p.x+p.w<=o.x||p.x>=o.x+o.w)return;
      if(p.gravity===1&&oldY+p.h<=o.y+.01&&p.y+p.h>=o.y-.00001){p.y=o.y-p.h;p.vy=0;p.grounded=true;}
      if(p.gravity===-1&&oldY>=o.y+o.h-.01&&p.y<=o.y+o.h+.00001){p.y=o.y+o.h;p.vy=0;p.grounded=true;}
    });
    // Recovery has acceleration, but never passes the middle of the field.
    p.vx=Math.min(90,p.vx+120*dt);p.x=Math.min(GRAVITY_HOME_X,p.x+p.vx*dt);
    if(p.x===GRAVITY_HOME_X)p.vx=0;
    (powered?g.platforms:g.obstacles.concat(g.platforms)).forEach(function(o){
      if(p.x+p.w>o.x&&p.x<o.x+o.w&&p.y+p.h>o.y+.1&&p.y<o.y+o.h-.1){p.x=o.x-p.w;p.vx=0;}
    });
    ['obstacles','gaps','platforms'].forEach(function(key){g[key]=g[key].filter(function(o){return o.x+o.w>-120;});});
    collectGravityItems();
    if(p.x+p.w<0||p.y>360||p.y+p.h<0)loseGravityAttempt();
  }
  function drawGravityGap(ctx, gap, y, side, powered){
    ctx.save();
    // A black opening with high-contrast warning edges, distinct from every
    // rail palette. Keep the edge of the traversable surface visibly broken.
    ctx.fillStyle='#000000';ctx.fillRect(gap.x,y,gap.w,28);
    ctx.fillStyle='#ffe269';ctx.fillRect(gap.x-7,y,7,28);ctx.fillRect(gap.x+gap.w,y,7,28);
    ctx.strokeStyle='#161616';ctx.lineWidth=2;
    for(var stripe=4;stripe<28;stripe+=8){
      ctx.beginPath();ctx.moveTo(gap.x-7,y+stripe);ctx.lineTo(gap.x,y+stripe-4);
      ctx.moveTo(gap.x+gap.w,y+stripe);ctx.lineTo(gap.x+gap.w+7,y+stripe-4);ctx.stroke();
    }
    ctx.fillStyle='#ffffff';ctx.fillRect(gap.x,y,2,28);ctx.fillRect(gap.x+gap.w-2,y,2,28);
    if(gap.w>=70){ctx.fillStyle='#ffe269';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(powered?'BRÜCKE':'LÜCKE',gap.x+gap.w/2,y+18);}
    if(powered){ctx.fillStyle='#68d8ff';ctx.fillRect(gap.x,side===1?332:24,gap.w,4);}
    ctx.restore();
  }
  function drawGravityRail(y,side){
    var ctx=gravityCtx,g=gravityGame,cursor=0;
    var gaps=g.gaps.filter(function(o){return o.side===side;}).sort(function(a,b){return a.x-b.x;});
    ctx.fillStyle=gravityPalette(g.elapsed).rail;
    gaps.forEach(function(gap){var left=Math.max(0,gap.x),right=Math.min(640,gap.x+gap.w);if(right<=0||left>=640)return;ctx.fillRect(cursor,y,Math.max(0,left-cursor),28);cursor=Math.max(cursor,right);});
    ctx.fillRect(cursor,y,640-cursor,28);
    ctx.fillStyle=gravityPalette(g.elapsed).accent;ctx.fillRect(0,side===1?332:24,640,4);
    gaps.forEach(function(gap){drawGravityGap(ctx,gap,y,side,gravitySuperRemaining()>0);});
  }
  function gravityPalette(elapsed){
    var palettes=[{sky:'#111526',deep:'#382d49',rail:'#263947',accent:'#74d9c5'},{sky:'#1a142d',deep:'#493052',rail:'#34304b',accent:'#b7a2f3'},{sky:'#261a2b',deep:'#633b48',rail:'#43323d',accent:'#ffba8b'},{sky:'#14222b',deep:'#35463f',rail:'#26413e',accent:'#99e0af'}];
    return palettes[Math.floor(elapsed/20)%palettes.length];
  }
  function drawGravityGame(){
    var ctx=gravityCtx,g=gravityGame;if(!g)return;
    var palette=gravityPalette(g.elapsed),sky=ctx.createLinearGradient(0,28,0,332);
    sky.addColorStop(0,palette.sky);sky.addColorStop(1,palette.deep);ctx.fillStyle=sky;ctx.fillRect(0,0,640,360);drawHalloweenSky(ctx,640,360,g.elapsed,false);
    // Parallax architecture and light dots are decoration, visually behind terrain.
    ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;
    for(var x=-(g.distance*.2)%110;x<640;x+=110){ctx.beginPath();ctx.moveTo(x,28);ctx.lineTo(x+45,120);ctx.lineTo(x+45,240);ctx.lineTo(x,332);ctx.stroke();}
    ctx.fillStyle='rgba(255,255,255,.12)';
    for(var i=0;i<18;i++){var starX=((i*137-g.distance*.08)%680+680)%680;ctx.fillRect(starX,60+(i*53)%230,i%3===0?3:2,2);}
    ctx.strokeStyle='rgba(255,255,255,.045)';
    for(var y=76;y<332;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(640,y);ctx.stroke();}
    drawGravityRail(0,-1);drawGravityRail(332,1);
    g.platforms.forEach(function(o){ctx.fillStyle='#67d2bc';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle='#c8fff1';ctx.fillRect(o.x,o.y,o.w,2);});
    g.obstacles.forEach(function(o){ctx.globalAlpha=gravitySuperRemaining()>0?.35:1;ctx.fillStyle='#ef8466';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle='#ffd0a3';ctx.fillRect(o.x+4,o.y+4,o.w-8,4);ctx.globalAlpha=1;});
    g.items.forEach(function(item){ctx.save();ctx.translate(item.x,item.y);
      if(item.type==='coin'){ctx.fillStyle='#ffd45d';ctx.strokeStyle='#e59a32';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,item.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff0af';ctx.fillRect(-2,-5,3,10);}
      else{ctx.fillStyle='#4ea5ed';ctx.strokeStyle='#ffc764';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(16,-8);ctx.lineTo(10,10);ctx.lineTo(0,18);ctx.lineTo(-10,10);ctx.lineTo(-16,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff1b8';ctx.textAlign='center';ctx.font='bold 17px sans-serif';ctx.fillText('S',0,6);}ctx.restore();
    });
    var p=g.player,step=p.grounded&&g.running?Math.sin(g.elapsed*19)*4:2;
    ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.scale(1.5,p.gravity*1.5);
    if(gravitySuperRemaining()>0){ctx.fillStyle='#e85b63';ctx.beginPath();ctx.moveTo(-6,-1);ctx.lineTo(-23,4+Math.sin(g.elapsed*18)*3);ctx.lineTo(-17,12);ctx.lineTo(-4,6);ctx.fill();}
    // User requested a 50% enlargement: drawing and collision body both scale.
    ctx.fillStyle='#f6c650';ctx.fillRect(-7,-13,15,10);ctx.fillStyle='#102635';ctx.fillRect(1,-10,6,4);
    ctx.fillStyle='#573d75';ctx.fillRect(-6,-2,12,9);ctx.strokeStyle='#f8edcd';ctx.lineWidth=1;for(var rib=0;rib<3;rib++){ctx.beginPath();ctx.moveTo(-4,rib*2);ctx.lineTo(4,rib*2);ctx.stroke();}
    ctx.strokeStyle='#f6c650';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-3,6);ctx.lineTo(-3+step,11);ctx.moveTo(3,6);ctx.lineTo(3-step,11);ctx.moveTo(-6,0);ctx.lineTo(-8-step/2,5);ctx.moveTo(6,0);ctx.lineTo(8+step/2,4);ctx.stroke();ctx.restore();
    var remaining=gravitySuperRemaining();if(remaining>0){ctx.fillStyle=remaining<=5?'#ff8b77':'#ffda74';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('SUPERMAN · '+Math.ceil(remaining)+' s',320,58);ctx.fillRect(220,66,200*(remaining/10),4);}
    // Telegraph offscreen outer hazards before they enter the short visible runway.
    var warnings={};
    g.gaps.forEach(function(o){if(o.x>640)warnings[o.side]=true;});
    g.obstacles.forEach(function(o){if(o.x>640){if(o.y===28)warnings[-1]=true;else if(Math.abs(o.y+o.h-332)<.01)warnings[1]=true;}});
    [-1,1].forEach(function(side){if(!warnings[side])return;var y=side===1?310:50;
      ctx.fillStyle='#ffcf7d';ctx.beginPath();ctx.moveTo(620,y);ctx.lineTo(630,y-8);ctx.lineTo(630,y+8);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffecce';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('!',638,y+4);
    });
  }
  function runGravityGame(now){
    if(!gravityGame||!gravityGame.active)return;
    if(gravityGame.pausedAt!=null){gravityGame.lastFrame=now;gravityFrame=requestAnimationFrame(runGravityGame);return;}
    var dt=simulateGameFrame(gravityGame,now,updateGravityGame);drawGravityGame();gravityGame.hudIn=(gravityGame.hudIn||0)-dt;if(gravityGame.hudIn<=0){updateGravityHud();gravityGame.hudIn=.25;}if(gravityGame.active)gravityFrame=requestAnimationFrame(runGravityGame);
  }
  el('chooseGravityBtn').addEventListener('click',startGravityGame);
  el('gravityWrap').addEventListener('pointerdown',function(e){e.preventDefault();gravityTap();});
  el('gravityWrap').addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();gravityTap();}});
  ['contextmenu','selectstart','dragstart'].forEach(function(name){el('gravityWrap').addEventListener(name,function(e){e.preventDefault();});});
  el('gravityHomeBtn').addEventListener('click',function(){stopGravityGame();renderHome();});
  el('gravityAgainBtn').addEventListener('click',function(){var demo=gravityGame&&gravityGame.isDemo;stopGravityGame();if(demo)startGravityGame(true);else openRewardGameChoice();});

  // Shared lifecycle for the eight additional arcade rewards.
  var arcadeGames={brick:null,snake:null,snow:null,runner:null,doodle:null,tiles:null,maze:null,asteroid:null};
  var ARCADE_LABELS={brick:'Brick',snake:'Snake',snow:'Snow',runner:'Runner',doodle:'Doodle',tiles:'Tiles',maze:'Maze',asteroid:'Asteroid'};
  var ARCADE_RECORDS={brick:'bestBrickScore',snake:'bestSnakeScore',snow:'bestSnowScore',runner:'bestRunnerScore',doodle:'bestDoodleScore',tiles:'bestTilesScore',maze:'bestMazeScore',asteroid:'bestAsteroidScore'};
  var extraArcade=VocabArcade.create({get:function(kind){return arcadeGames[kind];},begin:beginArcadeAttempt,lose:loseArcadeAttempt,finish:finishArcadeGame,advance:activeGameStep,decor:drawHalloweenSky});
  function arcadeRecord(kind){var g=arcadeGames[kind],key=ARCADE_RECORDS[kind];if(g&&g.score>state.reward[key]){state.reward[key]=g.score;saveState();}}
  function arcadeHud(kind){
    var g=arcadeGames[kind];if(!g)return;
    var values={Time:formatGameTime(Math.max(0,gameDurationMs(g)-(g.startedAt?gameElapsedMs(g):0))),Attempts:'Versuch: '+Math.min(3,g.attempts+1)+'/3',Score:'Punkte: '+g.score,Best:'Rekord: '+state.reward[ARCADE_RECORDS[kind]]};
    Object.keys(values).forEach(function(key){var node=el(kind+key);if(node.textContent!==values[key])node.textContent=values[key];});
  }
  function stopArcadeGame(kind){if(extraPointers)delete extraPointers[kind];if(kind==='brick')brickPointer=null;else if(kind==='runner')runnerPointer=null;else snakeSwipe=null;var g=arcadeGames[kind];if(!g)return;arcadeRecord(kind);g.active=false;if(g.frame)cancelAnimationFrame(g.frame);arcadeGames[kind]=null;}
  function arcadeMessage(kind,title,message){el(kind+'OverlayTitle').textContent=title;el(kind+'OverlayText').textContent=message;el(kind+'Overlay').hidden=false;}
  function finishArcadeGame(kind,title){var g=arcadeGames[kind];g.running=false;g.active=false;arcadeRecord(kind);arcadeHud(kind);arcadeMessage(kind,title,(g.attempts>=3&&g.lastCrashReason?g.lastCrashReason+' · ':'')+g.score+' Punkte · Deine nächste Belohnung wartet beim nächsten Lernziel.');updatePlayAgainButton(el(kind+'AgainBtn'),g.isDemo);if(g.isDemo){el(kind+'AgainBtn').style.display='block';el(kind+'AgainBtn').textContent='Nochmal spielen';}}
  function startArcadeGame(kind,demo){
    if(demo!==true&&state.reward.availablePlays<1)return;
    stopArcadeGame(kind);
    var g=arcadeGames[kind]={kind:kind,active:true,running:false,awaitingStart:true,isDemo:demo===true,rewardConsumed:false,startedAt:null,attempts:0,score:0,lastFrame:performance.now(),hudIn:0,elapsed:0,canvas:el(kind+'Canvas'),ctx:el(kind+'Canvas').getContext('2d')};
    if(kind==='brick'){g.level=1;g.paddle={x:194,y:438,w:92,h:12};g.bricks=[];makeBrickLevel();resetBrickBall();}
    else if(extraArcade.definitions[kind])extraArcade.definitions[kind].init(g);else if(kind==='snow')initSnow();else if(kind==='runner')initRunner();else resetSnakeAttempt();
    el(kind+'AgainBtn').style.display='none';
    arcadeMessage(kind,'Bereit?',extraArcade.definitions[kind]?extraArcade.definitions[kind].help:kind==='brick'?'Tippe zum Aufschlag. Ziehe den Schläger mit dem Finger nach links und rechts. Grün hilft, Rot erschwert, Gold gibt Mehrfachball.':kind==='runner'?'Wische links/rechts zum Ausweichen, hoch zum Springen, runter zum Rutschen. Tippe zum Starten.':kind==='snow'?'Tippe zum Springen. Halte im Flug für einen Salto.':'Tippe zum Starten. Wische oder nutze die Richtungstasten.');
    showScreen(el('screen-'+kind));arcadeHud(kind);drawArcadeGame(kind);g.frame=requestAnimationFrame(function(now){runArcadeGame(kind,now);});
  }
  function beginArcadeAttempt(kind){if(arcadeGames[kind]&&arcadeGames[kind].pausedAt!=null)return false;
    var g=arcadeGames[kind];if(!g||!g.active||!g.awaitingStart)return false;
    if(g.startedAt&&gameElapsedMs(g)>=gameDurationMs(g)){finishArcadeGame(kind,'Zeit geschafft!');return false;}
    if(!g.startedAt){if(!g.isDemo&&!consumeRewardPlay(g))return false;g.startedAt=Date.now();}
    g.awaitingStart=false;g.running=true;g.lastFrame=performance.now();el(kind+'Overlay').hidden=true;
    if(kind==='brick'){var ball=g.balls[0];ball.x=g.paddle.x+g.paddle.w/2;ball.vx=100;ball.vy=-Math.sqrt(g.ballSpeed*g.ballSpeed-10000);}
    return true;
  }
  function loseArcadeAttempt(kind,reason){
    var g=arcadeGames[kind];if(!g.running)return;g.running=false;g.attempts++;g.lastCrashReason=reason||(kind==='brick'?'Ball verloren':'Hindernis getroffen');arcadeRecord(kind);playWrongSound();
    if(g.attempts>=3||gameElapsedMs(g)>=gameDurationMs(g)){finishArcadeGame(kind,g.attempts>=3?'Drei Versuche gespielt!':'Zeit geschafft!');return;}
    if(kind==='brick')g.balls=[{x:g.paddle.x+g.paddle.w/2,y:g.paddle.y-(g.ballRadius||6)-1,r:g.ballRadius||6,vx:0,vy:0}];else if(extraArcade.definitions[kind])extraArcade.definitions[kind].recover(g);else if(kind==='snow')snowRecover();else if(kind==='runner')recoverRunner();else recoverSnake();
    g.awaitingStart=true;arcadeMessage(kind,g.lastCrashReason,'Noch '+(3-g.attempts)+' Versuche · Tippe, wenn du bereit bist!');arcadeHud(kind);
  }
  var BRICK_COLORS=['#f18b83','#ffb875','#f4d875','#7cd6ab','#72c7ed'];
  var BRICK_PATTERNS=['Treppe','Raute','Doppeltürme','Schachbrett','Festung','Wellen'];
  function brickLevelSpeed(level){ return 351 * Math.pow(1.25, Math.max(0, level - 1)); }
  function makeBrickLevel(){
    var g=arcadeGames.brick;g.bricks=[];
    var pattern=g.level<3?-1:(g.level-3)%BRICK_PATTERNS.length;
    g.layoutName=pattern<0?(g.level===1?'Startfeld':'Seitengassen'):BRICK_PATTERNS[pattern];
    for(var row=0;row<(pattern<0?5:6);row++)for(var col=0;col<8;col++){
      if(pattern<0&&g.level===2&&row%2===1&&(col===0||col===7))continue;
      if(pattern===0&&col>row+2)continue;
      if(pattern===1&&Math.abs(col-3.5)+Math.abs(row-2.5)>4)continue;
      if(pattern===2&&col>=3&&col<=4)continue;
      if(pattern===3&&(row+col)%2!==0)continue;
      if(pattern===4&&row>1&&row<5&&col>1&&col<6)continue;
      if(pattern===5&&row===(col+Math.floor((g.level-3)/6))%6)continue;
      var hp=pattern<0?(row<Math.min(2,g.level-1)?2:1):Math.min(3,1+((row+col+g.level)%3===0?1:0)+(g.level>=6&&row===0?1:0));
      var baseX=16+col*56.5,moving=g.level>=5&&row%2===1;
      g.bricks.push({x:baseX+(moving?Math.sin(g.elapsed*1.2+row)*7:0),baseX:baseX,phase:row,moving:moving,
        y:54+row*29,w:52,h:23,hp:hp,color:BRICK_COLORS[(row+Math.floor((g.level-1)/3))%BRICK_COLORS.length]});
    }
  }
  function resetBrickBall(){var g=arcadeGames.brick;g.speedFactor=g.speedFactor||1;g.ballRadius=g.ballRadius||6;g.ballSpeed=brickLevelSpeed(g.level)*g.speedFactor;g.paddle.x=Math.max(8,Math.min(472-g.paddle.w,g.paddle.x));g.drops=[];g.particles=[];g.balls=[{x:g.paddle.x+g.paddle.w/2,y:g.paddle.y-g.ballRadius-1,r:g.ballRadius,vx:0,vy:0}];}
  var BRICK_EXTRAS={
    wide:{label:'Schläger breiter',symbol:'↔+',color:'#83e2b3'},
    narrow:{label:'Schläger schmaler',symbol:'↔−',color:'#ff9696'},
    big:{label:'Großer Ball',symbol:'●+',color:'#83e2b3'},
    small:{label:'Ball wieder normal',symbol:'●−',color:'#ff9696'},
    multi:{label:'Mehrfachball',symbol:'3',color:'#f7cc67'},
    fast:{label:'Ball schneller',symbol:'»',color:'#ff9696'},
    slow:{label:'Ball langsamer',symbol:'«',color:'#83e2b3'}
  };
  function brickExtraEligible(g,type){
    return type==='small'?g.ballRadius>6:type==='big'?g.ballRadius<12:type==='multi'?g.balls.length<3:type==='wide'?g.paddle.w<240:type==='narrow'?g.paddle.w>56:type==='fast'?g.speedFactor<1.6:type==='slow'?g.speedFactor>.65:false;
  }
  function applyBrickExtra(type){
    var g=arcadeGames.brick,p=g.paddle;
    if(!brickExtraEligible(g,type))return false;
    if(type==='wide'||type==='narrow'){
      var center=p.x+p.w/2;p.w=Math.max(56,Math.min(240,p.w+(type==='wide'?44:-44)));p.x=Math.max(8,Math.min(472-p.w,center-p.w/2));
    }else if(type==='big'||type==='small'){
      g.ballRadius=type==='big'?12:6;
      g.balls.forEach(function(b){b.r=g.ballRadius;b.x=Math.max(8+b.r,Math.min(472-b.r,b.x));b.y=Math.max(8+b.r,b.y);if(b.vy<0&&b.y<p.y&&b.y+b.r>=p.y)b.y=p.y-b.r-.01;});
    }else if(type==='fast'||type==='slow'){
      var factor=Math.max(.65,Math.min(1.6,g.speedFactor*(type==='fast'?1.15:1/1.15)));
      g.speedFactor=factor;g.ballSpeed=brickLevelSpeed(g.level)*factor;
      g.balls.forEach(function(b){var speed=Math.hypot(b.vx,b.vy);if(speed){b.vx*=g.ballSpeed/speed;b.vy*=g.ballSpeed/speed;}});
    }else if(type==='multi'){
      var b=g.balls[0];[-.35,.35].forEach(function(angle){if(g.balls.length<3)g.balls.push({x:b.x,y:b.y,r:g.ballRadius,vx:b.vx*Math.cos(angle)-b.vy*Math.sin(angle),vy:b.vx*Math.sin(angle)+b.vy*Math.cos(angle)});});
    }
    g.extraNotice={text:BRICK_EXTRAS[type].label,color:BRICK_EXTRAS[type].color,until:g.elapsed+2};return true;
  }
  function brickPaddleAt(clientX){
    var g=arcadeGames.brick;if(!g||!g.active||g.pausedAt!=null)return;
    var rect=g.inputRect;if(!rect){var bounds=el('brickCanvas').getBoundingClientRect(),size=Math.min(bounds.width,bounds.height);rect=g.inputRect={left:bounds.left+(bounds.width-size)/2,width:size};}if(!rect.width)return;
    g.paddle.x=Math.max(8,Math.min(472-g.paddle.w,(clientX-rect.left)*480/rect.width-g.paddle.w/2));
    if(g.awaitingStart)g.balls[0].x=g.paddle.x+g.paddle.w/2;
  }
  function brickBurst(o){
    var g=arcadeGames.brick;
    for(var i=0;i<7;i++)g.particles.push({x:o.x+o.w/2,y:o.y+o.h/2,vx:(Math.random()-.5)*130,vy:(Math.random()-.5)*130,life:.4,color:o.color});
    if(Math.random()<.16){
      // Multiball stays rare (2.4% of destroyed bricks); unused effects are excluded.
      var multi=Math.random()<.15,types=['wide','narrow','big','small','fast','slow'].filter(function(type){return brickExtraEligible(g,type);});
      var type=multi?(brickExtraEligible(g,'multi')?'multi':null):types[Math.floor(Math.random()*types.length)];
      if(type)g.drops.push({x:o.x+o.w/2,y:o.y+o.h/2,type:type});
    }
  }
  // Small physics steps prevent fast balls tunnelling through bricks at low frame rates.
  function stepBrickPhysics(dt){
    var g=arcadeGames.brick;
    g.balls.forEach(function(b){
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.x-b.r<8){b.x=8+b.r;b.vx=Math.abs(b.vx);}if(b.x+b.r>472){b.x=472-b.r;b.vx=-Math.abs(b.vx);}if(b.y-b.r<8){b.y=8+b.r;b.vy=Math.abs(b.vy);}
      var p=g.paddle;
      if(b.vy>0&&b.y+b.r>=p.y&&b.y-b.r<p.y+p.h&&b.x+b.r>p.x&&b.x-b.r<p.x+p.w){
        var offset=Math.max(-1,Math.min(1,(b.x-(p.x+p.w/2))/(p.w/2))),angle=offset*1.08;
        b.y=p.y-b.r;b.vx=g.ballSpeed*Math.sin(angle);b.vy=-g.ballSpeed*Math.cos(angle);
      }
      for(var i=0;i<g.bricks.length;i++){
        var o=g.bricks[i];if(o.hp<=0)continue;
        var nearX=Math.max(o.x,Math.min(o.x+o.w,b.x)),nearY=Math.max(o.y,Math.min(o.y+o.h,b.y));
        if((b.x-nearX)*(b.x-nearX)+(b.y-nearY)*(b.y-nearY)>b.r*b.r)continue;
        var left=b.x+b.r-o.x,right=o.x+o.w-b.x+b.r,top=b.y+b.r-o.y,bottom=o.y+o.h-b.y+b.r;
        var min=Math.min(left,right,top,bottom);
        if(min===left){b.x=o.x-b.r;b.vx=-Math.abs(b.vx);}else if(min===right){b.x=o.x+o.w+b.r;b.vx=Math.abs(b.vx);}else if(min===top){b.y=o.y-b.r;b.vy=-Math.abs(b.vy);}else{b.y=o.y+o.h+b.r;b.vy=Math.abs(b.vy);}
        o.hp--;g.score+=10;if(o.hp===0){g.score+=10;brickBurst(o);}break;
      }
    });
    g.balls=g.balls.filter(function(b){return b.y-b.r<480;});
  }
  function updateBrickGame(dt){
    var g=arcadeGames.brick;if(!g)return;if(g.startedAt&&gameElapsedMs(g)>=gameDurationMs(g)){finishArcadeGame('brick','Fünf Minuten geschafft!');return;}if(!g.running)return;dt=activeGameStep(g,dt);if(!dt)return;g.elapsed+=dt;
    g.bricks.forEach(function(brick){if(brick.moving)brick.x=brick.baseX+Math.sin(g.elapsed*1.2+brick.phase)*7;});
    var step=Math.min(1/180,4/Math.max(g.ballSpeed,1));
    for(var left=dt;left>0&&g.balls.length;left-=step)stepBrickPhysics(Math.min(left,step));
    if(!g.balls.length){loseArcadeAttempt('brick');return;}
    g.bricks=g.bricks.filter(function(o){return o.hp>0;});
    g.drops.forEach(function(drop){drop.y+=100*dt;var p=g.paddle;
      if(drop.y>=p.y-8&&drop.y<=p.y+p.h+8&&drop.x>=p.x-15&&drop.x<=p.x+p.w+15){
        drop.y=600;applyBrickExtra(drop.type);
      }
    });g.drops=g.drops.filter(function(drop){return drop.y<490;});
    g.particles.forEach(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});g.particles=g.particles.filter(function(p){return p.life>0;});
    if(!g.bricks.length){
      g.score+=100;arcadeRecord('brick');
      if(gameElapsedMs(g)>=gameDurationMs(g)){finishArcadeGame('brick','Alle Steine geschafft!');return;}
      g.level++;makeBrickLevel();resetBrickBall();g.running=false;g.awaitingStart=true;arcadeMessage('brick','Runde '+g.level+' · '+g.layoutName,'Alle Steine weg! Tippe für den nächsten Aufschlag.');
    }
  }
  function resetSnakeAttempt(){
    var g=arcadeGames.snake;g.body=[{x:7,y:10},{x:6,y:10},{x:5,y:10},{x:4,y:10}];g.direction={x:1,y:0};g.turns=[];g.tick=0;g.stepDuration=0;g.apples=0;g.bombs=[];g.nextBombAt=20;placeSnakeFood();
  }
  function placeSnakeFood(){
    var g=arcadeGames.snake,free=[];
    for(var y=0;y<20;y++)for(var x=0;x<20;x++)if(!g.body.some(function(p){return p.x===x&&p.y===y;})&&!g.bombs.some(function(b){return b.x===x&&b.y===y;}))free.push({x:x,y:y});
    if(!free.length){g.food=null;finishArcadeGame('snake','Das ganze Feld gefüllt!');return;}
    g.food=free[Math.floor(Math.random()*free.length)];g.food.type='pumpkin';
  }
  function turnSnake(x,y){if(arcadeGames.snake&&arcadeGames.snake.pausedAt!=null)return;
    var g=arcadeGames.snake;if(!g||!g.active)return;
    var last=g.turns.length?g.turns[g.turns.length-1]:g.direction;
    if(x===-last.x&&y===-last.y)return;
    if((x!==last.x||y!==last.y)&&g.turns.length<1)g.turns.push({x:x,y:y});
    if(g.awaitingStart)beginArcadeAttempt('snake');
  }
  function stepSnake(){
    var g=arcadeGames.snake;
    var head={x:(g.body[0].x+g.direction.x+20)%20,y:(g.body[0].y+g.direction.y+20)%20},eat=g.food&&head.x===g.food.x&&head.y===g.food.y;
    var occupied=eat?g.body:g.body.slice(0,-1);
    var selfHit=occupied.some(function(p){return p.x===head.x&&p.y===head.y;}),bombHit=g.bombs.some(function(b){return b.x===head.x&&b.y===head.y;});
    if(selfHit||bombHit){loseArcadeAttempt('snake',bombHit?'Bombe berührt':'Raupe berührt');return;}
    g.body.unshift(head);
    if(eat){g.score+=25;g.apples++;placeSnakeFood();}else g.body.pop();
  }
  function snakeStepTime(g){return Math.max(.075,.16-g.apples*.004)/(1.3*.7);}
  function prepareSnakeStep(g){
    // Lock the current segment. Inputs received between cells wait for arrival.
    if(g.stepDuration)return;
    if(g.turns.length)g.direction=g.turns.shift();
    g.stepDuration=snakeStepTime(g);
  }
  function snakeGridDelta(from,to){var d=to-from;return d>1?d-20:d<-1?d+20:d;}
  function snakeRenderSegment(g,i){
    var p=g.body[i],target=i?g.body[i-1]:{x:(p.x+g.direction.x+20)%20,y:(p.y+g.direction.y+20)%20};
    var dx=snakeGridDelta(p.x,target.x),dy=snakeGridDelta(p.y,target.y);
    var progress=g.stepDuration?Math.min(1,g.tick/g.stepDuration):0;
    return {x:p.x+dx*progress,y:p.y+dy*progress,dx:dx,dy:dy};
  }
  function spawnSnakeBomb(){
    var g=arcadeGames.snake,h=g.body[0],free=[];
    for(var y=0;y<20;y++)for(var x=0;x<20;x++){
      var dx=Math.min(Math.abs(x-h.x),20-Math.abs(x-h.x)),dy=Math.min(Math.abs(y-h.y),20-Math.abs(y-h.y));
      if(Math.max(dx,dy)<=3||g.body.some(function(p){return p.x===x&&p.y===y;})||g.bombs.some(function(b){return b.x===x&&b.y===y;})||(g.food&&g.food.x===x&&g.food.y===y))continue;
      free.push({x:x,y:y});
    }
    if(free.length)g.bombs.push(free[Math.floor(Math.random()*free.length)]);
  }
  function recoverSnake(){
    var g=arcadeGames.snake;g.turns=[];g.tick=0;g.stepDuration=0;
    function options(h){return [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}].filter(function(d){var x=(h.x+d.x+20)%20,y=(h.y+d.y+20)%20;return !g.body.slice(0,-1).some(function(p){return p.x===x&&p.y===y;})&&!g.bombs.some(function(b){return b.x===x&&b.y===y;});});}
    var choices=options(g.body[0]);
    if(!choices.length){
      // An enclosed head moves to the closest safe cell; length, food and bombs stay.
      var old=g.body[0],best=null;
      for(var y=0;y<20;y++)for(var x=0;x<20;x++)if(!g.body.some(function(p){return p.x===x&&p.y===y;})&&!g.bombs.some(function(b){return b.x===x&&b.y===y;})){
        var candidate={x:x,y:y},dirs=options(candidate),distance=Math.min(Math.abs(x-old.x),20-Math.abs(x-old.x))+Math.min(Math.abs(y-old.y),20-Math.abs(y-old.y));
        if(dirs.length&&(!best||distance<best.distance))best={head:candidate,dirs:dirs,distance:distance};
      }
      if(best){g.body[0]=best.head;choices=best.dirs;}
    }
    if(choices.length)g.direction=choices[0];
  }
  function updateSnakeGame(dt){
    var g=arcadeGames.snake;if(!g)return;
    if(g.startedAt&&gameElapsedMs(g)>=GAME_DURATION_MS){finishArcadeGame('snake','Drei Minuten geschafft!');return;}if(!g.running)return;
    dt=activeGameStep(g,dt);if(!dt)return;
    g.elapsed+=dt;
    while(g.elapsed>=g.nextBombAt){spawnSnakeBomb();g.nextBombAt+=20;}
    while(dt>0&&g.running){
      prepareSnakeStep(g);
      var advance=Math.min(dt,g.stepDuration-g.tick);g.tick+=advance;dt-=advance;
      if(g.tick>=g.stepDuration){
        g.tick=0;g.stepDuration=0;stepSnake();
        if(g.running)prepareSnakeStep(g);
      }
    }
  }
  function arcadeBackground(ctx){ctx.fillStyle='#201a30';ctx.fillRect(0,0,480,480);ctx.strokeStyle='#71607d';ctx.lineWidth=1;ctx.strokeRect(8,8,464,464);drawHalloweenSky(ctx,480,480,arcadeGames.brick?arcadeGames.brick.elapsed:0,false);}
  function drawBrickGame(){
    var g=arcadeGames.brick,ctx=g.ctx;arcadeBackground(ctx);
    g.bricks.forEach(function(o){ctx.fillStyle=o.color;ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(o.x+3,o.y+3,o.w-6,3);if(o.hp>1){ctx.fillStyle='#263947';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText(o.hp,o.x+o.w/2,o.y+16);}});
    ctx.fillStyle='#b5f2ec';ctx.fillRect(g.paddle.x,g.paddle.y,g.paddle.w,g.paddle.h);ctx.fillStyle='#55c8bd';ctx.fillRect(g.paddle.x,g.paddle.y+8,g.paddle.w,4);
    g.balls.forEach(function(b){ctx.fillStyle='#fff3cf';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();});
    g.drops.forEach(function(d){var extra=BRICK_EXTRAS[d.type];ctx.fillStyle=extra.color;ctx.fillRect(d.x-15,d.y-10,30,20);ctx.fillStyle='#112838';ctx.textAlign='center';ctx.font='bold 13px sans-serif';ctx.fillText(extra.symbol,d.x,d.y+4);});
    g.particles.forEach(function(p){ctx.globalAlpha=Math.max(0,p.life/.4);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);});ctx.globalAlpha=1;
    ctx.fillStyle='#b6d1df';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('Runde '+g.level+' · '+g.layoutName,18,32);ctx.textAlign='right';ctx.fillText(Math.round(g.speedFactor*100)+'% Tempo',462,32);
    if(g.extraNotice&&g.elapsed<g.extraNotice.until){ctx.fillStyle=g.extraNotice.color;ctx.textAlign='center';ctx.font='bold 14px sans-serif';ctx.fillText(g.extraNotice.text,240,32);}
  }
  var CATERPILLAR_COLORS=['#ff887e','#ffb764','#ffe078','#98d980','#77d8c9','#80baff','#bc9bf5'];
  function drawSnakePumpkin(ctx,food){
    var x=food.x*24+12,y=food.y*24+12;
    ctx.save();ctx.fillStyle='rgba(255,191,88,.18)';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
    drawPumpkin(ctx,x,y+1,9);ctx.restore();
  }
  function drawSnakeGame(){
    var g=arcadeGames.snake,ctx=g.ctx,grass=ctx.createLinearGradient(0,0,480,480);grass.addColorStop(0,'#45434e');grass.addColorStop(.5,'#3e5149');grass.addColorStop(1,'#61505a');ctx.fillStyle=grass;ctx.fillRect(0,0,480,480);drawHalloweenSky(ctx,480,480,g.elapsed,true);
    // Quiet, irregular meadow textures do not form a second grid or mimic food.
    for(var i=0;i<28;i++){var x=(i*137+31)%480,y=(i*193+57)%480;ctx.fillStyle=i%2?'rgba(193,211,142,.15)':'rgba(49,94,54,.10)';ctx.beginPath();ctx.ellipse(x,y,19+i%4*8,10+i%3*6,i*.8,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='rgba(40,83,42,.20)';ctx.lineWidth=1;
    for(var i=0;i<80;i++){var x=(i*157+19)%480,y=(i*211+43)%480;ctx.beginPath();ctx.moveTo(x-3,y);ctx.quadraticCurveTo(x-5,y-5,x-3,y-7);ctx.moveTo(x,y+1);ctx.quadraticCurveTo(x+1,y-4,x+4,y-6);ctx.stroke();}
    if(g.food)drawSnakePumpkin(ctx,g.food);
    g.bombs.forEach(function(b){var x=b.x*24+12,y=b.y*24+13;ctx.fillStyle='#111317';ctx.strokeStyle='#c3b9d1';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#51565a';ctx.beginPath();ctx.ellipse(x-3,y-3,2.5,1.5,-.7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffdc45';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+3,y-7);ctx.quadraticCurveTo(x+3,y-12,x+7,y-11);ctx.stroke();ctx.fillStyle='#fff39a';ctx.fillRect(x+6,y-13,2.5,2.5);});
    // Rounded rainbow segments, little walking feet, a face and antennae.
    for(var i=g.body.length-1;i>=0;i--){
      var p=snakeRenderSegment(g,i);
      // Duplicate only visible edge pieces so wrapping remains continuous.
      for(var wrapY=-20;wrapY<=20;wrapY+=20)for(var wrapX=-20;wrapX<=20;wrapX+=20){
      var px=(p.x+wrapX)*24+12,py=(p.y+wrapY)*24+12;
      if(px<-18||px>498||py<-18||py>498)continue;
      ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(p.dy,p.dx));
      var wiggle=g.running?Math.sin(g.elapsed*14-i*.8)*1.5:0;
      ctx.strokeStyle='#e5bd83';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-4,8);ctx.lineTo(-6+wiggle,11);ctx.moveTo(4,8);ctx.lineTo(6-wiggle,11);ctx.stroke();
      ctx.fillStyle=CATERPILLAR_COLORS[i%CATERPILLAR_COLORS.length];ctx.beginPath();ctx.arc(0,0,i===0?11:10.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.ellipse(-2,-4,5,2.5,0,0,Math.PI*2);ctx.fill();
      if(i===0){
        runnerPoly(ctx,[[-8,-5],[-6,-16],[3,-7]],'#684575');ctx.fillStyle='#f5b65b';ctx.fillRect(-10,-8,16,2);
        ctx.strokeStyle='#ffe6ab';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(3,-8);ctx.lineTo(6,-11);ctx.moveTo(8,-4);ctx.lineTo(11,-7);ctx.stroke();
        ctx.fillStyle='#fff8e5';[-4,4].forEach(function(eye){ctx.beginPath();ctx.arc(3,eye,3,0,Math.PI*2);ctx.fill();});
        ctx.fillStyle='#193637';[-4,4].forEach(function(eye){ctx.beginPath();ctx.arc(4,eye,1.5,0,Math.PI*2);ctx.fill();});
        ctx.strokeStyle='#913f42';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(6,0,2.5,-.8,.8);ctx.stroke();
      }
      ctx.restore();
      }
    }
  }
  // Metro Run: original perspective runner; all simulation uses active game time.
  function initRunner(){
    var g=arcadeGames.runner;g.lane=0;g.visualLane=0;g.jump=0;g.vy=0;g.slideUntil=0;g.distance=0;g.coins=0;g.objects=[];g.nextRow=70;g.row=0;g.shieldUntil=0;g.magnetUntil=0;g.graceUntil=0;g.notice=null;spawnRunnerRows(g);
  }
  function runnerSpeed(g){return 28+Math.min(22,g.elapsed*.2);}
  function spawnRunnerRows(g){
    while(g.nextRow<g.distance+150){
      var free=Math.floor(Math.random()*3)-1,z=g.nextRow,hard=Math.min(1,g.elapsed/75),actionRow=g.row>=2&&Math.random()<.3+hard*.5;
      [-1,0,1].forEach(function(lane){
        if(lane===free){if(actionRow)g.objects.push({z:z,lane:lane,type:g.row%2?'gate':'barrier',length:2});return;}
        if(!actionRow&&Math.random()>.85+hard*.15)return;
        var roll=Math.random(),type=roll<.36?'train':roll<.7?'barrier':'gate';
        g.objects.push({z:z,lane:lane,type:type,length:type==='train'?14:2});
      });
      for(var i=0;i<5;i++)g.objects.push({z:z+i*3,lane:free,type:'coin'});
      if(g.row%6===4)g.objects.push({z:z+20,lane:free,type:g.row%12===4?'shield':'magnet'});
      g.nextRow+=runnerSpeed(g)*(.95+Math.random()*.25);g.row++;
    }
  }
  function recoverRunner(){
    var g=arcadeGames.runner;g.objects=g.objects.filter(function(o){return o.z-g.distance>18;});
    var lanes=[-1,0,1];lanes.sort(function(a,b){return g.objects.filter(function(o){return o.lane===a&&o.z-g.distance<50&&o.length;}).length-g.objects.filter(function(o){return o.lane===b&&o.z-g.distance<50&&o.length;}).length;});
    g.lane=lanes[0];g.visualLane=g.lane;g.jump=0;g.vy=0;g.slideUntil=0;g.graceUntil=g.elapsed+2;
  }
  function runnerAction(action){
    var g=arcadeGames.runner;if(!g||!g.active||g.pausedAt!=null)return;
    if(g.awaitingStart){if(!beginArcadeAttempt('runner'))return;}
    if(action==='left'||action==='right')g.lane=Math.max(-1,Math.min(1,g.lane+(action==='left'?-1:1)));
    if(action==='jump'&&g.jump===0){g.slideUntil=0;g.vy=7.4;}
    if(action==='slide'){if(g.jump>0)g.vy=-10;else g.slideUntil=g.elapsed+.85;}
  }
  function updateRunnerGame(dt){
    var g=arcadeGames.runner;if(!g||!g.running)return;
    dt=activeGameStep(g,dt);if(!dt)return;g.elapsed+=dt;g.distance+=runnerSpeed(g)*dt;
    var delta=g.lane-g.visualLane;g.visualLane+=Math.sign(delta)*Math.min(Math.abs(delta),dt*7);
    g.vy-=20*dt;g.jump=Math.max(0,g.jump+g.vy*dt);if(g.jump===0)g.vy=0;
    spawnRunnerRows(g);
    for(var i=0;i<g.objects.length;i++){
      var o=g.objects[i],z=o.z-g.distance;if(o.taken||z>10||z<-(o.length||2))continue;
      var aligned=Math.abs(o.lane-g.visualLane)<.43;
      if(o.type==='coin'||o.type==='shield'||o.type==='magnet'){
        if((aligned&&z<1.5&&z>-2&&g.jump<1.8)||(o.type==='coin'&&g.elapsed<g.magnetUntil&&z<9&&z>-1)){
          o.taken=true;if(o.type==='coin'){g.coins++;}else{g[o.type+'Until']=g.elapsed+(o.type==='shield'?8:10);g.notice={text:o.type==='shield'?'Schutzschild · 8 s':'Münzmagnet · 10 s',until:g.elapsed+2};}
        }
      }else if(aligned&&z<=1&&z>=-o.length&&g.elapsed>=g.graceUntil){
        var safe=o.type==='barrier'&&g.jump>.7||o.type==='gate'&&g.jump===0&&g.elapsed<g.slideUntil;
        if(!safe){
          if(g.elapsed<g.shieldUntil){o.taken=true;g.shieldUntil=0;g.graceUntil=g.elapsed+.8;g.notice={text:'Schild hat dich geschützt!',until:g.elapsed+1.5};}
          else{loseArcadeAttempt('runner',o.type==='train'?'Zug berührt':o.type==='gate'?'Unter der Schranke durchrutschen!':'Über die Absperrung springen!');return;}
        }
      }
    }
    g.score=Math.floor(g.distance*2)+g.coins*20;g.objects=g.objects.filter(function(o){return !o.taken&&o.z-g.distance>-(o.length||0)-14;});
  }
  function runnerProject(g,lane,z){
    var h=el('runnerCanvas').height,k=1/(1+Math.max(-14,z)*.065);
    return {x:240+lane*122*k,y:h*.20+(h*.83-h*.20)*k,k:k};
  }
  function runnerPoly(ctx,points,color){
    ctx.fillStyle=color;ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.fill();
  }
  function drawRunnerObject(g,o){
    var ctx=g.ctx,p=runnerProject(g,o.lane,o.z-g.distance),k=p.k,x=p.x,y=p.y;
    ctx.save();ctx.translate(x,y);ctx.scale(k,k);
    if(o.type==='coin'){
      ctx.fillStyle='rgba(255,193,47,.16)';ctx.beginPath();ctx.arc(0,-20,15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffc841';ctx.strokeStyle='#fff5b0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-20,8+Math.abs(Math.sin(g.elapsed*5+o.z))*3,12,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#d88a1c';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillText('★',0,-15);
    }else if(o.type==='shield'||o.type==='magnet'){
      ctx.shadowColor='#5ce5ff';ctx.shadowBlur=16;ctx.fillStyle=o.type==='shield'?'#44d5f1':'#fa77a5';ctx.beginPath();ctx.arc(0,-29,20,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 23px sans-serif';ctx.fillText(o.type==='shield'?'◇':'∩',0,-21);
    }else if(o.type==='train'){
      var rear=runnerProject(g,o.lane,o.z-g.distance+14),ry=(rear.y-y)/k,rk=rear.k/k;
      runnerPoly(ctx,[[-48,-100],[-48*rk,ry-100*rk],[48*rk,ry-100*rk],[48,-100]],'#98e4e4');
      runnerPoly(ctx,[[48,-100],[48*rk,ry-100*rk],[48*rk,ry],[48,0]],'#226d83');
      var paint=ctx.createLinearGradient(-48,0,48,0);paint.addColorStop(0,'#2589a1');paint.addColorStop(.5,'#4bbbc4');paint.addColorStop(1,'#267a95');ctx.fillStyle=paint;ctx.fillRect(-48,-100,96,100);
      ctx.fillStyle='#193f60';ctx.fillRect(-39,-89,78,37);ctx.fillStyle='#7ac7e8';runnerPoly(ctx,[[-36,-86],[30,-86],[-20,-56],[-36,-56]],'#7ac7e8');
      ctx.fillStyle='#fff2cc';[-22,22].forEach(function(ex){ctx.beginPath();ctx.arc(ex,-68,9,0,Math.PI*2);ctx.fill();});ctx.fillStyle='#2d3754';[-22,22].forEach(function(ex){ctx.beginPath();ctx.arc(ex+Math.sin(g.elapsed*3)*2,-67,4,0,Math.PI*2);ctx.fill();});
      ctx.fillStyle='#ffcf59';ctx.fillRect(-48,-43,96,9);ctx.fillStyle='#fff0ad';[-30,30].forEach(function(l){ctx.beginPath();ctx.arc(l,-20,6,0,Math.PI*2);ctx.fill();});
      ctx.fillStyle='#173849';ctx.fillRect(-32,-7,64,10);ctx.fillStyle='#d3f3ee';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('METRO',0,-94);
    }else if(o.type==='barrier'){
      ctx.fillStyle='#4e4558';ctx.fillRect(-45,-32,8,34);ctx.fillRect(37,-32,8,34);
      ctx.fillStyle='#f17e55';ctx.fillRect(-50,-48,100,25);
      for(var i=-45;i<40;i+=24)runnerPoly(ctx,[[i,-48],[i+12,-48],[i+27,-23],[i+15,-23]],'#fff2ca');
    }else{
      ctx.fillStyle='#675681';ctx.fillRect(-52,-112,9,114);ctx.fillRect(43,-112,9,114);ctx.fillStyle='#ffb849';ctx.fillRect(-54,-112,108,32);
      ctx.fillStyle='#57375a';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText('↓',0,-87);
      ctx.fillStyle='#a092b2';ctx.fillRect(-52,-72,9,10);ctx.fillRect(43,-72,9,10);
    }
    ctx.restore();
  }
  // Friendly seasonal decorations are paint only: no hitboxes, randomness or timers.
  function drawPumpkin(ctx,x,y,r){
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#df6f28';ctx.beginPath();ctx.ellipse(0,0,r,r*.78,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffb349';ctx.lineWidth=Math.max(1,r*.09);[-.42,0,.42].forEach(function(t){ctx.beginPath();ctx.ellipse(t*r*.35,0,r*(.4-Math.abs(t)*.3),r*.72,0,0,Math.PI*2);ctx.stroke();});
    ctx.fillStyle='#5f7844';ctx.fillRect(-r*.12,-r, r*.24,r*.35);
    ctx.fillStyle='#492c45';runnerPoly(ctx,[[-r*.6,-r*.1],[-r*.25,-r*.1],[-r*.43,-r*.4]],'#492c45');runnerPoly(ctx,[[r*.25,-r*.1],[r*.6,-r*.1],[r*.43,-r*.4]],'#492c45');
    ctx.beginPath();ctx.arc(0,r*.1,r*.4,0,Math.PI);ctx.fill();ctx.fillStyle='#ffe6a0';ctx.fillRect(-r*.12,r*.12,r*.16,r*.2);ctx.restore();
  }
  function halloweenWeather(time,reduced){
    var phase=((time%18)+18)%18;
    return {drift:reduced?0:Math.sin(time*.18)*18,lightning:reduced||phase<12||phase>13.2?0:Math.sin((phase-12)/1.2*Math.PI)*.55};
  }
  function drawHalloweenSky(ctx,w,h,time,quiet){
    var reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(reduced)time=0;
    var weather=halloweenWeather(time,reduced);
    ctx.save();ctx.globalAlpha=quiet?.22:.85;
    // Distant mist and one slowly fading bolt, never a full-screen flash.
    if(!quiet){
      ctx.fillStyle='rgba(157,144,180,.12)';
      for(var cloud=0;cloud<4;cloud++){ctx.beginPath();ctx.ellipse(w*(cloud+.2)/3+weather.drift,Math.min(h*.3,105)+cloud%2*20,w*.23,14+cloud%2*7,0,0,Math.PI*2);ctx.fill();}
      if(weather.lightning>0){
        ctx.save();ctx.globalAlpha=weather.lightning;ctx.strokeStyle='#d4c6ef';ctx.lineWidth=2;ctx.lineJoin='round';
        var boltY=Math.max(35,h*.16);
        ctx.beginPath();ctx.moveTo(w*.57,boltY);ctx.lineTo(w*.53,boltY+31);ctx.lineTo(w*.56,boltY+28);ctx.lineTo(w*.50,boltY+71);ctx.stroke();ctx.restore();
      }
    }
    // Cobwebs stay behind every playable object, including Cleo's corner cells.
    ctx.strokeStyle=quiet?'#ead8bc':'#e1d2e8';ctx.lineWidth=1;
    [0,w].forEach(function(edge){var sign=edge? -1:1,top=quiet?0:42;ctx.beginPath();for(var i=0;i<4;i++){ctx.moveTo(edge,top);ctx.lineTo(edge+sign*(12+i*12),top+48-i*12);}ctx.stroke();
      [15,28,41].forEach(function(r){ctx.beginPath();ctx.moveTo(edge,top+r);ctx.quadraticCurveTo(edge+sign*r*.28,top+r*.35,edge+sign*r,top);ctx.stroke();});
    });
    if(!quiet){
      var moonX=w*.78,moonY=Math.min(80,h*.13);ctx.fillStyle='#d3cee2';ctx.beginPath();ctx.arc(moonX,moonY,20,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(72,66,98,.30)';ctx.beginPath();ctx.arc(moonX-6,moonY-4,5,0,Math.PI*2);ctx.arc(moonX+7,moonY+7,3,0,Math.PI*2);ctx.fill();
      // Small bat silhouettes and a broom-riding witch cross the distant sky.
      for(var i=0;i<3;i++){var x=(w*.14+i*58+time*6)%(w+60)-30,y=58+i%2*20,wing=5+Math.sin(time*6+i)*3;
        ctx.fillStyle='#493454';ctx.beginPath();ctx.moveTo(x-12,y-wing);ctx.quadraticCurveTo(x-7,y+5,x,y);ctx.quadraticCurveTo(x+7,y+5,x+12,y-wing);ctx.lineTo(x+4,y-3);ctx.lineTo(x+2,y-7);ctx.lineTo(x,y-4);ctx.lineTo(x-2,y-7);ctx.lineTo(x-4,y-3);ctx.closePath();ctx.fill();}
      var wx=((time*12+w*.45)%(w+100))-50,wy=Math.min(110,h*.23)+Math.sin(time)*3;
      ctx.translate(wx,wy);ctx.strokeStyle='#a5744f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20,8);ctx.lineTo(22,8);ctx.stroke();ctx.fillStyle='#d5a85f';runnerPoly(ctx,[[16,4],[30,0],[27,13],[15,11]],'#d5a85f');
      ctx.fillStyle='#68477c';runnerPoly(ctx,[[-5,5],[4,-7],[11,6]],'#68477c');ctx.fillStyle='#ddb488';ctx.beginPath();ctx.arc(3,-10,4,0,Math.PI*2);ctx.fill();runnerPoly(ctx,[[-5,-13],[0,-23],[7,-13]],'#493454');ctx.fillStyle='#493454';ctx.fillRect(-8,-14,18,2);
    }
    ctx.restore();
  }
  function drawRunnerSlide(g,p){
    var ctx=g.ctx,wiggle=Math.sin(g.elapsed*18)*1.5;
    ctx.save();ctx.translate(p.x,p.y);
    // Rear view, shortened by foreshortening; no sideways sprite rotation.
    ctx.fillStyle='rgba(235,221,193,.45)';
    for(var i=0;i<5;i++){ctx.beginPath();ctx.ellipse(-21+i*10,5+(i%2)*4,3+Math.sin(g.elapsed*16+i),2,0,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#233654';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,-18);ctx.lineTo(-15,-9);ctx.lineTo(-11,-3);ctx.moveTo(8,-18);ctx.lineTo(15,-9);ctx.lineTo(11,-3);ctx.stroke();
    ctx.fillStyle='#fcf4dd';ctx.beginPath();ctx.ellipse(-11,-2,7,4,0,0,Math.PI*2);ctx.ellipse(11,-2,7,4,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#e9b285';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-14,-26);ctx.lineTo(-24,-12+wiggle);ctx.moveTo(14,-26);ctx.lineTo(24,-12-wiggle);ctx.stroke();
    ctx.fillStyle='#ef705d';ctx.beginPath();ctx.ellipse(0,-23,19,13,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#bc4b56';ctx.beginPath();ctx.ellipse(0,-25,13,10,0,0,Math.PI*2);ctx.fill();drawPumpkin(ctx,0,-25,7);
    ctx.fillStyle='#ddac7b';ctx.beginPath();ctx.ellipse(0,-39,11,7,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#274567';ctx.beginPath();ctx.ellipse(0,-43,14,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#58c8c8';ctx.fillRect(-7,-48,14,4);
    if(g.elapsed<g.shieldUntil||g.elapsed<g.graceUntil){ctx.strokeStyle='#b7fbff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-23,35,33,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawRunnerStreetFun(g,z,side,index){
    var ctx=g.ctx,p=runnerProject(g,side*1.95,z),k=p.k;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(k,k);
    if(index%3===0){
      ctx.fillStyle='#5c4867';ctx.fillRect(-2,-80,4,80);ctx.fillStyle='#f9d795';ctx.fillRect(-49,-103,98,38);
      ctx.fillStyle='#6a365b';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(index%2?'NÄCHSTER HALT:':'BITTE NICHT',0,-88);ctx.fillText(index%2?'KÜRBISSUPPE!':'DIE HEXE FÜTTERN',0,-76);drawPumpkin(ctx,16,-13,14);
    }else if(index%3===1){
      // A cheerful dancing skeleton on the pavement.
      var wave=Math.sin(g.elapsed*5+index)*10;ctx.strokeStyle='#f4e9d7';ctx.lineWidth=4;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(0,-38);ctx.lineTo(0,-16);ctx.moveTo(-12,-30-wave);ctx.lineTo(0,-34);ctx.lineTo(13,-27+wave);ctx.moveTo(0,-16);ctx.lineTo(-10,-2);ctx.moveTo(0,-16);ctx.lineTo(10,-2);ctx.stroke();
      for(var j=0;j<3;j++){ctx.beginPath();ctx.moveTo(-7,-31+j*5);ctx.lineTo(7,-31+j*5);ctx.stroke();}
      ctx.fillStyle='#f4e9d7';ctx.beginPath();ctx.ellipse(0,-48,12,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4e385a';ctx.beginPath();ctx.arc(-5,-49,3,0,Math.PI*2);ctx.arc(5,-49,3,0,Math.PI*2);ctx.fill();ctx.fillRect(-4,-43,8,2);
    }else{
      // A ghost balloon with a tiny pumpkin friend; both stay off the tracks.
      var lift=Math.sin(g.elapsed*2+index)*5;ctx.strokeStyle='#d8becd';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-26);ctx.lineTo(0,-84+lift);ctx.stroke();
      ctx.fillStyle='#f8efdf';ctx.beginPath();ctx.arc(0,-96+lift,15,Math.PI,0);ctx.lineTo(15,-76+lift);ctx.lineTo(8,-81+lift);ctx.lineTo(0,-76+lift);ctx.lineTo(-8,-81+lift);ctx.lineTo(-15,-76+lift);ctx.closePath();ctx.fill();
      ctx.fillStyle='#493454';ctx.beginPath();ctx.arc(-5,-95+lift,2,0,Math.PI*2);ctx.arc(5,-95+lift,2,0,Math.PI*2);ctx.fill();drawPumpkin(ctx,0,-12,12);
    }
    ctx.restore();
  }
  function drawRunnerPlayer(g){
    var ctx=g.ctx,p=runnerProject(g,g.visualLane,0),slide=g.elapsed<g.slideUntil&&g.jump===0,phase=g.running?g.elapsed*15:0,swing=Math.sin(phase)*15;
    ctx.fillStyle='rgba(20,30,60,.22)';ctx.beginPath();ctx.ellipse(p.x,p.y+4,22,7,0,0,Math.PI*2);ctx.fill();
    if(slide){drawRunnerSlide(g,p);return;}
    ctx.save();ctx.translate(p.x,p.y-g.jump*62);ctx.translate(0,-5);
    if(g.elapsed<g.shieldUntil||g.elapsed<g.graceUntil){ctx.strokeStyle='#b7fbff';ctx.lineWidth=3;ctx.shadowColor='#64e5ff';ctx.shadowBlur=18;ctx.beginPath();ctx.ellipse(0,-38,32,56,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
    ctx.lineCap='round';ctx.lineWidth=9;ctx.strokeStyle='#243556';ctx.beginPath();ctx.moveTo(-7,-26);ctx.lineTo(-9+swing*.4,-4);ctx.moveTo(7,-26);ctx.lineTo(10-swing*.4,-4);ctx.stroke();
    ctx.strokeStyle='#f9f1e5';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-11+swing*.4,-3);ctx.lineTo(-3+swing*.4,-3);ctx.moveTo(7-swing*.4,-3);ctx.lineTo(15-swing*.4,-3);ctx.stroke();
    ctx.strokeStyle='#e7a879';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-13,-51);ctx.lineTo(-19,-32-swing*.45);ctx.moveTo(13,-51);ctx.lineTo(20,-32+swing*.45);ctx.stroke();
    ctx.fillStyle='#ff775f';ctx.fillRect(-14,-60,28,34);ctx.fillStyle='#df5a56';ctx.fillRect(-8,-53,16,25);ctx.fillStyle='#ffc668';ctx.fillRect(-6,-51,12,20);drawPumpkin(ctx,0,-43,7);
    ctx.fillStyle='#edbd91';ctx.beginPath();ctx.arc(0,-72,13,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#274567';ctx.beginPath();ctx.arc(0,-76,14,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-16,-77,34,7);ctx.fillStyle='#4dc4c8';ctx.fillRect(-10,-86,20,7);
    ctx.fillStyle='#f9d781';runnerPoly(ctx,[[12,-54],[34,-47-Math.sin(phase)*5],[13,-43]],'#f9d781');
    ctx.restore();
  }
  function drawRunnerGame(){
    var g=arcadeGames.runner,ctx=g.ctx,h=el('runnerCanvas').height,sky=ctx.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#17182f');sky.addColorStop(.34,'#594262');sky.addColorStop(1,'#985e64');ctx.fillStyle=sky;ctx.fillRect(0,0,480,h);drawHalloweenSky(ctx,480,h,g.elapsed,false);
    // Distant skyline, then ordered perspective scenery on either side of the tracks.
    for(var i=0;i<18;i++){ctx.fillStyle=i%2?'#55516c':'#41465e';ctx.fillRect(i*29-15,h*.2-35-i%5*12,28,60+i%5*12);}
    var road=ctx.createLinearGradient(0,h*.2,0,h);road.addColorStop(0,'#9a8191');road.addColorStop(1,'#574e69');ctx.fillStyle=road;ctx.fillRect(0,h*.25,480,h);
    function quad(lane1,lane2,z1,z2,color){var a=runnerProject(g,lane1,z1),b=runnerProject(g,lane2,z1),c=runnerProject(g,lane2,z2),d=runnerProject(g,lane1,z2);runnerPoly(ctx,[[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],color);}
    quad(-1.58,1.58,-4,180,'#6a647c');
    for(var z=150;z>-4;z-=3){var at=z-(g.distance%3);quad(-1.52,1.52,at,at+.3,'#52495f');}
    [-1,0,1].forEach(function(lane){[-.32,.32].forEach(function(edge){quad(lane+edge-.022,lane+edge+.022,-4,180,'#c5c5d0');quad(lane+edge-.009,lane+edge+.009,-4,180,'#eef0ef');});});
    for(var z=150;z>1;z-=14){
      var at=z-g.distance%14;
      [-1,1].forEach(function(side){var p=runnerProject(g,side*2.1,at),k=p.k,building=ctx.createLinearGradient(p.x-60*k,0,p.x+60*k,0);building.addColorStop(0,side<0?'#784d5d':'#42616d');building.addColorStop(1,side<0?'#a86d69':'#658481');ctx.fillStyle=building;ctx.fillRect(p.x-55*k,p.y-230*k,110*k,230*k);
        ctx.fillStyle='#f5deba';for(var row=0;row<5;row++)for(var col=0;col<3;col++)ctx.fillRect(p.x+(-38+col*29)*k,p.y+(-208+row*39)*k,16*k,24*k);
        ctx.fillStyle='#53647c';ctx.fillRect(p.x-60*k,p.y-235*k,120*k,8*k);ctx.fillStyle='#548e83';ctx.beginPath();ctx.ellipse(p.x-side*30*k,p.y-20*k,26*k,40*k,0,0,Math.PI*2);ctx.fill();
        drawRunnerStreetFun(g,at,side,Math.floor((g.distance+at)/14)+(side===1?1:0));
      });
    }
    var visible=g.objects.filter(function(o){return !o.taken&&o.z-g.distance<155&&o.z-g.distance>-(o.length||0)-14;}).sort(function(a,b){return b.z-a.z;});
    visible.filter(function(o){return o.z-g.distance>=0;}).forEach(function(o){drawRunnerObject(g,o);});
    drawRunnerPlayer(g);
    visible.filter(function(o){return o.z-g.distance<0;}).forEach(function(o){drawRunnerObject(g,o);});
    var bar=ctx.createLinearGradient(0,0,0,80);bar.addColorStop(0,'rgba(28,37,68,.7)');bar.addColorStop(1,'rgba(28,37,68,0)');ctx.fillStyle=bar;ctx.fillRect(0,0,480,80);
    ctx.fillStyle='#fff4c9';ctx.font='bold 16px sans-serif';ctx.textAlign='left';ctx.fillText('● '+g.coins+' Münzen',16,28);ctx.textAlign='right';ctx.fillText(Math.floor(g.distance)+' m · '+Math.round(runnerSpeed(g)/28*100)+'%',464,28);
    ctx.textAlign='center';ctx.font='bold 14px sans-serif';var status=g.elapsed<g.shieldUntil?'◇ Schutz '+Math.ceil(g.shieldUntil-g.elapsed)+' s':g.elapsed<g.magnetUntil?'∩ Magnet '+Math.ceil(g.magnetUntil-g.elapsed)+' s':'';
    ctx.fillText(status,240,52);if(g.notice&&g.elapsed<g.notice.until)ctx.fillText(g.notice.text,240,74);
  }
  var runnerPointer=null;
  el('runnerWrap').addEventListener('pointerdown',function(e){
    if(arcadeGames.runner&&arcadeGames.runner.pausedAt!=null)return;e.preventDefault();runnerPointer={x:e.clientX,y:e.clientY,id:e.pointerId};
    if(this.setPointerCapture)this.setPointerCapture(e.pointerId);
    if(arcadeGames.runner&&arcadeGames.runner.awaitingStart)beginArcadeAttempt('runner');
  });
  el('runnerWrap').addEventListener('pointermove',function(e){
    if(!runnerPointer||runnerPointer.id!==e.pointerId||runnerPointer.handled)return;
    var dx=e.clientX-runnerPointer.x,dy=e.clientY-runnerPointer.y;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    e.preventDefault();runnerPointer.handled=true;runnerAction(Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'jump':'slide');
  });
  el('runnerWrap').addEventListener('pointerup',function(e){
    if(!runnerPointer||runnerPointer.id!==e.pointerId)return;e.preventDefault();var dx=e.clientX-runnerPointer.x,dy=e.clientY-runnerPointer.y,handled=runnerPointer.handled;runnerPointer=null;if(handled)return;
    runnerAction(Math.max(Math.abs(dx),Math.abs(dy))<24?'jump':Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'jump':'slide');
  });
  ['pointercancel','lostpointercapture'].forEach(function(name){el('runnerWrap').addEventListener(name,function(){runnerPointer=null;});});
  ['left','jump','slide','right'].forEach(function(action){el('runner'+action+'Btn').addEventListener('pointerdown',function(e){e.preventDefault();runnerAction(action);});});
  document.addEventListener('keydown',function(e){if(gameControlKey(e)||!arcadeGames.runner||!arcadeGames.runner.active||e.repeat)return;var action={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',' ':'jump',w:'jump',ArrowDown:'slide',s:'slide'}[e.key];if(action){e.preventDefault();runnerAction(action);}});

  function resizeRunnerCanvas(){
    if(!arcadeGames.runner)return;var c=el('runnerCanvas'),r=el('runnerWrap').getBoundingClientRect();if(r.width>0&&r.height>0){var height=Math.max(300,Math.min(960,Math.round(480*r.height/r.width)));if(c.height!==height)c.height=height;drawRunnerGame();}
  }
  function resizeExtraCanvases(){
    extraArcade.kinds.forEach(function(kind){var g=arcadeGames[kind];if(!g)return;var bounds=el(kind+'Wrap').getBoundingClientRect();if(!bounds.width||!bounds.height)return;var h=Math.max(300,Math.min(960,Math.round(480*bounds.height/bounds.width))),old=g.canvas.height;if(old!==h){g.canvas.height=h;extraArcade.resize(kind,old);}extraArcade.draw(kind);});
  }
  var extraPointers={};
  extraArcade.kinds.forEach(function(kind){
    var wrap=el(kind+'Wrap');
    function point(e){var c=el(kind+'Canvas'),r=c.getBoundingClientRect(),width=r.width||480,height=r.height||640,scale=Math.min(width/480,height/c.height),left=r.left+(width-480*scale)/2,top=r.top+(height-c.height*scale)/2;return {x:Math.max(0,Math.min(480,(e.clientX-left)/scale)),y:Math.max(0,Math.min(c.height,(e.clientY-top)/scale))};}
    wrap.addEventListener('pointerdown',function(e){
      var g=arcadeGames[kind];if(!g||!g.active||g.pausedAt!=null)return;e.preventDefault();if(extraPointers[kind])return;
      extraPointers[kind]={id:e.pointerId,x:e.clientX,y:e.clientY,done:false};if(wrap.setPointerCapture)wrap.setPointerCapture(e.pointerId);
      if(kind==='doodle'||kind==='asteroid')beginArcadeAttempt(kind);if(kind==='doodle')g.pointerX=point(e).x;if(kind==='asteroid'&&g.running)g.touchTarget=point(e);
    });
    wrap.addEventListener('pointermove',function(e){
      var p=extraPointers[kind],g=arcadeGames[kind];if(!p||p.id!==e.pointerId||!g||g.pausedAt!=null)return;e.preventDefault();
      if(kind==='doodle'){g.pointerX=point(e).x;return;}
      if(kind==='asteroid'){if(g.running)g.touchTarget=point(e);return;}
      if(p.done||kind==='asteroid')return;var dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
      p.done=true;extraArcade.action(kind,Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down',true);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(event){wrap.addEventListener(event,function(e){var p=extraPointers[kind];if(p&&p.id===e.pointerId){delete extraPointers[kind];var g=arcadeGames[kind];if(g&&kind==='doodle')g.pointerX=null;if(g&&kind==='asteroid')g.touchTarget=null;}});});
    ['left','right','up','down','fire'].forEach(function(action){
      var button=document.getElementById(kind+action+'Btn');if(!button)return;
      ['contextmenu','selectstart','dragstart'].forEach(function(event){button.addEventListener(event,function(e){e.preventDefault();});});
      button.addEventListener('pointerdown',function(e){e.preventDefault();button.pointerActivated=true;if(button.setPointerCapture)button.setPointerCapture(e.pointerId);extraArcade.action(kind,action,true);});
      button.addEventListener('click',function(){if(button.pointerActivated){button.pointerActivated=false;return;}extraArcade.action(kind,action,true);if(kind==='doodle'||kind==='asteroid')setTimeout(function(){extraArcade.action(kind,action,false);},180);});
      ['pointerup','pointercancel','lostpointercapture'].forEach(function(event){button.addEventListener(event,function(){if(event==='pointercancel')button.pointerActivated=false;extraArcade.action(kind,action,false);});});
    });
  });
  document.addEventListener('keydown',function(e){
    if(gameControlKey(e))return;var action={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',' ':'fire'}[e.key];if(!action)return;
    extraArcade.kinds.forEach(function(kind){var g=arcadeGames[kind];if(g&&g.active&&g.pausedAt==null){e.preventDefault();if(!e.repeat)extraArcade.action(kind,action,true);}});
  });
  document.addEventListener('keyup',function(e){
    var action={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',' ':'fire'}[e.key];
    if(action)extraArcade.kinds.forEach(function(kind){extraArcade.action(kind,action,false);});
  });
  function drawArcadeGame(kind){if(extraArcade.definitions[kind])extraArcade.draw(kind);else if(kind==='brick')drawBrickGame();else if(kind==='snow')drawSnowGame();else if(kind==='runner')drawRunnerGame();else drawSnakeGame();}
  function runArcadeGame(kind,now){
    var g=arcadeGames[kind];if(!g||!g.active)return;
    if(g.pausedAt!=null){g.lastFrame=now;g.frame=requestAnimationFrame(function(next){runArcadeGame(kind,next);});return;}
    if(g.startedAt&&gameElapsedMs(g)>=gameDurationMs(g)){finishGameTime(g);return;}
    var dt=simulateGameFrame(g,now,kind==='brick'?updateBrickGame:kind==='snow'?updateSnowGame:kind==='runner'?updateRunnerGame:extraArcade.definitions[kind]?function(dt){extraArcade.update(kind,dt);}:updateSnakeGame);
    drawArcadeGame(kind);g.hudIn-=dt;if(g.hudIn<=0){arcadeHud(kind);g.hudIn=.25;}
    if(g.active)g.frame=requestAnimationFrame(function(next){runArcadeGame(kind,next);});
  }
  ['brick','snake','snow','runner','doodle','tiles','maze','asteroid'].forEach(function(kind){
    el('choose'+ARCADE_LABELS[kind]+'Btn').addEventListener('click',function(){startArcadeGame(kind,false);});
    el(kind+'HomeBtn').addEventListener('click',function(){exitGameFullscreen();stopArcadeGame(kind);renderHome();});
    el(kind+'AgainBtn').addEventListener('click',function(){var demo=arcadeGames[kind]&&arcadeGames[kind].isDemo;exitGameFullscreen();stopArcadeGame(kind);if(demo)startArcadeGame(kind,true);else openRewardGameChoice();});
    ['contextmenu','selectstart','dragstart'].forEach(function(name){el(kind+'Wrap').addEventListener(name,function(e){e.preventDefault();});});
  });
  var brickPointer=null;
  el('brickWrap').addEventListener('pointerdown',function(e){
    e.preventDefault();var g=arcadeGames.brick;if(!g||!g.active||brickPointer!==null)return;
    brickPointer=e.pointerId;g.inputRect=null;
    if(el('brickWrap').setPointerCapture)el('brickWrap').setPointerCapture(e.pointerId);
    brickPaddleAt(e.clientX);beginArcadeAttempt('brick');
  });
  el('brickWrap').addEventListener('pointermove',function(e){if(brickPointer===e.pointerId||e.pointerType==='mouse'){e.preventDefault();brickPaddleAt(e.clientX);}});
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(name){el('brickWrap').addEventListener(name,function(e){if(e.pointerId===brickPointer)brickPointer=null;});});
  var snakeSwipe=null;
  el('snakeWrap').addEventListener('pointerdown',function(e){e.preventDefault();if(!snakeSwipe){snakeSwipe={x:e.clientX,y:e.clientY,id:e.pointerId};if(el('snakeWrap').setPointerCapture)el('snakeWrap').setPointerCapture(e.pointerId);beginArcadeAttempt('snake');}});
  el('snakeWrap').addEventListener('pointermove',function(e){
    if(!snakeSwipe||snakeSwipe.id!==e.pointerId)return;e.preventDefault();var dx=e.clientX-snakeSwipe.x,dy=e.clientY-snakeSwipe.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
    if(Math.abs(dx)>Math.abs(dy))turnSnake(dx>0?1:-1,0);else turnSnake(0,dy>0?1:-1);
    snakeSwipe.x=e.clientX;snakeSwipe.y=e.clientY;
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(name){el('snakeWrap').addEventListener(name,function(e){if(snakeSwipe&&snakeSwipe.id===e.pointerId)snakeSwipe=null;});});
  [['snakeUpBtn',0,-1],['snakeDownBtn',0,1],['snakeLeftBtn',-1,0],['snakeRightBtn',1,0]].forEach(function(spec){el(spec[0]).addEventListener('click',function(){turnSnake(spec[1],spec[2]);});});
  document.addEventListener('keydown',function(e){if(gameControlKey(e))return;
    if(arcadeGames.snake&&arcadeGames.snake.active){var dirs={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(dirs[e.key]){e.preventDefault();if(!e.repeat)turnSnake(dirs[e.key][0],dirs[e.key][1]);}else if(e.key===' '&&!e.repeat){e.preventDefault();beginArcadeAttempt('snake');}}
    else if(arcadeGames.brick&&arcadeGames.brick.active){var g=arcadeGames.brick;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();g.paddle.x=Math.max(8,Math.min(472-g.paddle.w,g.paddle.x+(e.key==='ArrowLeft'?-24:24)));}else if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();beginArcadeAttempt('brick');}}
    if(e.key==='Escape')exitGameFullscreen();
  });
  // Original one-touch alpine runner, inspired by Alto's Adventure's snowboard mechanic.
  var snowDefaultTerrain={terrainSeed:1,terrainCache:{}};
  function snowTerrainHash(seed,index){var value=Math.imul((seed^Math.imul(index+1,374761393))>>>0,668265263);value=Math.imul(value^(value>>>13),1274126177);return ((value^(value>>>16))>>>0)/4294967296;}
  function snowTerrainProfile(g,zone){
    if(g.terrainCache[zone])return g.terrainCache[zone];
    var seed=g.terrainSeed,roll=function(i){return snowTerrainHash(seed,zone*19+i);};
    var types=[[195,410,250,350],[160,180,440,350],[380,420,190,170],[230,235,420,210],[410,190,170,390],[175,430,410,190]],type=Math.floor(roll(0)*types.length);
    var knots=[0,260+(roll(1)-.5)*70,490+(roll(2)-.5)*70,850+(roll(3)-.5)*90,1100+(roll(4)-.5)*70,1400];
    function boundary(i){return i===0?280:210+snowTerrainHash(seed,i*211)*160;}
    var heights=[boundary(zone)];types[type].forEach(function(y,i){heights.push(Math.max(140,Math.min(450,y+(roll(i+5)-.5)*50)));});heights.push(boundary(zone+1));
    return g.terrainCache[zone]={knots:knots,heights:heights,type:type};
  }
  function snowGround(x){
    if(x<500)return 266+24*Math.sin(x/220)+16*Math.sin(x/92);
    if(x<600){
      var t=(x-500)/100,y=266+24*Math.sin(500/220)+16*Math.sin(500/92),slope=24/220*Math.cos(500/220)+16/92*Math.cos(500/92);
      return (2*t*t*t-3*t*t+1)*y+(t*t*t-2*t*t+t)*slope*100+(-2*t*t*t+3*t*t)*280;
    }
    var g=arcadeGames.snow||snowDefaultTerrain,zone=Math.floor((x-600)/1400),local=(x-600)-zone*1400,profile=snowTerrainProfile(g,zone);
    for(var i=1;i<profile.knots.length;i++)if(local<=profile.knots[i]){var t=(local-profile.knots[i-1])/(profile.knots[i]-profile.knots[i-1]);return profile.heights[i-1]+(profile.heights[i]-profile.heights[i-1])*(1-Math.cos(t*Math.PI))/2;}
    return profile.heights[profile.heights.length-1];
  }
  function snowSlope(x){return Math.atan((snowGround(x+2)-snowGround(x-2))/4);}
  function snowGapAt(g,x){return g.gaps.some(function(gap){return x>gap.x&&x<gap.x+gap.w;});}
  function snowSpeedPercent(g){return Math.max(100,Math.min(200,Number(g.speedPercent)||100));}
  function snowBaseSpeed(){return 220;}
  function snowSpeed(g){return snowBaseSpeed(g)*snowSpeedPercent(g)/100;}
  function snowPhysicsScale(g){return 1+(snowSpeedPercent(g)-100)/200;}
  function decaySnowSpeed(g,dt){
    if(!g.running||g.pausedAt!=null)return;
    if(snowSpeedPercent(g)<=100){g.speedPercent=100;g.speedDecayElapsed=0;return;}
    g.speedDecayElapsed=(g.speedDecayElapsed||0)+dt;
    var seconds=Math.floor(g.speedDecayElapsed+1e-9);
    if(seconds){g.speedPercent=Math.max(100,snowSpeedPercent(g)-seconds);g.speedDecayElapsed=Math.max(0,g.speedDecayElapsed-seconds);}
  }
  function snowRopeY(rope,x){var t=Math.max(0,Math.min(1,(x-rope.x)/rope.w));return rope.y0+(rope.y1-rope.y0)*t+16*Math.sin(t*Math.PI);}
  function initSnow(){
    var g=arcadeGames.snow;g.terrainSeed=Math.floor(Math.random()*4294967296)>>>0;g.terrainCache={};g.distance=0;g.coins=0;g.flips=0;g.combo=0;g.spawnIn=.8;g.wave=0;g.rocks=[];g.gaps=[];g.items=[];g.ropes=[];g.ramps=[];g.ice=[];g.houses=[];g.patternBag=[];g.lastPattern=null;g.nextFeatureX=0;
    g.effects=[];g.notice=null;g.held=false;g.graceUntil=0;g.speedPercent=100;g.speedDecayElapsed=0;g.lastTrickAt=-100;g.grindDistance=0;g.cameraY=snowGround(160)-245*snowViewHeight()/360;g.chaser=null;g.chasesEscaped=0;g.nextChaseAt=35;g.section='Bergstart';
    g.landingSmashUntil=0;
    g.player={y:snowGround(160)-28,h:28,vy:0,rotation:0,grounded:true,grinding:null};
  }
  function snowRecoveryPoint(g){
    var start=g.distance+160,clearAhead=Math.max(180,snowSpeed(g)*.75),lastHazard=Math.max.apply(null,[start,g.nextFeatureX].concat(g.gaps,g.rocks,g.ramps).map(function(o){return typeof o==='number'?o:o.x+o.w;}));
    for(var x=start;x<lastHazard+2800;x+=12){
      if(Math.abs(snowSlope(x))>.85)continue;
      if(g.gaps.some(function(o){return o.x<x+clearAhead&&o.x+o.w>x-28;}))continue;
      if(g.rocks.some(function(o){return o.x<x+clearAhead&&o.x+o.w>x-28;}))continue;
      if(g.ramps.some(function(o){return o.x<x+50&&o.x+o.w>x-28;}))continue;
      return x;
    }
    return lastHazard+2800;
  }
  function snowRecover(){
    var g=arcadeGames.snow,p=g.player,target=snowRecoveryPoint(g),screenY=p.y-g.cameraY;
    // Advance only to safe snow; preserve score, terrain, collectibles and progress.
    g.distance=target-160;g.effects=[];g.notice={text:'Sichere Weiterfahrt',until:g.elapsed+1.5};g.held=false;g.combo=0;p.vy=0;p.rotation=0;p.grounded=true;p.grinding=null;p.y=snowSurface(g,target)-p.h;
    g.cameraY=p.y-Math.max(60,Math.min(snowViewHeight()*.7,screenY));g.graceUntil=g.elapsed+1.5;g.landingSmashUntil=0;g.chaser=null;g.nextChaseAt=g.elapsed+30;
  }
  function snowPress(){if(arcadeGames.snow&&arcadeGames.snow.pausedAt!=null)return;var g=arcadeGames.snow;if(!g||!g.active)return;if(g.awaitingStart&&!beginArcadeAttempt('snow'))return;g.held=true;if(g.player.grounded){g.player.vy=-410*snowPhysicsScale(g);g.player.grounded=false;g.player.grinding=null;g.player.rotation=0;}}
  function snowRelease(){if(arcadeGames.snow)arcadeGames.snow.held=false;}
  function snowNextPattern(g){
    if(!g.patternBag.length){g.patternBag=['rocks','ravine','bunting','ramp','village','ice','doubleDrop'];for(var i=g.patternBag.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),tmp=g.patternBag[i];g.patternBag[i]=g.patternBag[j];g.patternBag[j]=tmp;}if(g.patternBag[0]===g.lastPattern){var tmp=g.patternBag[0];g.patternBag[0]=g.patternBag[1];g.patternBag[1]=tmp;}}
    g.lastPattern=g.patternBag.shift();return g.lastPattern;
  }
  function snowFeatureAnchor(g,start,pattern){
    var best=start,bestCost=Infinity,gapWidth=175+Math.min(5,Math.floor(g.elapsed/25))*10;
    for(var x=start;x<=start+(pattern==='ravine'?800:320);x+=20){
      var slope=Math.abs(snowSlope(x)),cost=slope+(x-start)/900;
      if(pattern==='ravine'){
        var launchY=snowGround(x-10)-24,farY=snowGround(x+15+gapWidth);
        // Leave ample headroom for a real 470 px/s ramp jump at base speed.
        if(farY<launchY-70||Math.abs(snowSlope(x-55))>.8)continue;
        cost=Math.abs(snowSlope(x-10))+(farY<launchY?.2:0)+(x-start)/1800;
      }else if(pattern==='ramp'||pattern==='doubleDrop')cost=Math.abs(snowSlope(x+55))+(x-start)/900;
      else if(pattern==='rocks'||pattern==='village'||pattern==='ice')cost+=Math.abs(snowGround(x+100)-snowGround(x))/70;
      if(cost<bestCost){bestCost=cost;best=x;}
    }
    return best;
  }
  function spawnSnowTerrain(){
    var g=arcadeGames.snow,x=Math.max(g.distance+Math.max(790,snowSpeed(g)*2.5),g.nextFeatureX),hard=Math.min(5,Math.floor(g.elapsed/25)),pattern=snowNextPattern(g),span=260;
    x=snowFeatureAnchor(g,x,pattern);
    var names={rocks:'Felsengarten',ravine:'Schluchtsprung',bunting:'Girlanden',ramp:'Sprungschanze',village:'Bergdorf',ice:'Eispiste',doubleDrop:'Doppelabfahrt'};g.section=names[pattern];
    if(pattern==='rocks'){g.rocks.push({x:x,w:32,h:22},{x:x+220,w:40,h:27+hard});span=300;}
    else if(pattern==='ravine'){g.ramps.push({x:x-55,w:45,launch:470});g.gaps.push({x:x+15,w:175+hard*10});span=240;}
    else if(pattern==='ramp'||pattern==='doubleDrop'){g.ramps.push({x:x,w:55,launch:500});if(pattern==='doubleDrop'){g.ramps.push({x:x+500,w:55,launch:500});span=580;}else span=300;}
    else if(pattern==='ice'){g.ice.push({x:x,w:270});g.rocks.push({x:x+190,w:35,h:25});span=320;}
    if(pattern==='bunting'||pattern==='village'){
      // Entry is near the highest ground in this part of the upcoming slope.
      var entry=x;for(var at=x;at<x+260;at+=20)if(snowGround(at)<snowGround(entry))entry=at;
      var width=330+Math.random()*120,minGround=Infinity;for(var at=entry;at<entry+width;at+=20)minGround=Math.min(minGround,snowGround(at));
      var y0=Math.min(snowGround(entry)-58,minGround-45);g.ropes.push({x:entry,w:width,y0:y0,y1:y0+22});span=entry-x+width+60;
      if(snowGround(entry)-y0>115)g.ramps.push({x:entry-60,w:40,launch:560});
      if(pattern==='village')for(var i=0;i<3;i++)g.houses.push({x:entry+i*135,w:74,h:40+i%2*16});
    }
    for(var i=0;i<8;i++){var coinX=x-35+i*Math.max(38,span/8);g.items.push({x:coinX,y:snowGround(coinX)-48-Math.sin(i/7*Math.PI)*70});}
    g.nextFeatureX=x+span+200;g.wave++;g.spawnIn=Math.max(1.6,(span+160)/snowSpeed(g));
  }
  function snowContactEffect(g,type,x,y,message){
    g.notice={text:message,until:g.elapsed+1.4};
    for(var i=0;i<(type==='rock'?12:8);i++)g.effects.push({x:x,y:y,vx:(Math.random()-.5)*150,vy:-40-Math.random()*110,life:.55,type:type});
  }
  function snowCompleteTrick(g,p,grindExit){
    var flips=Math.floor((Math.abs(p.rotation)+.25)/(Math.PI*2));
    if(flips||grindExit){g.flips+=flips;g.combo=g.elapsed-g.lastTrickAt<10?g.combo+1:1;g.lastTrickAt=g.elapsed;g.score+=(flips?100*flips:60)*Math.min(6,g.combo);
      if(flips){g.speedPercent=Math.min(200,snowSpeedPercent(g)+flips*20);g.speedDecayElapsed=0;}
    }
  }
  function updateSnowChaser(g,dt){
    if(!g.chaser&&g.elapsed>=g.nextChaseAt)g.chaser={gap:180,startFlips:g.flips,speed:snowSpeed(g)+16};
    if(!g.chaser)return;
    g.chaser.gap+=(snowSpeed(g)-g.chaser.speed)*dt;
    if(g.chaser.gap>=270&&g.flips-g.chaser.startFlips>=2){g.chasesEscaped++;g.score+=250;g.chaser=null;g.nextChaseAt=g.elapsed+30;}
    else if(g.chaser.gap<=28&&g.elapsed>=g.graceUntil)loseArcadeAttempt('snow','Verfolger zu nah');
  }
  function snowSurface(g,x){
    var y=snowGround(x);
    g.ramps.forEach(function(r){if(x>=r.x&&x<=r.x+r.w){var t=(x-r.x)/r.w;y=Math.min(y,snowGround(r.x)*(1-t)+(snowGround(r.x+r.w)-24)*t);}});
    return y;
  }
  function snowSurfaceSlope(g,x){return Math.atan((snowSurface(g,x+1)-snowSurface(g,x-1))/2);}
  function snowViewHeight(){return el('snowCanvas').height||360;}
  function updateSnowCamera(g,dt){
    var height=snowViewHeight(),scale=height/360,p=g.player;
    // Lead with the terrain entering at the right edge, not the rider's feet.
    var ahead=snowSurface(g,g.distance+640),deepest=ahead;
    for(var sx=160;sx<640;sx+=16)deepest=Math.max(deepest,snowSurface(g,g.distance+sx));
    var lower=Math.max(p.y-280*scale,deepest-height+48*scale),upper=p.y-60*scale;
    lower=Math.min(lower,upper);
    var target=Math.max(lower,Math.min(upper,ahead-245*scale));
    g.cameraY+=(target-g.cameraY)*(1-Math.exp(-dt*8));
    // Smoothing must not hide an approaching bank below the viewport.
    g.cameraY=Math.max(lower,Math.min(upper,g.cameraY));
  }
  function resizeSnowCanvas(){
    if(!arcadeGames.snow)return;
    var canvas=el('snowCanvas'),bounds=el('snowWrap').getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    var height=Math.max(360,Math.min(1400,Math.round(640*bounds.height/bounds.width)));
    if(canvas.width!==640)canvas.width=640;
    if(canvas.height!==height){arcadeGames.snow.cameraY-=(height-(canvas.height||360))*245/360;canvas.height=height;drawSnowGame();}
  }
  function snowRopeSlope(rope,x){return Math.atan((snowRopeY(rope,x+1)-snowRopeY(rope,x-1))/2);}
  function snowLandingAngle(rotation,slope){
    function angle(value){return Math.abs(Math.atan2(Math.sin(value),Math.cos(value)));}
    // Upright landings remain forgiving; aligned boards can also land on steep slopes.
    return Math.min(angle(rotation),angle(rotation-slope));
  }
  function snowRockPolygon(rock){
    var y=snowGround(rock.x);
    return [{x:rock.x,y:y},{x:rock.x+rock.w*.3,y:y-rock.h},{x:rock.x+rock.w*.75,y:y-rock.h*.8},{x:rock.x+rock.w,y:y}];
  }
  function snowRockTop(rock,x){
    var points=snowRockPolygon(rock),at=Math.max(rock.x,Math.min(rock.x+rock.w,x));
    for(var i=1;i<points.length;i++)if(at<=points[i].x){var a=points[i-1],b=points[i];return a.y+(b.y-a.y)*(at-a.x)/(b.x-a.x);}
    return points[3].y;
  }
  function snowRockLanding(rock,oldX,x,oldFeet,feet){
    var contact=null;
    [-12,0,12].forEach(function(offset){
      var at=x+offset,was=oldX+offset;if(at<rock.x||at>rock.x+rock.w)return;
      var top=snowRockTop(rock,at),oldTop=snowRockTop(rock,was);
      if((was<rock.x||was>rock.x+rock.w)&&oldFeet>snowGround(rock.x)-rock.h)return;
      if(oldFeet<=oldTop+.01&&feet>=top&&(contact===null||top<contact))contact=top;
    });
    if(contact===null)return null;
    // Keep the entire board above the rock, including its sloped leading face.
    return Math.min(contact,snowRockTop(rock,x-14),snowRockTop(rock,x),snowRockTop(rock,x+14),x-14<=rock.x+rock.w*.3&&x+14>=rock.x+rock.w*.3?snowGround(rock.x)-rock.h:Infinity);
  }
  function snowRiderPolygon(g,x){
    var p=g.player,angle=p.grinding?snowRopeSlope(p.grinding,x):p.grounded?snowSurfaceSlope(g,x):p.rotation,c=Math.cos(angle),s=Math.sin(angle);
    // Slightly inset from the board and head so visual grazes are forgiving.
    return [[-14,-2],[14,-2],[5,-26],[-5,-26]].map(function(point){return {x:x+point[0]*c-point[1]*s,y:p.y+p.h+point[0]*s+point[1]*c};});
  }
  function snowPolygonsOverlap(a,b){
    return [a,b].every(function(poly){return poly.every(function(point,i){
      var next=poly[(i+1)%poly.length],nx=point.y-next.y,ny=next.x-point.x;
      var pa=a.map(function(v){return v.x*nx+v.y*ny;}),pb=b.map(function(v){return v.x*nx+v.y*ny;});
      return Math.min.apply(null,pa)<Math.max.apply(null,pb)&&Math.min.apply(null,pb)<Math.max.apply(null,pa);
    });});
  }
  function updateSnowGame(dt){
    var g=arcadeGames.snow;if(!g||!g.running)return;
    // Sweep in small steps so a frame cannot skip a rope, hill face or narrow rock.
    for(var remaining=dt;remaining>1e-8&&g.running;remaining-=1/180)stepSnowPhysics(Math.min(remaining,1/180));
  }
  function stepSnowPhysics(dt){
    var g=arcadeGames.snow;if(!g||!g.running)return;
    dt=activeGameStep(g,dt);if(!dt)return;
    decaySnowSpeed(g,dt);
    g.elapsed+=dt;g.effects.forEach(function(effect){effect.x+=effect.vx*dt;effect.y+=effect.vy*dt;effect.vy+=350*dt;effect.life-=dt;});g.effects=g.effects.filter(function(effect){return effect.life>0;});var p=g.player,speed=snowSpeed(g),oldX=g.distance+160,oldGround=snowSurface(g,oldX),oldFeet=p.y+p.h,wasAirborne=!p.grounded&&!p.grinding;
    g.distance+=speed*dt;g.score+=Math.floor(g.distance/10)-Math.floor((oldX-160)/10);g.spawnIn-=dt;if(g.spawnIn<=0)spawnSnowTerrain();
    var x=g.distance+160,ground=snowSurface(g,x),protectedNow=g.elapsed<g.graceUntil;
    if(g.elapsed-g.lastTrickAt>10)g.combo=0;
    if(p.grinding){
      if(x<=p.grinding.x+p.grinding.w){p.y=snowRopeY(p.grinding,x)-p.h;p.rotation=0;p.grounded=true;g.grindDistance+=speed*dt;g.score+=Math.floor(g.grindDistance/40)-Math.floor((g.grindDistance-speed*dt)/40);}
      else{snowCompleteTrick(g,p,true);p.grinding=null;p.grounded=false;p.vy=0;}
    }
    if(!p.grinding){
      if(p.grounded&&(!snowGapAt(g,x)||protectedNow)){p.y=ground-p.h;p.rotation=0;
        var ramp=g.ramps.find(function(r){return !r.used&&oldX<=r.x+r.w&&x>=r.x+r.w;});if(ramp){ramp.used=true;p.y=snowGround(ramp.x+ramp.w)-24-p.h;p.grounded=false;p.vy=-ramp.launch*snowPhysicsScale(g);}
        if(g.ice.some(function(ice){return x>=ice.x&&x<=ice.x+ice.w;})){g.speedPercent=Math.max(150,snowSpeedPercent(g));}
      }else{
        p.grounded=false;p.vy+=720*snowPhysicsScale(g)*dt;p.y+=p.vy*dt;if(g.held)p.rotation-=4.34*dt;
        else{var upright=Math.round(p.rotation/(Math.PI*2))*Math.PI*2;p.rotation+=(upright-p.rotation)*(1-Math.exp(-dt*10));if(Math.abs(upright-p.rotation)<.01)p.rotation=upright;}
        var landingAngle=snowLandingAngle(p.rotation,0),rope=g.ropes.find(function(r){return x>=r.x&&x<=r.x+r.w&&oldFeet<=snowRopeY(r,oldX)+.01&&p.y+p.h>=snowRopeY(r,x);});
        if(rope)landingAngle=snowLandingAngle(p.rotation,snowRopeSlope(rope,x));
        // A missed grind is a fall-through, not a crash. Keep the airborne
        // motion so the rider can finish the rotation before reaching snow.
        if(rope&&(landingAngle<=.65||protectedNow)){snowCompleteTrick(g,p,false);p.grinding=rope;p.grounded=true;p.y=snowRopeY(rope,x)-p.h;p.vy=0;p.rotation=0;}
        else if((!snowGapAt(g,x)||protectedNow)&&oldFeet<=oldGround+.01&&p.y+p.h>=ground){
          landingAngle=snowLandingAngle(p.rotation,snowSurfaceSlope(g,x));
          if(landingAngle>.75&&!protectedNow){loseArcadeAttempt('snow','Unsanfte Landung');return;}snowCompleteTrick(g,p,false);p.y=ground-p.h;p.vy=0;p.rotation=0;p.grounded=true;
        }
      }
    }
    // The far bank is solid terrain. A board reaching it below its lip hits
    // the cliff face; it must not travel underneath the snow silhouette.
    if(!protectedNow&&!p.grinding&&g.gaps.some(function(gap){
      var lip=gap.x+gap.w;return oldX+14<=lip&&x+14>=lip&&!snowGapAt(g,lip+.01)&&p.y+p.h>snowSurface(g,lip)+2;
    })){loseArcadeAttempt('snow','Pistenkante getroffen');return;}
    if(!protectedNow&&!p.grounded&&!p.grinding&&!snowGapAt(g,x)&&oldFeet>oldGround+.01&&p.y+p.h>ground+2){loseArcadeAttempt('snow','Piste getroffen');return;}
    if(wasAirborne&&(p.grounded||p.grinding))g.landingSmashUntil=g.elapsed+1;
    var boosted=snowSpeedPercent(g)>=150||g.elapsed<(g.landingSmashUntil||0);
    var rider=snowRiderPolygon(g,x);
    for(var rockIndex=g.rocks.length-1;rockIndex>=0;rockIndex--){
      var rock=g.rocks[rockIndex];
      if(rock.x+rock.w<g.distance-50){g.rocks.splice(rockIndex,1);continue;}
      if(rock.x>x+32||rock.x+rock.w<x-32)continue;
      var rockLanding=!boosted&&wasAirborne&&p.vy>0&&!p.grinding&&snowLandingAngle(p.rotation,0)<=.75?snowRockLanding(rock,oldX,x,oldFeet,p.y+p.h):null;
      if(rockLanding!==null){
        snowContactEffect(g,'snow',x,rockLanding,'Abgefedert');snowCompleteTrick(g,p,false);p.y=rockLanding-p.h;p.vy=-Math.max(130,Math.min(170,p.vy*.3))*snowPhysicsScale(g);p.rotation=0;p.grounded=false;wasAirborne=false;rider=snowRiderPolygon(g,x);continue;
      }
      if(!snowPolygonsOverlap(rider,snowRockPolygon(rock)))continue;
      if(boosted){snowContactEffect(g,'rock',rock.x+rock.w/2,snowGround(rock.x)-rock.h/2,'Stein zertrümmert · +30');g.score+=30;g.rocks.splice(rockIndex,1);}
      else if(!protectedNow){loseArcadeAttempt('snow','Stein getroffen');return;}
    }
    if(p.y>ground+200){loseArcadeAttempt('snow','Schlucht verfehlt');return;}
    g.items=g.items.filter(function(coin){if(Math.abs(coin.x-x)<24&&Math.abs(coin.y-(p.y+14))<25){g.coins++;g.score+=20;return false;}return coin.x>g.distance-30;});
    ['gaps','ropes','ramps','ice','houses'].forEach(function(key){g[key]=g[key].filter(function(o){return o.x+o.w>g.distance-50;});});
    updateSnowCamera(g,dt);
    updateSnowChaser(g,dt);
  }
  function snowMountain(ctx,offset,height,color,scale){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,snowViewHeight());for(var x=-120;x<800;x+=80){var y=height-30*Math.sin((x+offset*scale)/145)-22*Math.cos((x+offset*scale)/76);ctx.lineTo(x,y);}ctx.lineTo(640,snowViewHeight());ctx.closePath();ctx.fill();}
  function drawSnowGame(){
    var g=arcadeGames.snow,ctx=g.ctx,p=g.player,phase=Math.floor(g.elapsed/45)%3,viewHeight=snowViewHeight(),horizon=viewHeight*.55;
    var sky=ctx.createLinearGradient(0,0,0,viewHeight);sky.addColorStop(0,['#171e38','#33243d','#101a30'][phase]);sky.addColorStop(1,['#695573','#8b5968','#465574'][phase]);ctx.fillStyle=sky;ctx.fillRect(0,0,640,viewHeight);drawHalloweenSky(ctx,640,viewHeight,g.elapsed,false);
    snowMountain(ctx,g.distance,horizon-43,'#48455f',.12);snowMountain(ctx,g.distance,horizon+6,'#343c55',.25);
    // Distant village and pines move slowly; the foreground is collision terrain.
    for(var i=0;i<8;i++){var treeX=((i*130-g.distance*.4)%800+800)%800-80,treeY=horizon+47;ctx.fillStyle='#557c85';ctx.beginPath();ctx.moveTo(treeX,treeY-45);ctx.lineTo(treeX-15,treeY);ctx.lineTo(treeX+15,treeY);ctx.fill();}
    ctx.save();ctx.translate(0,-g.cameraY);ctx.fillStyle='#f5faf7';
    // Cut actual holes out of the snow silhouette. The sky and distant scenery
    // have already been drawn, so ravines reveal that background naturally.
    function snowSegment(left,right){
      if(right<=left)return;ctx.beginPath();ctx.moveTo(left,g.cameraY+viewHeight);
      for(var sx=left;sx<right;sx+=4)ctx.lineTo(sx,snowGround(g.distance+sx));
      ctx.lineTo(right,snowGround(g.distance+right));ctx.lineTo(right,g.cameraY+viewHeight);ctx.closePath();ctx.fill();
    }
    var edge=0;g.gaps.slice().sort(function(a,b){return a.x-b.x;}).forEach(function(gap){
      var left=Math.max(0,gap.x-g.distance),right=Math.min(640,gap.x+gap.w-g.distance);
      if(right<=0||left>=640)return;snowSegment(edge,left);edge=Math.max(edge,right);
    });snowSegment(edge,640);
    g.rocks.forEach(function(rock){var points=snowRockPolygon(rock);ctx.fillStyle='#607887';ctx.beginPath();points.forEach(function(point,i){if(i)ctx.lineTo(point.x-g.distance,point.y);else ctx.moveTo(point.x-g.distance,point.y);});ctx.closePath();ctx.fill();ctx.strokeStyle='#e6f0ef';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(points[1].x-g.distance,points[1].y);ctx.lineTo(points[2].x-g.distance,points[2].y);ctx.stroke();});
    g.ice.forEach(function(ice){ctx.strokeStyle='#82dbea';ctx.lineWidth=6;ctx.beginPath();for(var at=ice.x;at<=ice.x+ice.w;at+=12){var sx=at-g.distance,y=snowGround(at);if(at===ice.x)ctx.moveTo(sx,y);else ctx.lineTo(sx,y);}ctx.stroke();});
    g.ramps.forEach(function(r){ctx.fillStyle='#c79469';ctx.beginPath();ctx.moveTo(r.x-g.distance,snowGround(r.x));ctx.lineTo(r.x+r.w-g.distance,snowGround(r.x+r.w)-24);ctx.lineTo(r.x+r.w-g.distance,snowGround(r.x+r.w));ctx.fill();});
    g.houses.forEach(function(h){var x=h.x-g.distance,y=snowGround(h.x);ctx.fillStyle='#8a6978';ctx.fillRect(x,y-h.h,h.w,h.h);ctx.fillStyle='#f7faf5';ctx.beginPath();ctx.moveTo(x-6,y-h.h);ctx.lineTo(x+h.w/2,y-h.h-26);ctx.lineTo(x+h.w+6,y-h.h);ctx.fill();ctx.fillStyle='#f9de99';ctx.fillRect(x+15,y-h.h+12,12,14);});
    g.ropes.forEach(function(r){ctx.strokeStyle='#506e78';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r.x-g.distance,snowGround(r.x));ctx.lineTo(r.x-g.distance,r.y0-12);ctx.moveTo(r.x+r.w-g.distance,snowGround(r.x+r.w));ctx.lineTo(r.x+r.w-g.distance,r.y1-12);ctx.stroke();ctx.beginPath();for(var at=r.x;at<=r.x+r.w;at+=10){var x=at-g.distance,y=snowRopeY(r,at);if(at===r.x)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();for(var at=r.x+15,n=0;at<r.x+r.w;at+=28,n++){var x=at-g.distance,y=snowRopeY(r,at);ctx.fillStyle=['#ef8b89','#ffd374','#83c6c0'][n%3];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+17,y+1);ctx.lineTo(x+8,y+17);ctx.fill();}});
    if(g.chaser){var chaseX=160-g.chaser.gap,worldX=g.distance+chaseX,y=snowGround(worldX);ctx.strokeStyle='#8a493e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(chaseX-13,y);ctx.lineTo(chaseX+16,y);ctx.moveTo(chaseX,y-4);ctx.lineTo(chaseX,y-23);ctx.lineTo(chaseX+11,y-12);ctx.stroke();ctx.fillStyle='#8a493e';ctx.beginPath();ctx.arc(chaseX,y-30,6,0,Math.PI*2);ctx.fill();}
    g.items.forEach(function(coin){ctx.fillStyle='#ecc368';ctx.beginPath();ctx.arc(coin.x-g.distance,coin.y,6,0,Math.PI*2);ctx.fill();});
    g.effects.forEach(function(effect){ctx.globalAlpha=Math.max(0,effect.life/.55);ctx.fillStyle=effect.type==='rock'?'#607887':'#ffffff';ctx.beginPath();var ex=effect.x-g.distance;ctx.moveTo(ex-3,effect.y+2);ctx.lineTo(ex,effect.y-3);ctx.lineTo(ex+4,effect.y+1);ctx.closePath();ctx.fill();});ctx.globalAlpha=1;
    if(g.elapsed<g.graceUntil){ctx.strokeStyle='#65cddd';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(160,p.y+12,22,28,0,0,Math.PI*2);ctx.stroke();}
    ctx.save();ctx.translate(160,p.y+p.h);ctx.rotate(p.grinding?snowRopeSlope(p.grinding,g.distance+160):p.grounded?snowSurfaceSlope(g,g.distance+160):p.rotation);ctx.translate(0,-14);
    ctx.strokeStyle='#314b5c';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-16,14);ctx.lineTo(17,14);ctx.moveTo(-4,10);ctx.lineTo(0,-2);ctx.lineTo(5,5);ctx.stroke();ctx.fillStyle='#314b5c';ctx.beginPath();ctx.arc(1,-9,5,0,Math.PI*2);ctx.fill();runnerPoly(ctx,[[-7,-13],[0,-26],[7,-13]],'#644776');ctx.fillStyle='#644776';ctx.fillRect(-9,-14,19,3);
    if(snowSpeedPercent(g)>100){ctx.strokeStyle='#eead56';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20,6);ctx.lineTo(-55,4);ctx.moveTo(-24,13);ctx.lineTo(-65,13);ctx.stroke();}
    ctx.strokeStyle='#ed826c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-2,-3);ctx.lineTo(-22,Math.sin(g.elapsed*12)*4);ctx.stroke();ctx.restore();ctx.restore();
    ctx.fillStyle='rgba(16,19,36,.72)';ctx.fillRect(0,0,640,102);
    ctx.fillStyle='#f2e8db';ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.fillText('Münzen: '+g.coins+' · Saltos: '+g.flips,14,26);ctx.textAlign='right';ctx.fillText(Math.floor(g.distance/10)+' m',626,26);
    ctx.fillText('Tempo: '+Math.round(snowSpeedPercent(g))+'%',14,47);
    ctx.textAlign='center';ctx.fillText(g.section+' · Combo ×'+Math.max(1,g.combo),320,47);
    if(g.chaser){ctx.fillStyle='#ffb9a3';ctx.fillText('Verfolger! '+Math.max(0,Math.ceil(g.chaser.gap/10))+' m · Backflips!',320,68);}
    else if(snowSpeedPercent(g)>=150){ctx.fillStyle='#ffd58b';ctx.fillText('Steine zertrümmern!',320,68);}else if(g.elapsed<g.graceUntil)ctx.fillText('Kurz geschützt',320,68);
    if(g.notice&&g.elapsed<g.notice.until){ctx.fillStyle='#f2e8db';ctx.font='bold 13px sans-serif';ctx.fillText(g.notice.text,320,90);}
  }
  el('snowWrap').addEventListener('pointerdown',function(e){e.preventDefault();if(el('snowWrap').setPointerCapture)el('snowWrap').setPointerCapture(e.pointerId);snowPress();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(name){el('snowWrap').addEventListener(name,snowRelease);});
  document.addEventListener('keydown',function(e){if(gameControlKey(e))return;if(arcadeGames.snow&&arcadeGames.snow.active&&(e.key===' '||e.key==='ArrowUp')){e.preventDefault();if(!e.repeat)snowPress();}});
  document.addEventListener('keyup',function(e){if(e.key===' '||e.key==='ArrowUp')snowRelease();});

  // Layout immersion works without native fullscreen on iPhone/iPad.
  var fullscreenScreen=null;
  function gameControlKey(e){return e.target&&e.target.closest&&e.target.closest('.game-immersive button');}
  function gameForScreen(screen){var kind=screen.id.replace('screen-','');return kind==='game'?rewardGame:kind==='flappy'?flappyGame:kind==='tower'?towerGame:kind==='gravity'?gravityGame:arcadeGames[kind];}
  function enterGameFullscreen(screen){
    fullscreenScreen=screen;screen.classList.add('game-immersive');document.body.classList.add('game-immersive-open');
    if(arcadeGames.brick)arcadeGames.brick.inputRect=null;
    if(screen.id==='screen-snow')resizeSnowCanvas();if(screen.id==='screen-runner')resizeRunnerCanvas();if(extraArcade.definitions[screen.id.replace('screen-','')])resizeExtraCanvases();
  }
  function resumeGame(screen){
    var g=gameForScreen(screen);if(!g||g.pausedAt==null)return;
    g.pausedAt=null;g.lastFrame=performance.now();screen.classList.remove('is-paused');
    el(screen.id.replace('screen-','')+'PauseBtn').textContent='Ⅱ';el(screen.id.replace('screen-','')+'PauseBtn').setAttribute('aria-label','Spiel pausieren');
  }
  function pauseGame(screen){
    var g=gameForScreen(screen);if(!g||!g.active)return;
    if(g.pausedAt!=null){resumeGame(screen);return;}
    g.pausedAt=Date.now();if(g.touchTarget!==undefined)g.touchTarget=null;if(extraPointers)Object.keys(extraPointers).forEach(function(k){delete extraPointers[k];});if(g.held!==undefined)g.held=false;if(g.keys)Object.keys(g.keys).forEach(function(k){g.keys[k]=false;});if(g.axis!==undefined)g.axis=0;if(g.pointerX!==undefined)g.pointerX=null;screen.classList.add('is-paused');
    var button=el(screen.id.replace('screen-','')+'PauseBtn');button.textContent='▶';button.setAttribute('aria-label','Spiel fortsetzen');
  }
  function exitGameFullscreen(){
    if(fullscreenScreen){resumeGame(fullscreenScreen);fullscreenScreen.classList.remove('game-immersive');fullscreenScreen.classList.remove('is-paused');var pauseButton=el(fullscreenScreen.id.replace('screen-','')+'PauseBtn');pauseButton.textContent='Ⅱ';pauseButton.setAttribute('aria-label','Spiel pausieren');fullscreenScreen=null;document.body.classList.remove('game-immersive-open');}
    if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});
    if(arcadeGames.brick)arcadeGames.brick.inputRect=null;
  }
  ['game','flappy','tower','gravity','brick','snake','snow','runner','doodle','tiles','maze','asteroid'].forEach(function(kind){
    var screen=el('screen-'+kind),button=el(kind+'FullscreenBtn');
    button.setAttribute('aria-label','Browser-Vollbild umschalten');
    el(kind+'PauseBtn').addEventListener('click',function(){pauseGame(screen);});
    button.addEventListener('click',function(){if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});else if(screen.requestFullscreen)screen.requestFullscreen().catch(function(){});});
  });
  document.addEventListener('fullscreenchange',function(){if(arcadeGames.brick)arcadeGames.brick.inputRect=null;});
  document.addEventListener('visibilitychange',function(){if(document.hidden&&fullscreenScreen){var g=gameForScreen(fullscreenScreen);if(g&&g.pausedAt==null)pauseGame(fullscreenScreen);}});

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
    state.today.focusTable = null;
    state.today.mode = 'mixed';
    state.today.queue = buildQueue(tasks, null, 'mixed');
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

  function updateViewport(){
    var viewport=window.visualViewport;
    var active=document.activeElement,editing=active&&/^(INPUT|TEXTAREA)$/.test(active.tagName);
    var standalone=navigator.standalone===true||!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
    document.body.classList.toggle('standalone-app',standalone);
    var height=viewport&&editing?viewport.height:0;
    // Installed iOS apps can report dvh/visualViewport without the safe areas
    // on launch. With no browser toolbar, vh is the full app window height.
    document.documentElement.style.setProperty('--app-height',height>0?height+'px':standalone?'100vh':'100dvh');
    requestAnimationFrame(function(){resizeSnowCanvas();resizeRunnerCanvas();resizeExtraCanvases();});
    if(arcadeGames.brick)arcadeGames.brick.inputRect=null;
  }
  function settleViewport(){
    updateViewport();
    requestAnimationFrame(function(){updateViewport();requestAnimationFrame(updateViewport);});
    // Safari finishes toolbar and rotation animations after the first frames.
    setTimeout(updateViewport,300);setTimeout(updateViewport,800);
  }
  window.addEventListener('resize',updateViewport);
  window.addEventListener('load',settleViewport);
  window.addEventListener('pageshow',settleViewport);
  window.addEventListener('orientationchange',settleViewport);
  document.addEventListener('focusin',updateViewport);
  document.addEventListener('focusout',function(){requestAnimationFrame(updateViewport);});
  if(window.visualViewport){window.visualViewport.addEventListener('resize',updateViewport);window.visualViewport.addEventListener('scroll',function(){requestAnimationFrame(updateViewport);});}
  if(window.ResizeObserver)new window.ResizeObserver(function(){resizeSnowCanvas();}).observe(el('snowWrap'));
  if(window.ResizeObserver)new window.ResizeObserver(resizeRunnerCanvas).observe(el('runnerWrap'));
  if(window.ResizeObserver)extraArcade.kinds.forEach(function(kind){new window.ResizeObserver(resizeExtraCanvases).observe(el(kind+'Wrap'));});
  // ---------- init ----------
  ensureFactPool();
  applyAccentTheme(state.config.accentTheme);
  saveState();
  renderHome();
  settleViewport();

  var demoMatch=location.search.match(/[?&]demo=(flappy|tower|gravity|brick|snake|snow|runner|doodle|tiles|maze|asteroid)(?:&|$)/);
  if(demoMatch){if(demoMatch[1]==='flappy')startFlappyGame(true);else if(demoMatch[1]==='gravity')startGravityGame(true);else if(demoMatch[1]==='brick'||demoMatch[1]==='snake'||demoMatch[1]==='snow'||demoMatch[1]==='runner'||extraArcade.definitions[demoMatch[1]])startArcadeGame(demoMatch[1],true);else startTowerGame(true);}

  if ('serviceWorker' in navigator && location.protocol !== 'file:'){
    navigator.serviceWorker.register('sw.js').catch(function(){ /* offline support only */ });
  }

})();
