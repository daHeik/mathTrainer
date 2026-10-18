'use strict';

// Run with: node tests/learning-modes.test.js
// A small DOM stand-in exercises the real app without dependencies or site data.
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function Element(){
  this.children = [];
  this.style = { setProperty:function(){} };
  this.dataset = {};
  this.events = {};
  this.textContent = '';
  var classes = new Set();
  this.classList = {
    add:function(value){ classes.add(value); },
    remove:function(value){ classes.delete(value); },
    contains:function(value){ return classes.has(value); },
    toggle:function(value, enabled){ if (enabled) classes.add(value); else classes.delete(value); }
  };
}
Element.prototype.addEventListener = function(name, callback){ this.events[name] = callback; };
Element.prototype.appendChild = function(child){ this.children.push(child); };
Element.prototype.setAttribute = function(){};
Element.prototype.removeAttribute = function(){};
Element.prototype.getAttribute = function(){ return ''; };
Element.prototype.blur = function(){};
Element.prototype.getContext = function(){
  return new Proxy({
    measureText:function(){ return { width:1 }; },
    createLinearGradient:function(){ return { addColorStop:function(){} }; }
  }, { get:function(target, key){ return key in target ? target[key] : function(){}; } });
};
Element.prototype.getBoundingClientRect = function(){ return { left:0, top:0, width:480, height:480 }; };
Element.prototype.focus = function(){ context.document.activeElement = this; };
Element.prototype.setSelectionRange = function(start, end){ this.selectionStart = start; this.selectionEnd = end; };
Element.prototype.click = function(){ if (this.events.click) this.events.click(); };
Element.prototype.querySelector = function(){ return new Element(); };
Element.prototype.querySelectorAll = function(selector){
  return this.children.filter(function(child){ return child.className.split(' ').indexOf(selector.slice(1)) !== -1; });
};
Object.defineProperty(Element.prototype, 'innerHTML', {
  set:function(){ this.children = []; }, get:function(){ return ''; }
});

var elements = {};
Array.from(html.matchAll(/id="([^"]+)"/g)).forEach(function(match){
  assert(!elements[match[1]], 'Duplicate DOM id ' + match[1]);
  elements[match[1]] = new Element(); elements[match[1]].id = match[1];
});
var storage = {};
var timers = [];
var context = {
  console:console, Date:Date, Math:Object.create(Math), Set:Set,
  document:{
    documentElement:new Element(), activeElement:null, body:new Element(),
    getElementById:function(id){ assert(elements[id], 'Missing DOM id ' + id); return elements[id]; },
    querySelector:function(){ return new Element(); }, querySelectorAll:function(){ return []; },
    createElement:function(){ return new Element(); },
    createElementNS:function(){ return new Element(); },
    createTextNode:function(value){ var node = new Element(); node.textContent = value; return node; },
    addEventListener:function(){}
  },
  window:{ scrollTo:function(){}, addEventListener:function(){} },
  localStorage:{ getItem:function(key){ return storage[key] || null; }, setItem:function(key, value){ storage[key] = value; } },
  performance:{ now:function(){ return 1; } },
  location:{ search:'', protocol:'file:' }, navigator:{},
  setTimeout:function(callback){ timers.push(callback); },
  requestAnimationFrame:function(){ return 1; }, cancelAnimationFrame:function(){}
};
vm.createContext(context);
source = source.replace(/\}\)\(\);\s*$/, [
  'globalThis.testApi = {',
  'defaultProfile:defaultProfile, normalizeProfile:normalizeProfile, ensureFactPool:ensureFactPool,',
  'practiceSkill:practiceSkill, practiceSkillsInRange:practiceSkillsInRange, buildQueue:buildQueue,',
  'specialQuestion:specialQuestion, applyAnswerResult:applyAnswerResult,',
  'writtenDivisionQuestion:writtenDivisionQuestion, renderWrittenDivision:renderWrittenDivision,',
  'correctAnswersForProfile:correctAnswersForProfile, startSession:startSession,',
  'renderQuestion:renderQuestion, onAnswer:onAnswer, finishSession:finishSession,',
  'refreshDailySessionIfNeeded:refreshDailySessionIfNeeded, repeatRoundLabel:repeatRoundLabel,',
  'tapAdvance:tapAdvance,',
  'games:function(){return {dino:rewardGame,flappy:flappyGame,tower:towerGame,gravity:gravityGame,brick:arcadeGames.brick,snake:arcadeGames.snake,snow:arcadeGames.snow};},',
  'activeGameStep:activeGameStep, pauseGame:pauseGame, resumeGame:resumeGame,',
  'stepGame:function(kind,dt){({dino:updateRewardGame,flappy:updateFlappyGame,tower:updateTowerGame,gravity:updateGravityGame,brick:updateBrickGame,snake:updateSnakeGame,snow:updateSnowGame})[kind](dt);},',
  'pickNextSticker:pickNextSticker, stickerPool:STICKER_POOL,',
  'getState:function(){ return state; },',
  'setState:function(profile){ state = profile; root.profiles[root.activeProfileId] = profile; }',
  '};})();'
].join('\n'));
vm.runInContext(source, context);
var api = context.testApi;
var profile = api.defaultProfile();
profile.config.sound = false;
profile.config.min = 5;
profile.config.max = 5;
profile.config.enabledTables = [5];
api.normalizeProfile(profile);
api.setState(profile);
api.ensureFactPool();

