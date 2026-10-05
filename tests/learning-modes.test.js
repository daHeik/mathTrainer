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
Element.prototype.getAttribute = function(){ return ''; };
Element.prototype.blur = function(){};
Element.prototype.getContext = function(){ return {}; };
Element.prototype.querySelector = function(){ return new Element(); };
Element.prototype.querySelectorAll = function(selector){
  return this.children.filter(function(child){ return child.className.split(' ').indexOf(selector.slice(1)) !== -1; });
};
Object.defineProperty(Element.prototype, 'innerHTML', {
  set:function(){ this.children = []; }, get:function(){ return ''; }
});

var elements = {};
Array.from(html.matchAll(/id="([^"]+)"/g)).forEach(function(match){ elements[match[1]] = new Element(); });
var storage = {};
var timers = [];
var context = {
  console:console, Date:Date, Math:Object.create(Math), Set:Set,
  document:{
    documentElement:new Element(), activeElement:null, body:new Element(),
    getElementById:function(id){ assert(elements[id], 'Missing DOM id ' + id); return elements[id]; },
    querySelector:function(){ return new Element(); }, querySelectorAll:function(){ return []; },
    createElement:function(){ return new Element(); }, addEventListener:function(){}
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
  'correctAnswersForProfile:correctAnswersForProfile, startSession:startSession,',
  'renderQuestion:renderQuestion, onAnswer:onAnswer, finishSession:finishSession,',
  'refreshDailySessionIfNeeded:refreshDailySessionIfNeeded, repeatRoundLabel:repeatRoundLabel,',
  'tapAdvance:tapAdvance,',
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
randomValues = [0, 0.4];
example = api.specialQuestion(api.practiceSkill('r:doubleAdd'));
assert.strictEqual(example.prompt, 'Meine Zahl ist die Summe aus dem Doppelten von 20 und 30.');
assert.strictEqual(example.gen.correct, 70);
context.Math.random = Math.random;

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
console.log('Sticker awards: unseen first, balanced repeats and existing albums OK');
console.log('Learning modes: generation, UI answers, retries, rewards, migration, replay and completion OK');