// All 1..10 families are available independently of mixed-round settings.
assert.strictEqual(api.practiceSkillsInRange(null, 'hundreds').length, 110);
assert.strictEqual(api.practiceSkillsInRange(null, 'terms').length, 8);
assert.strictEqual(api.practiceSkillsInRange(null, 'riddles').length, 8);
assert.strictEqual(api.practiceSkillsInRange(null, 'mixed').length, 1);
assert.strictEqual(api.specialQuestion(api.practiceSkill('h:m:7x7')).gen.correct, 490);
assert.strictEqual(api.specialQuestion(api.practiceSkill('h:m:10x10')).gen.correct, 1000);
assert.strictEqual(api.practiceSkill('h:invalid:3x7'), null);

['hundreds', 'terms', 'riddles'].forEach(function(mode){
  var queue = api.buildQueue(5, null, mode);
  assert.strictEqual(queue.length, 5);
  assert.strictEqual(new Set(queue).size, 5);
  if (mode === 'hundreds') assert(queue.some(function(key){ return key.indexOf('h:d:') === 0; }));
  api.practiceSkillsInRange(null, mode).forEach(function(skill){
    for (var sample = 0; sample < 100; sample++){
      var question = api.specialQuestion(skill);
      assert.strictEqual(question.gen.options.length, 4);
      assert.strictEqual(new Set(question.gen.options).size, question.gen.options.length);
      assert(question.gen.options.indexOf(question.gen.correct) !== -1);
      if (typeof question.gen.correct === 'number'){
        assert(Number.isInteger(question.gen.correct));
        assert(question.gen.correct >= 0 && question.gen.correct <= 1000);
      }
      if (mode === 'hundreds'){
        var numbers = question.prompt.match(/\d+/g).map(Number);
        var expected = skill.displayOperation === 'divide' ? numbers[0] / numbers[1] : numbers[0] * numbers[1];
        assert.strictEqual(question.gen.correct, expected);
        var scaleError = skill.displayOperation === 'divide' ? expected * 10 : expected / 10;
        assert(question.gen.options.indexOf(scaleError) !== -1);
      }
      if (mode === 'riddles') assert(question.explanation.indexOf(String(question.gen.correct)) !== -1);
      if (mode === 'riddles'){
        question.gen.options.forEach(function(value){
          assert(Number.isInteger(value) && value >= 0);
        });
        var values = question.prompt.match(/\d+/g).map(Number);
        var expectedRiddle;
        switch (skill.riddleType){
          case 'halfAdd': expectedRiddle = values[0] / 2 + values[1]; break;
          case 'halfSubtract': expectedRiddle = values[1] / 2 - values[0]; break;
          case 'doubleAdd': expectedRiddle = values[0] * 2 + values[1]; break;
          case 'doubleSubtract': expectedRiddle = values[1] * 2 - values[0]; break;
          case 'sumDouble': expectedRiddle = (values[0] + values[1]) * 2; break;
          case 'differenceHalf': expectedRiddle = (values[0] - values[1]) / 2; break;
          case 'productAdd': expectedRiddle = values[0] * values[1] + values[2]; break;
          case 'quotientAdd': expectedRiddle = values[0] / values[1] + values[2]; break;
        }
        assert.strictEqual(question.gen.correct, expectedRiddle);
      }
    }
  });
  api.startSession(false, null, mode);
  assert.strictEqual(profile.today.mode, mode);
  api.startSession(true, null, profile.today.mode);
  assert.strictEqual(profile.today.mode, mode);
  assert(api.repeatRoundLabel(false).length > 'Noch einmal 🔁'.length);
});

context.Math.random = function(){ return 0.75; };
var hundredsExample = api.specialQuestion(api.practiceSkill('h:d:5x9'));
assert.strictEqual(hundredsExample.prompt, '450 ÷ 50');
assert.strictEqual(hundredsExample.gen.correct, 9);
assert(hundredsExample.gen.options.indexOf(90) !== -1);

var randomValues = [0, 0, 0, 0.5];
context.Math.random = function(){ return randomValues.length ? randomValues.shift() : 0.5; };
var productExample = api.specialQuestion(api.practiceSkill('t:product'));
assert.strictEqual(productExample.prompt, 'Das Produkt aus 1 und 6');
assert.strictEqual(productExample.gen.correct, 6);
assert.strictEqual(productExample.gen.options.length, 4);
[5, 6, 7].forEach(function(value){ assert(productExample.gen.options.indexOf(value) !== -1); });
assert(productExample.gen.options.indexOf(4) !== -1 || productExample.gen.options.indexOf(8) !== -1);
randomValues = [0, 0, 0.5, 0.2];
var quotientExample = api.specialQuestion(api.practiceSkill('t:quotient'));
assert.strictEqual(quotientExample.prompt, 'Der Quotient aus 18 und 6');
assert.deepStrictEqual(Array.from(quotientExample.gen.options).sort(function(a, b){ return a - b; }), [3, 12, 24, 108]);
randomValues = [0.9, 0.2];
var example = api.specialQuestion(api.practiceSkill('r:halfAdd'));
assert.strictEqual(example.prompt, 'Addiere die Hälfte von 100 mit 20.');
assert.strictEqual(example.gen.correct, 70);
randomValues = [0.23, 0];
example = api.specialQuestion(api.practiceSkill('r:sumDouble'));
assert.strictEqual(example.prompt, 'Verdopple die Summe aus 40 und 10.');
assert.deepStrictEqual(Array.from(example.gen.options).sort(function(a, b){ return a - b; }), [50, 70, 90, 100]);
randomValues = [0, 0.4];
example = api.specialQuestion(api.practiceSkill('r:doubleAdd'));
assert.strictEqual(example.prompt, 'Meine Zahl ist die Summe aus dem Doppelten von 20 und 30.');
assert.strictEqual(example.gen.correct, 70);
context.Math.random = Math.random;

// Every numeric mode follows the same adaptive threshold and learning rules.
['5x5', 'h:m:5x5', 'h:d:5x5', 'r:halfAdd', 'r:halfSubtract',
  'r:doubleAdd', 'r:doubleSubtract', 'r:sumDouble', 'r:differenceHalf',
  'r:productAdd', 'r:quotientAdd'].forEach(function(key){
  var adaptiveProfile = api.defaultProfile();
  adaptiveProfile.config.sound = false;
  adaptiveProfile.config.answerMode = 'adaptive';
  api.normalizeProfile(adaptiveProfile);
  api.setState(adaptiveProfile);
  api.ensureFactPool();
  adaptiveProfile.today.queue = [key];
  adaptiveProfile.today.index = 0;
  var record = api.practiceSkill(key).record;
  api.renderQuestion();
  assert.strictEqual(elements.choicesWrap.children.length, 4);
  assert(!elements.choicesWrap.classList.contains('keypad'));
  api.applyAnswerResult(key, true, 1000);
  api.renderQuestion();
  assert.strictEqual(record.box, 0);
  assert(!elements.choicesWrap.classList.contains('keypad'));
  api.applyAnswerResult(key, true, 1000);
  api.renderQuestion();
  assert.strictEqual(record.box, 2);
  assert(elements.choicesWrap.classList.contains('keypad'));
  assert.strictEqual(elements.choicesWrap.children.length, 12);
  // Loading a saved profile retains the threshold and its input mode.
  adaptiveProfile = api.normalizeProfile(JSON.parse(JSON.stringify(adaptiveProfile)));
  api.setState(adaptiveProfile);
  api.renderQuestion();
  assert(elements.choicesWrap.classList.contains('keypad'));
  api.applyAnswerResult(key, false, 1000);
  api.renderQuestion();
  assert(!elements.choicesWrap.classList.contains('keypad'));
  // Respect explicit parental settings even for well-practiced tasks.
  api.practiceSkill(key).record.box = 2;
  adaptiveProfile.config.answerMode = 'choice';
  api.renderQuestion();
  assert(!elements.choicesWrap.classList.contains('keypad'));
  adaptiveProfile.config.answerMode = 'input';
  api.practiceSkill(key).record.box = 0;
  api.renderQuestion();
  assert(elements.choicesWrap.classList.contains('keypad'));
});
api.setState(profile);

// 1000 must be enterable in the actual keypad, including a terminal zero.
profile.config.answerMode = 'input';
api.startSession(false, null, 'hundreds');
profile.today.queue = ['h:m:10x10']; profile.today.index = 0;
api.renderQuestion();
['1', '0', '0', '0', 'OK'].forEach(function(digit){
  elements.choicesWrap.children.find(function(button){ return button.textContent === digit; }).events.click();
});
assert.strictEqual(profile.facts['10x10'].hundreds.multiply.correctCount, 1);
profile.config.answerMode = 'adaptive';

// Text answers are highlighted correctly, counted, and wrong answers requeued.
api.startSession(false, null, 'terms');
profile.today.queue = ['t:addition']; profile.today.index = 0;
api.renderQuestion();
var correctButton = elements.choicesWrap.children.find(function(button){ return button.textContent === 'Addition'; });
correctButton.events.click();
assert(correctButton.classList.contains('correct'));
assert.strictEqual(profile.termSkills.addition.correctCount, 1);
assert(elements.feedbackText.textContent.indexOf('Summe') !== -1);
profile.today.queue = ['t:division']; profile.today.index = 0; profile.today.requeueCounts = {};
api.renderQuestion();
elements.choicesWrap.children.find(function(button){ return button.textContent === 'Addition'; }).events.click();
assert.strictEqual(profile.termSkills.division.wrongCount, 1);
assert.strictEqual(profile.today.queue.length, 2);

// Separate learning records still contribute to the shared reward counter.
api.applyAnswerResult('h:m:7x7', true, 1000);
api.applyAnswerResult('r:halfAdd', true, 1000);
assert.strictEqual(profile.facts['7x7'].correctCount, 0);
assert.strictEqual(api.correctAnswersForProfile(profile), 4);

// Backups retain all modes and legitimate repeated keys in long rounds.
profile.today.mode = 'riddles'; profile.today.queue = api.buildQueue(20, null, 'riddles');
profile.today.index = 0; profile.today.completed = false;
var restored = api.normalizeProfile(JSON.parse(JSON.stringify(profile)));
assert.strictEqual(restored.today.queue.length, 20);
assert.strictEqual(restored.riddleSkills.halfAdd.correctCount, 1);
assert.strictEqual(restored.facts['7x7'].hundreds.multiply.correctCount, 1);
var legacy = api.defaultProfile();
delete legacy.today.mode; delete legacy.termSkills; delete legacy.riddleSkills;
legacy.facts['3x7'] = { a:3, b:7, correctCount:12, box:7 };
api.normalizeProfile(legacy);
assert.strictEqual(legacy.today.mode, 'mixed');
assert.strictEqual(legacy.facts['3x7'].correctCount, 12);
assert.strictEqual(api.correctAnswersForProfile(legacy), 12);

// A completed new-mode round awards the day and the home button resets to mixed.
api.setState(restored);
restored.today.index = restored.today.queue.length; restored.today.bonus = false;
api.finishSession();
assert(restored.today.completed);
assert.strictEqual(restored.stickers.length, 1);
elements.bonusBtn.events.click();
assert.strictEqual(restored.today.mode, 'mixed');
assert.strictEqual(restored.today.focusTable, null);

// Aborting any mode preserves answered work and rewards, but not completion.
['mixed', 'table', 'hundreds', 'terms', 'riddles'].forEach(function(mode){
  var interrupted = api.defaultProfile();
  interrupted.config.sound = false;
  interrupted.config.tasksPerDay = 10;
  interrupted.config.rewardEvery = 2;
  api.normalizeProfile(interrupted);
  api.setState(interrupted);
  api.ensureFactPool();
  elements.doneHomeBtn.events.click();
  api.startSession(false, mode === 'table' ? 3 : null, mode);
  assert.strictEqual(elements.abortSessionBtn.style.display, '');
  assert.strictEqual(elements.profileBtn.style.display, 'none');
  timers.length = 0;
  for (var answered = 0; answered < 2; answered++){
    var answer = elements.choicesWrap.children[0].dataset.answer;
    api.onAnswer(interrupted.today.queue[interrupted.today.index], answer, answer, null, false, 'Test');
    if (answered === 0) timers.shift()();
  }
  assert.strictEqual(api.correctAnswersForProfile(interrupted), 2);
  assert.strictEqual(interrupted.reward.availablePlays, 1);
  var historyBefore = JSON.stringify(interrupted.history);
  var pendingFeedback = timers.splice(0);
  elements.abortSessionBtn.events.click();
  assert(elements['screen-home'].classList.contains('active'));
  assert.strictEqual(elements.abortSessionBtn.style.display, 'none');
  assert.strictEqual(api.correctAnswersForProfile(interrupted), 2);
  assert.strictEqual(JSON.stringify(interrupted.history), historyBefore);
  assert.strictEqual(interrupted.reward.availablePlays, 1);
  assert.strictEqual(interrupted.today.completed, false);
  assert.strictEqual(interrupted.stickers.length, 0);
  assert.strictEqual(interrupted.streak, 0);
  assert.strictEqual(interrupted.today.index, 0);
  assert.strictEqual(interrupted.today.mode, 'mixed');
  var savedRoot = JSON.parse(storage.km_1x1_trainer_v2);
  assert.strictEqual(savedRoot.profiles[savedRoot.activeProfileId].reward.availablePlays, 1);
  pendingFeedback.forEach(function(callback){ callback(); });
  assert(elements['screen-home'].classList.contains('active'));
  api.startSession(false);
  var newQuestion = elements.questionText.textContent;
  pendingFeedback.forEach(function(callback){ callback(); });
  assert.strictEqual(elements.questionText.textContent, newQuestion);
  assert.strictEqual(interrupted.today.index, 0);
  timers.length = 0;
  api.onAnswer(interrupted.today.queue[0], -1, 25, null, false, 'Test');
  var wrongHistory = JSON.stringify(interrupted.history);
  var wrongFeedback = timers.splice(0);
  elements.abortSessionBtn.events.click();
  wrongFeedback.forEach(function(callback){ callback(); });
  api.tapAdvance({ target:{} });
  assert(elements['screen-home'].classList.contains('active'));
  assert.strictEqual(JSON.stringify(interrupted.history), wrongHistory);
  // Aborting a bonus round must not undo a previously completed day.
  interrupted.today.completed = true;
  api.startSession(true, null, mode === 'table' ? 'mixed' : mode);
  elements.abortSessionBtn.events.click();
  assert.strictEqual(interrupted.today.completed, true);
  assert.strictEqual(interrupted.reward.availablePlays, 1);
});

// An album fills before repeats; subsequent awards are balanced and never
// repeat the preceding sticker. Existing albums are used without modification.
var album = [];
assert.strictEqual(api.stickerPool.length, 80);
assert.strictEqual(new Set(api.stickerPool).size, api.stickerPool.length);
for (var award = 0; award < api.stickerPool.length * 4; award++){
  var nextSticker = api.pickNextSticker(album);
  if (album.length) assert.notStrictEqual(nextSticker, album[album.length - 1].emoji);
  if (award < api.stickerPool.length) assert(!album.some(function(sticker){ return sticker.emoji === nextSticker; }));
  album.push({ date:String(award).padStart(4, '0'), emoji:nextSticker });
  var counts = api.stickerPool.map(function(emoji){
    return album.filter(function(sticker){ return sticker.emoji === emoji; }).length;
  });
  assert(Math.max.apply(null, counts) - Math.min.apply(null, counts) <= 1);
}
var legacyAlbum = [{ date:'2026-01-03', emoji:'🦄' }, { date:'2026-01-01', emoji:'🦄' }];
var albumBefore = JSON.stringify(legacyAlbum);
assert.notStrictEqual(api.pickNextSticker(legacyAlbum), '🦄');
assert.strictEqual(JSON.stringify(legacyAlbum), albumBefore);
var duplicateProfile = api.defaultProfile();
duplicateProfile.stickers = legacyAlbum.concat([{ date:'2026-01-02', emoji:'🐬' }]);
api.normalizeProfile(duplicateProfile);
assert.strictEqual(duplicateProfile.stickers.length, 3);
assert.strictEqual(new Set(duplicateProfile.stickers.map(function(s){ return s.emoji; })).size, 3);
assert.strictEqual(duplicateProfile.stickers[1].emoji, '🦄');
assert.strictEqual(duplicateProfile.stickers[2].emoji, '🐬');
assert.deepStrictEqual(duplicateProfile.stickers.map(function(s){ return s.date; }), ['2026-01-03', '2026-01-01', '2026-01-02']);
var repairedAlbum = JSON.stringify(duplicateProfile.stickers);
api.normalizeProfile(duplicateProfile);
assert.strictEqual(JSON.stringify(duplicateProfile.stickers), repairedAlbum);
duplicateProfile.stickers = [];
for (var oldAward = 0; oldAward < api.stickerPool.length + 5; oldAward++){
  duplicateProfile.stickers.push({ date:'2026-01-' + String(oldAward + 1).padStart(2, '0'), emoji:'🦄' });
}
api.normalizeProfile(duplicateProfile);
assert.strictEqual(duplicateProfile.stickers.length, api.stickerPool.length + 5);
assert.strictEqual(new Set(duplicateProfile.stickers.map(function(s){ return s.emoji; })).size, api.stickerPool.length);
repairedAlbum = JSON.stringify(duplicateProfile.stickers);
api.normalizeProfile(duplicateProfile);
assert.strictEqual(JSON.stringify(duplicateProfile.stickers), repairedAlbum);
// Written division: exact three-digit dividends, 2..9 divisors and place-value rows.
var writtenProfile = api.normalizeProfile(api.defaultProfile());
writtenProfile.config.sound = false;
writtenProfile.config.rewardEvery = 1;
api.setState(writtenProfile);
api.ensureFactPool();
var writtenSkills = api.practiceSkillsInRange(null, 'written');
assert.strictEqual(writtenSkills.length, 16);
assert.strictEqual(api.practiceSkill('w:1:2'), null);
writtenSkills.forEach(function(skill){
  for (var sample = 0; sample < 100; sample++){
    var task = api.writtenDivisionQuestion(skill);
    assert(task.dividend >= 100 && task.dividend <= 999);
    assert(task.divisor >= 2 && task.divisor <= 9);
    assert.strictEqual(task.dividend / task.divisor, task.correct);
    assert.strictEqual(String(task.correct).length, skill.digits);
    assert.strictEqual(task.steps.length, String(task.correct).replace(/0/g, '').length);
    assert(task.steps.length >= 1 && task.steps.length <= 3);
    assert.strictEqual(task.steps.reduce(function(sum, step){ return sum + step.dividend; }, 0), task.dividend);
    assert.strictEqual(task.steps.reduce(function(sum, step){ return sum + step.quotient; }, 0), task.correct);
    task.steps.forEach(function(step){ assert.strictEqual(step.dividend / task.divisor, step.quotient); });
  }
});
assert.strictEqual(api.buildQueue(10, null, 'written').length, 10);
elements.writtenBtn.events.click();
assert.strictEqual(writtenProfile.today.mode, 'written');
context.Math.random = function(){ return 0.44; };
var exampleWritten = api.writtenDivisionQuestion(api.practiceSkill('w:4:2'));
assert.strictEqual(exampleWritten.dividend, 232);
assert.strictEqual(exampleWritten.correct, 58);
assert.deepStrictEqual(JSON.parse(JSON.stringify(exampleWritten.steps)), [{dividend:200,quotient:50},{dividend:32,quotient:8}]);
writtenProfile.today.queue = ['w:4:2']; writtenProfile.today.index = 0;
api.renderQuestion();
context.Math.random = Math.random;
var form = elements.writtenDivisionForm;
var totalCells = form.children[1].children[2].children;
var firstRow = form.children[3];
var secondRow = form.children[4];
var firstChunk = firstRow.children[0].children;
var firstResult = firstRow.children[2].children;
var secondChunk = secondRow.children[0].children;
var secondResult = secondRow.children[2].children;
assert.strictEqual(form.hidden, false);
assert.strictEqual(totalCells.length, 3);
assert.strictEqual(totalCells[0].disabled, true);
assert.strictEqual(context.document.activeElement, firstChunk[0]);
assert.strictEqual(firstChunk[0].selectionStart, 0);
firstChunk.forEach(function(cell, index){
  assert.strictEqual(cell.maxLength, 1);
  assert.strictEqual(cell.placeholder, '?');
  assert.strictEqual(cell.dataset.place, form.children[1].children[0].children[index].dataset.place);
  assert.strictEqual(form.children[1].children[0].children[index].textContent, '232'[index]);
});
var submitWritten = function(){ form.onsubmit({preventDefault:function(){}}); };
var digit = function(cell, value){ cell.value = value; cell.events.input(); };
var skip = function(cell){ cell.events.keydown({key:'Enter',preventDefault:function(){}}); };
// Empty tens/units stay in place and count as zero: 2?? is 200.
digit(firstChunk[0], 'a2');
assert.strictEqual(firstChunk[0].value, '2');
assert.strictEqual(context.document.activeElement, firstChunk[1]);
skip(firstChunk[1]);
assert.strictEqual(context.document.activeElement, firstChunk[2]);
skip(firstChunk[2]);
assert.strictEqual(context.document.activeElement, firstResult[0]);
skip(firstResult[0]);
digit(firstResult[1], '4');
assert.strictEqual(context.document.activeElement, firstResult[2]);
skip(firstResult[2]); // 40 is wrong; focus the incorrect tens digit.
assert.strictEqual(context.document.activeElement, firstResult[1]);
assert.strictEqual(firstChunk[0].disabled, false);
assert.strictEqual(api.correctAnswersForProfile(writtenProfile), 0);
digit(firstResult[1], '5');
skip(firstResult[2]); // ?5? is 50; row validates and continues automatically.
assert.strictEqual(context.document.activeElement, secondChunk[0]);
assert.strictEqual(firstChunk[0].disabled, true);
// Digits in the wrong columns are not silently right-aligned: 32? is 320.
secondChunk[0].value = '3'; secondChunk[1].value = '2';
secondResult[2].value = '8';
submitWritten();
assert.strictEqual(context.document.activeElement, secondChunk[0]);
assert.strictEqual(totalCells[0].disabled, true);
secondChunk[0].value = '';
digit(secondChunk[1], '3');
digit(secondChunk[2], '2');
assert.strictEqual(context.document.activeElement, secondResult[0]);
skip(secondResult[0]); skip(secondResult[1]);
digit(secondResult[2], '8');
assert.strictEqual(context.document.activeElement, totalCells[0]);
assert.strictEqual(totalCells[0].disabled, false);
// Backspace from an empty cell returns to the preceding column.
totalCells[1].events.keydown({key:'Backspace',preventDefault:function(){}});
assert.strictEqual(context.document.activeElement, totalCells[0]);
skip(totalCells[0]);
digit(totalCells[1], '5');
assert.strictEqual(context.document.activeElement, totalCells[2]);
digit(totalCells[2], '8'); // ?58 automatically checks the complete answer.
assert.strictEqual(writtenProfile.writtenSkills['w:4:2'].correctCount, 1);
assert.strictEqual(writtenProfile.reward.availablePlays, 1);
assert.strictEqual(writtenProfile.today.index, 1);
assert.strictEqual(writtenProfile.history[writtenProfile.today.date].attempts, 1);
var savedWritten = api.normalizeProfile(JSON.parse(JSON.stringify(writtenProfile)));
assert.strictEqual(savedWritten.today.mode, 'written');
assert.strictEqual(savedWritten.writtenSkills['w:4:2'].correctCount, 1);
api.finishSession();
assert(writtenProfile.today.completed);
assert.strictEqual(writtenProfile.stickers.length, 1);
elements.doneBonusBtn.events.click();
assert.strictEqual(writtenProfile.today.mode, 'written');
assert(api.repeatRoundLabel(false).indexOf('Schriftlich dividieren') !== -1);
// Zero quotient digits require no redundant intermediate row.
context.Math.random = function(){ return 0.004; };
var zeroWritten = api.writtenDivisionQuestion(api.practiceSkill('w:2:3'));
context.Math.random = Math.random;
assert.strictEqual(zeroWritten.correct, 101);
assert.strictEqual(zeroWritten.steps.length, 2);
assert.strictEqual(zeroWritten.steps[1].quotient, 1);
assert.strictEqual(zeroWritten.steps[1].dividend, 2);
api.renderWrittenDivision('w:2:3', zeroWritten);
assert.strictEqual(form.children.length, 6);
// All rows, including the given dividend, share the same three-column grid.
[form.children[1], form.children[3], form.children[4]].forEach(function(row){
  assert(row.className.indexOf('written-equation') !== -1);
  assert.strictEqual(row.children.length, 3);
  assert.strictEqual(row.children[0].children.length, 3);
  assert.strictEqual(row.children[2].children.length, 3);
});
form.children[3].children[0].children[0].value = '2'; // 200
form.children[3].children[2].children[0].value = '1'; // 100
submitWritten();
assert.strictEqual(context.document.activeElement, form.children[4].children[0].children[0]);
submitWritten(); // Empty input is still 0, but the remaining row needs 2:2=1.
assert.strictEqual(context.document.activeElement, form.children[4].children[0].children[2]);
var oldSubmit = form.onsubmit;
elements.abortSessionBtn.events.click();
oldSubmit({preventDefault:function(){}});
assert.strictEqual(writtenProfile.reward.availablePlays, 1);
assert.strictEqual(writtenProfile.today.mode, 'mixed');
api.startSession(false);
assert.strictEqual(form.hidden, true);
assert.strictEqual(elements.choicesWrap.hidden, false);
// Regression: 848:8 uses two rows for 106, without a separate zero-tens row.
var regressionProfile = api.normalizeProfile(api.defaultProfile());
regressionProfile.config.sound = false;
regressionProfile.config.rewardEvery = 1;
api.setState(regressionProfile);
api.ensureFactPool();
api.startSession(false, null, 'written');
regressionProfile.today.queue = ['w:8:3']; regressionProfile.today.index = 0;
context.Math.random = function(){ return 0.26; }; // 100 + floor(.26 * 25) = 106.
var regressionTask = api.writtenDivisionQuestion(api.practiceSkill('w:8:3'));
assert.strictEqual(regressionTask.dividend, 848);
assert.deepStrictEqual(JSON.parse(JSON.stringify(regressionTask.steps)), [
  {dividend:800,quotient:100}, {dividend:48,quotient:6}
]);
api.renderQuestion();
context.Math.random = Math.random;
assert.strictEqual(form.children.length, 6);
['800100', '048006'].forEach(function(entry, index){
  var row = form.children[3 + index];
  var inputs = row.children[0].children.concat(row.children[2].children);
  entry.split('').forEach(function(value, digitIndex){ digit(inputs[digitIndex], value); });
  assert(row.classList.contains('written-correct'));
});
var regressionTotal = form.children[1].children[2].children;
assert.strictEqual(context.document.activeElement, regressionTotal[0]);
'106'.split('').forEach(function(value, index){ digit(regressionTotal[index], value); });
assert.strictEqual(regressionProfile.writtenSkills['w:8:3'].correctCount, 1);
assert.strictEqual(regressionProfile.reward.availablePlays, 1);
assert.strictEqual(regressionProfile.history[regressionProfile.today.date].wrong, 0);
// One, two or three rows depend only on nonzero places in the result.
[
  {key:'w:8:3',quotient:100,rows:1},
  {key:'w:8:3',quotient:110,rows:2},
  {key:'w:8:3',quotient:111,rows:3},
  {key:'w:4:2',quotient:50,rows:1},
  {key:'w:4:2',quotient:58,rows:2}
].forEach(function(spec){
  var skill = api.practiceSkill(spec.key);
  var min = Math.max(Math.ceil(100 / skill.divisor), skill.digits === 3 ? 100 : 10);
  var max = Math.min(Math.floor(999 / skill.divisor), skill.digits === 3 ? 999 : 99);
  context.Math.random = function(){ return (spec.quotient - min + 0.5) / (max - min + 1); };
  var task = api.writtenDivisionQuestion(skill);
  assert.strictEqual(task.correct, spec.quotient);
  assert.strictEqual(task.steps.length, spec.rows);
  assert(task.steps.every(function(step){ return step.quotient > 0; }));
});
context.Math.random = Math.random;
console.log('Written division: one/two/three rows, 848:8 regression, focus, validation and rewards OK');

// All seven games keep the same reward contract and active-time/pause rules.
var gameProfile = api.normalizeProfile(api.defaultProfile());
gameProfile.config.sound = false;
api.setState(gameProfile);
api.ensureFactPool();
[
  ['Dino','game','dino'], ['Flappy','flappy','flappy'], ['Tower','tower','tower'],
  ['Gravity','gravity','gravity'], ['Brick','brick','brick'], ['Snake','snake','snake'], ['Snow','snow','snow']
].forEach(function(spec){
  var choose = elements['choose' + spec[0] + 'Btn'];
  var screen = elements['screen-' + spec[1]];
  var playsBefore = 2;
  gameProfile.reward.availablePlays = playsBefore;
  var gamesBefore = gameProfile.reward.gamesPlayed;
  choose.events.click();
  assert.strictEqual(gameProfile.reward.availablePlays, playsBefore);
  assert(screen.classList.contains('game-immersive'));
  // Simply opening and leaving does not spend a play.
  elements[spec[1] + 'HomeBtn'].events.click();
  assert.strictEqual(gameProfile.reward.availablePlays, playsBefore);
  assert(!screen.classList.contains('game-immersive'));
  choose.events.click();
  elements[spec[1] + 'Wrap'].events.pointerdown({ preventDefault:function(){}, pointerId:1, clientX:240, clientY:240 });
  assert.strictEqual(gameProfile.reward.availablePlays, playsBefore - 1);
  assert.strictEqual(gameProfile.reward.gamesPlayed, gamesBefore + 1);
  var game = api.games()[spec[2]];
  assert(game.running);
  api.activeGameStep(game, 1);
  assert.strictEqual(game.playTimeMs, 1000);
  api.pauseGame(screen);
  api.activeGameStep(game, 20);
  assert.strictEqual(game.playTimeMs, 1000);
  api.resumeGame(screen);
  api.activeGameStep(game, 1);
  assert.strictEqual(game.playTimeMs, 2000);
  api.stepGame(spec[2], 0.1);
  assert(game.playTimeMs > 2000, spec[2] + ' physics must advance active time');
  api.activeGameStep(game, 180);
  assert.strictEqual(game.playTimeMs, 180000);
  assert(!game.active, spec[2] + ' must end at the time limit');
  assert.strictEqual(gameProfile.reward.availablePlays, playsBefore - 1);
  elements[spec[1] + 'HomeBtn'].events.click();
});
elements.navGames.events.click();
assert(elements['screen-game-choice'].classList.contains('active'));
gameProfile.reward.availablePlays = 0;
elements.navGames.events.click();
assert(elements.chooseSnowBtn.disabled);
elements.navStatistics.events.click();
assert(elements['screen-statistics'].classList.contains('active'));
assert.strictEqual(elements.statGames.textContent, 7);
elements.navLearn.events.click();
assert(elements['screen-home'].classList.contains('active'));
var migratedGames = api.defaultProfile();
migratedGames.reward.availablePlays = 3;
migratedGames.reward.bestTowerScore = 42;
delete migratedGames.reward.gamesTrackedSince;
delete migratedGames.reward.gamesPlayed;
delete migratedGames.reward.bestSnowScore;
api.normalizeProfile(migratedGames);
assert.strictEqual(migratedGames.reward.availablePlays, 3);
assert.strictEqual(migratedGames.reward.bestTowerScore, 42);
assert.strictEqual(migratedGames.reward.bestSnowScore, 0);
assert.strictEqual(migratedGames.reward.gamesPlayed, 0);
assert(/^\d{4}-\d{2}-\d{2}$/.test(migratedGames.reward.gamesTrackedSince));
console.log('Seven games: start/exit, rewards, pause, three-minute limit, navigation and migration OK');
console.log('Sticker awards: unseen first, balanced repeats and existing albums OK');
console.log('Learning modes: generation, UI answers, retries, rewards, migration, replay and completion OK');
