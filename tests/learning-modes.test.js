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
  this.style = { setProperty:function(key,value){this[key]=value;} };
  this.attributes = {};
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
Element.prototype.setAttribute = function(key,value){this.attributes[key]=String(value);};
Element.prototype.removeAttribute = function(key){delete this.attributes[key];};
Element.prototype.getAttribute = function(key){ return this.attributes[key] || ''; };
Element.prototype.getClientRects = function(){return [{}];};
Element.prototype.blur = function(){};
Element.prototype.remove = function(){ this.removed = true; };
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
Object.defineProperty(Element.prototype, 'textContent', {
  get:function(){ return (this._text || '') + this.children.map(function(child){ return child.textContent; }).join(''); },
  set:function(value){ this._text = String(value); this.children = []; }
});
Object.defineProperty(Element.prototype, 'innerHTML', {
  set:function(){ this.children = []; }, get:function(){ return ''; }
});

var elements = {};
Array.from(html.matchAll(/id="([^"]+)"/g)).forEach(function(match){
  assert(!elements[match[1]], 'Duplicate DOM id ' + match[1]);
  elements[match[1]] = new Element(); elements[match[1]].id = match[1];
});
Array.from(html.matchAll(/<canvas\b[^>]*\bid="([^"]+)"[^>]*>/g)).forEach(function(match){
  var width=match[0].match(/\bwidth="(\d+)"/),height=match[0].match(/\bheight="(\d+)"/);
  if(width)elements[match[1]].width=Number(width[1]);
  if(height)elements[match[1]].height=Number(height[1]);
});
var storage = {};
var timers = [];
var context = {
  console:console, Date:Date, Math:Object.create(Math), Set:Set,
  document:{
    documentElement:new Element(), activeElement:null, body:new Element(),
    getElementById:function(id){
      if(/^(doodle|tiles|maze|asteroid)(left|right|up|down|fire)Btn$/.test(id))return elements[id]||null;
      assert(elements[id], 'Missing DOM id ' + id); return elements[id];
    },
    querySelector:function(selector){
      if(selector==='.screen.active')return Object.keys(elements).map(function(id){return elements[id];}).find(function(n){return /^screen-/.test(n.id)&&n.classList.contains('active');})||null;
      if(selector==='.modal-overlay.active')return Object.keys(elements).map(function(id){return elements[id];}).find(function(n){return /^(admin|pin|profile|player)Overlay$/.test(n.id)&&n.classList.contains('active');})||null;
      return new Element();
    }, querySelectorAll:function(){ return []; },
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
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','arcade-extra.js'),'utf8'),context);
context.VocabArcade=context.window.VocabArcade;
source = source.replace(/\}\)\(\);\s*$/, [
  'globalThis.testApi = {',
  'defaultProfile:defaultProfile, normalizeProfile:normalizeProfile, ensureFactPool:ensureFactPool,',
  'practiceSkill:practiceSkill, practiceSkillsInRange:practiceSkillsInRange, buildQueue:buildQueue,',
  'specialQuestion:specialQuestion, applyAnswerResult:applyAnswerResult,',
  'precedenceQuestion:precedenceQuestion, precedenceTypes:PRECEDENCE_PRACTICE_TYPES,',
  'renderMathText:renderMathText,',
  'writtenDivisionQuestion:writtenDivisionQuestion, renderWrittenDivision:renderWrittenDivision,',
  'remainderDivisionQuestion:remainderDivisionQuestion, renderRemainderDivision:renderRemainderDivision,',
  'semiDivisionQuestion:semiDivisionQuestion, semiSuggestedPart:semiSuggestedPart, checkSemiPart:checkSemiPart, renderSemiDivision:renderSemiDivision,',
  'correctAnswersForProfile:correctAnswersForProfile, startSession:startSession,',
  'renderQuestion:renderQuestion, onAnswer:onAnswer, finishSession:finishSession,',
  'refreshDailySessionIfNeeded:refreshDailySessionIfNeeded, repeatRoundLabel:repeatRoundLabel,',
  'tapAdvance:tapAdvance,',
  'getConfetti:function(){return confettiLayer;},',
  'normalizeAvatar:normalizeAvatar, avatarOptions:AVATAR_OPTIONS, avatarSvg:avatarSvg,',
  'openPlayerEditor:openPlayerEditor, getRoot:function(){return root;}, renderHome:renderHome,',
  'viewport:updateViewport, keepModalVisible:keepModalInputVisible,',
  'seasonAt:gameSeasonForDate, season:currentGameSeason, seasonDraw:drawSeasonSky, seasonToken:drawSeasonToken,',
  'streetDraw:drawRunnerStreetFun,',
  'drawGame:function(kind){if(extraArcade.definitions[kind])extraArcade.draw(kind);else ({dino:drawRewardGame,flappy:drawFlappyGame,tower:drawTowerGame,gravity:drawGravityGame,brick:drawBrickGame,snake:drawSnakeGame,snow:drawSnowGame,runner:drawRunnerGame})[kind]();},',
  'gravityContext:function(value){if(value)gravityCtx=value;return gravityCtx;},',
  'prepareGameCanvas:prepareGameCanvas, logicalCanvasHeight:logicalCanvasHeight,',
  'games:function(){return {dino:rewardGame,flappy:flappyGame,tower:towerGame,gravity:gravityGame,brick:arcadeGames.brick,snake:arcadeGames.snake,snow:arcadeGames.snow,runner:arcadeGames.runner,doodle:arcadeGames.doodle,tiles:arcadeGames.tiles,maze:arcadeGames.maze,asteroid:arcadeGames.asteroid};},',
  'extras:extraArcade, resizeExtraCanvases:resizeExtraCanvases,',
  'runnerAction:runnerAction, runnerUpdate:updateRunnerGame, runnerResize:resizeRunnerCanvas,',
  'runnerProject:runnerProject, runnerDraw:drawRunnerGame, runnerSpawn:spawnRunnerRows,',
  'drawHalloweenSky:drawHalloweenSky, drawPumpkin:drawPumpkin,',
  'halloweenWeather:halloweenWeather, drawSnakePumpkin:drawSnakePumpkin,',
  'activeGameStep:activeGameStep, pauseGame:pauseGame, resumeGame:resumeGame,',
  'gameDurationMs:gameDurationMs, startArcadeGame:startArcadeGame, makeBrickLevel:makeBrickLevel,',
  'resetBrickBall:resetBrickBall, brickLevelSpeed:brickLevelSpeed, applyBrickExtra:applyBrickExtra,',
  'arcadeHud:arcadeHud, loseArcadeAttempt:loseArcadeAttempt, beginArcadeAttempt:beginArcadeAttempt,',
  'drawGravityGap:drawGravityGap,',
  'turnSnake:turnSnake, snakeStepTime:snakeStepTime, snakeRenderSegment:snakeRenderSegment,',
  'drawSnakeGame:drawSnakeGame,',
  'runArcadeGame:runArcadeGame,',
  'startTowerGame:startTowerGame, placeTowerBlock:placeTowerBlock, drawTowerGame:drawTowerGame,',
  'towerSceneSpec:towerSceneSpec, towerContext:function(){return towerCtx;},',
  'snowSpeedPercent:snowSpeedPercent, snowSpeed:snowSpeed, snowPhysicsScale:snowPhysicsScale,',
  'snowCompleteTrick:snowCompleteTrick, decaySnowSpeed:decaySnowSpeed, snowPress:snowPress,',
  'snowSurface:snowSurface, snowGround:snowGround,',
  'updateSnowChaser:updateSnowChaser,',
  'updateSnowCamera:updateSnowCamera,',
  'spawnSnowTerrain:spawnSnowTerrain,',
  'stepSnowPhysics:stepSnowPhysics,',
  'stepGame:function(kind,dt){if(extraArcade.definitions[kind])extraArcade.update(kind,dt);else ({dino:updateRewardGame,flappy:updateFlappyGame,tower:updateTowerGame,gravity:updateGravityGame,brick:updateBrickGame,snake:updateSnakeGame,snow:updateSnowGame,runner:updateRunnerGame})[kind](dt);},',
  'pickNextSticker:pickNextSticker, stickerPool:STICKER_POOL,',
  'getState:function(){ return state; },',
  'setState:function(profile){ state = profile; root.profiles[root.activeProfileId] = profile; }',
  '};})();'
].join('\n'));
vm.runInContext(source, context);
var api = context.testApi;
assert(api.avatarOptions.eyes.some(function(option){return option[0]==='#708b9a'&&option[1]==='Blau-grau';}));
assert.strictEqual(api.normalizeAvatar({eyes:'#708b9a'}).eyes,'#708b9a');
var blueGreyProfile=api.defaultProfile();blueGreyProfile.config.avatar.eyes='#708b9a';
assert.strictEqual(api.normalizeProfile(JSON.parse(JSON.stringify(blueGreyProfile))).config.avatar.eyes,'#708b9a');
// First launch offers identity without opening a keyboard; name is required.
assert(elements.playerOverlay.classList.contains('active'));
assert.strictEqual(context.document.activeElement,elements.savePlayerBtn);
elements.playerName.value='';elements.playerForm.events.submit({preventDefault:function(){}});
assert(elements.playerError.textContent.indexOf('Namen')!==-1);
elements.playerName.value='Testkind';elements.playerForm.events.submit({preventDefault:function(){}});
assert(!elements.playerOverlay.classList.contains('active'));
assert.strictEqual(api.getState().config.childName,'Testkind');
// Calculations wrap as one inline unit; surrounding words keep normal spaces.
[
  ['Wie heißt die Rechenart bei 40 : 4?', ['40 : 4?']],
  ['Berechne jetzt 40 / 4 und erkläre es.', ['40 / 4']],
  ['Addition: 50 + 30 = 80. Dann 80 − 10 = 70.', ['50 + 30 = 80', '80 − 10 = 70']],
  ['Das Produkt aus 1 und 6 = ?', ['1 und 6 = ?']],
  ['Löse 7 · ▢ = 56.', ['7 · ▢ = 56']],
  ['Alt: 7 × 8 = 56. Dann 40 ÷ 4 = 10', ['7 × 8 = 56','40 ÷ 4 = 10']],
  ['Die Hälfte von 100 mit 20.', []],
  ['<img src=x> 40 : 4 = 10', ['40 : 4 = 10']]
].forEach(function(spec){
  var node = new Element();
  api.renderMathText(node, spec[0]);
  assert.strictEqual(node.textContent, spec[0]);
  assert.deepStrictEqual(node.children.filter(function(child){ return child.className === 'math-expression'; }).map(function(child){ return child.textContent; }), spec[1]);
});
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
assert.strictEqual(hundredsExample.prompt, '450 : 50');
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
assert(elements.questionText.children.some(function(child){ return child.className === 'math-expression'; }));
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
var completedConfetti = api.getConfetti();
assert(completedConfetti);
elements.navGames.events.click();
assert.strictEqual(api.getConfetti(), null);
assert.strictEqual(completedConfetti.removed, true);
elements.gameChoiceBackBtn.events.click();
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

// Semi-written division: three scaffolding levels, flexible chunks and a proof.
var semiProfile=api.normalizeProfile(api.defaultProfile());semiProfile.config.sound=false;semiProfile.config.rewardEvery=1;
api.setState(semiProfile);api.ensureFactPool();
['semi','semiFree','semiRest'].forEach(function(mode){
  var skills=api.practiceSkillsInRange(null,mode);assert.strictEqual(skills.length,8);
  skills.forEach(function(skill){
    for(var sample=0;sample<100;sample++){
      var q=api.semiDivisionQuestion(skill),remaining=q.dividend,sum=0;
      assert(q.dividend>=100&&q.dividend<=999);
      assert(q.divisor>=2&&q.divisor<=9);assert.strictEqual(q.correct*q.divisor+q.rest,q.dividend);
      assert(q.rest>=0&&q.rest<q.divisor);assert.strictEqual(q.rest>0,mode==='semiRest');
      while(remaining>=q.divisor){
        var part=api.semiSuggestedPart(remaining,q.divisor);assert(part>0&&part<=remaining);
        assert.strictEqual(api.checkSemiPart(q,remaining,String(part),String(part/q.divisor)),'');
        remaining-=part;sum+=part/q.divisor;
      }
      assert.strictEqual(remaining,q.rest);assert.strictEqual(sum,q.correct);
    }
  });
  assert.strictEqual(api.buildQueue(5,null,mode).length,5);
});
var semiForm=elements.semiDivisionForm;
var beforeBoundaryRandom=context.Math.random;
[0,.999999999].forEach(function(randomValue){
  context.Math.random=function(){return randomValue;};
  ['semi','semiFree','semiRest'].forEach(function(mode){
    api.practiceSkillsInRange(null,mode).forEach(function(skill){
      var task=api.semiDivisionQuestion(skill);
      assert(task.dividend>=100&&task.dividend<=999,'Boundary dividend stays three-digit, including remainder');
      assert.strictEqual(task.correct*task.divisor+task.rest,task.dividend);
    });
  });
});
context.Math.random=beforeBoundaryRandom;
function semiFind(id){
  function visit(n){if(n.id===id)return n;for(var i=0;i<n.children.length;i++){var found=visit(n.children[i]);if(found)return found;}return null;}
  return visit(semiForm);
}
function semiSubmit(){semiForm.onsubmit({preventDefault:function(){}});}
function semiPart(part,result){semiFind('semiChunk').value=String(part);semiFind('semiPartResult').value=String(result);semiSubmit();}
function semiExercise(mode,dividend,divisor){
  api.startSession(true,null,mode);var key='sd:'+mode+':'+divisor;
  semiProfile.today.queue=[key];semiProfile.today.index=0;api.renderQuestion();
  api.renderSemiDivision(key,{mode:mode,dividend:dividend,divisor:divisor,correct:Math.floor(dividend/divisor),rest:dividend%divisor});
  return key;
}
elements.semiBtn.events.click();assert(elements['screen-semi-intro'].classList.contains('active'));
assert.strictEqual(api.correctAnswersForProfile(semiProfile),0);
elements.semiStartBtn.events.click();assert.strictEqual(semiProfile.today.mode,'semi');
assert(!semiForm.hidden&&elements.writtenDivisionForm.hidden&&elements.choicesWrap.hidden);
semiExercise('semi',276,4);
assert.strictEqual(semiFind('semiChunk').value,'240');assert(semiFind('semiChunk').readOnly);
assert.strictEqual(context.document.activeElement,semiFind('semiPartResult'));
semiPart(240,60);assert.strictEqual(semiFind('semiChunk').value,'36');
semiPart(36,9);semiFind('semiTotal').value='69';semiSubmit();
assert.strictEqual(api.correctAnswersForProfile(semiProfile),0,'Only completion including proof earns credit');
semiFind('semiProbe').value='276';semiSubmit();
assert.strictEqual(api.correctAnswersForProfile(semiProfile),1);assert.strictEqual(semiProfile.reward.availablePlays,1);
semiSubmit();assert.strictEqual(api.correctAnswersForProfile(semiProfile),1,'No duplicate submit reward');
api.finishSession();assert(elements.doneSubtitle.textContent.indexOf('Halbschriftlich')!==-1);
elements.doneBonusBtn.events.click();assert.strictEqual(semiProfile.today.mode,'semi');
// Different valid decompositions are accepted; malformed/oversized/nondivisible ones are not.
var semiKey=semiExercise('semiFree',276,4);
assert.strictEqual(context.document.activeElement,semiFind('semiChunk'));
assert(!semiFind('semiChunk').readOnly);
semiPart(200,40);assert(elements.feedbackText.textContent.indexOf('Welche Zahl')!==-1);
semiPart(300,75);assert(elements.feedbackText.textContent.indexOf('größer')!==-1);
semiPart(201,50);assert(elements.feedbackText.textContent.indexOf('Vielfaches')!==-1);
semiPart(0,0);assert(elements.feedbackText.textContent.indexOf('größer als 0')!==-1);
semiPart('2e2',50);assert(elements.feedbackText.textContent.indexOf('ganze Zahl')!==-1);
semiPart(200,50);semiPart(76,19);
semiFind('semiTotal').value='69';semiSubmit();
semiFind('semiProbe').value='275';semiSubmit();assert(elements.feedbackText.textContent.indexOf('noch einmal')!==-1);
assert.strictEqual(api.correctAnswersForProfile(semiProfile),1);
semiFind('semiProbe').value='276';semiSubmit();
assert.strictEqual(semiProfile.semiSkills[semiKey].correctCount,1);
assert.strictEqual(semiProfile.history[semiProfile.today.date].byOperation.semiDivide.correct,2);
// Rest must be small, is never divided as a separate chunk, and is part of the proof.
semiExercise('semiRest',278,4);semiPart(240,60);semiPart(36,9);
assert(semiForm.textContent.indexOf('Es bleiben 2')!==-1);
semiFind('semiTotal').value='69';semiFind('semiRest').value='4';semiSubmit();
assert(elements.feedbackText.textContent.indexOf('kleiner')!==-1);
semiFind('semiRest').value='2';semiSubmit();assert(semiForm.textContent.indexOf('69 · 4 + 2')!==-1);
semiFind('semiProbe').value='278';semiSubmit();
assert.strictEqual(api.correctAnswersForProfile(semiProfile),3);
assert.strictEqual(semiProfile.reward.availablePlays,3);
var savedSemi=api.normalizeProfile(JSON.parse(JSON.stringify(semiProfile)));
assert.strictEqual(savedSemi.today.mode,'semiRest');assert.strictEqual(api.correctAnswersForProfile(savedSemi),3);
api.finishSession();elements.doneBonusBtn.events.click();assert.strictEqual(semiProfile.today.mode,'semiRest');
// Wrong totals enter the standard retry path. Aborting preserves only completed work.
semiKey=semiExercise('semiFree',276,4);semiPart(276,69);semiFind('semiTotal').value='68';semiSubmit();
assert.strictEqual(semiProfile.semiSkills[semiKey].wrongCount,1);
assert.strictEqual(semiProfile.today.requeueCounts[semiKey],1);
semiExercise('semiRest',278,4);semiPart(240,60);var staleSubmit=semiForm.onsubmit;
elements.abortSessionBtn.events.click();var afterAbort=JSON.stringify(semiProfile.history);
staleSubmit({preventDefault:function(){}});assert.strictEqual(JSON.stringify(semiProfile.history),afterAbort);
assert.strictEqual(api.correctAnswersForProfile(semiProfile),3);assert.strictEqual(semiProfile.reward.availablePlays,3);
assert.strictEqual(semiProfile.today.mode,'mixed');
var legacySemi=api.defaultProfile();delete legacySemi.semiSkills;api.normalizeProfile(legacySemi);
assert.strictEqual(Object.keys(legacySemi.semiSkills).length,24);
console.log('Semi-written: staged generation, flexible paths, validation, rest/proof, one-time rewards, retries, migration and abort OK');
// All twelve games keep the same reward contract and active-time/pause rules.
var gameProfile = api.normalizeProfile(api.defaultProfile());
gameProfile.config.sound = false;
api.setState(gameProfile);
api.ensureFactPool();
[
  ['Dino','game','dino'], ['Flappy','flappy','flappy'], ['Tower','tower','tower'],
  ['Gravity','gravity','gravity'], ['Brick','brick','brick'], ['Snake','snake','snake'], ['Snow','snow','snow'], ['Runner','runner','runner'],
  ['Doodle','doodle','doodle'], ['Tiles','tiles','tiles'], ['Maze','maze','maze'], ['Asteroid','asteroid','asteroid']
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
  if(api.extras.definitions[spec[2]])elements[spec[2]+'leftBtn'].events.click();
  else elements[spec[1] + 'Wrap'].events.pointerdown({ preventDefault:function(){}, pointerId:1, clientX:240, clientY:240 });
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
  var limit = (spec[2] === 'brick'||spec[2] === 'tiles') ? 300000 : 180000;
  assert.strictEqual(api.gameDurationMs(game), limit);
  if (spec[2] === 'brick'){
    api.activeGameStep(game, (180000 - game.playTimeMs) / 1000);
    assert(game.active && game.running, 'Bricks continues after three minutes');
    api.runArcadeGame('brick', game.lastFrame + 16);
    assert(game.active && game.running, 'Bricks frame loop must not stop at three minutes');
    api.arcadeHud('brick');
    assert.strictEqual(elements.brickTime.textContent, '2:00');
    api.loseArcadeAttempt('brick');
    assert(api.beginArcadeAttempt('brick'), 'Bricks allows another attempt before five minutes');
    assert.strictEqual(gameProfile.reward.availablePlays, playsBefore - 1);
  }
  api.activeGameStep(game, limit / 1000);
  assert.strictEqual(game.playTimeMs, limit);
  assert(!game.active, spec[2] + ' must end at the time limit');
  assert.strictEqual(gameProfile.reward.availablePlays, playsBefore - 1);
  assert.strictEqual(api.getConfetti(), null, spec[2] + ' game end must not launch confetti');
  elements[spec[1] + 'AgainBtn'].events.click();
  assert(elements['screen-game-choice'].classList.contains('active'));
  assert.strictEqual(api.getConfetti(), null, spec[2] + ' replay must not launch confetti');
  assert.strictEqual(gameProfile.reward.availablePlays, playsBefore - 1);
  elements[spec[1] + 'HomeBtn'].events.click();
});
elements.navGames.events.click();
assert(elements['screen-game-choice'].classList.contains('active'));
gameProfile.reward.availablePlays = 0;
elements.navGames.events.click();
assert(elements.chooseSnowBtn.disabled);
assert(elements.chooseRunnerBtn.disabled);
['Doodle','Tiles','Maze','Asteroid'].forEach(function(name){assert(elements['choose'+name+'Btn'].disabled);});
elements.navStatistics.events.click();
assert(elements['screen-statistics'].classList.contains('active'));
assert.strictEqual(elements.statGames.textContent, '12');
elements.navLearn.events.click();
assert(elements['screen-home'].classList.contains('active'));
// Higher Bricks levels vary geometrically, stay clearable and grow 25% in speed.
api.startArcadeGame('brick', true);
var brick = api.games().brick;
var layouts = new Set();
for (var level = 1; level <= 20; level++){
  brick.level = level; brick.elapsed = 0;
  api.makeBrickLevel(); api.resetBrickBall();
  assert(brick.bricks.length >= 15 && brick.bricks.length <= 48);
  assert(Math.abs(brick.ballSpeed - 351 * Math.pow(1.25, level - 1)) < 0.00001);
  if (level > 1) assert(Math.abs(api.brickLevelSpeed(level) / api.brickLevelSpeed(level - 1) - 1.25) < 0.00001);
  brick.bricks.forEach(function(block, index){
    assert(block.x >= 8 && block.x + block.w <= 472);
    assert(block.y >= 54 && block.y + block.h < brick.paddle.y);
    assert(block.hp >= 1 && block.hp <= 3);
    brick.bricks.slice(index + 1).forEach(function(other){
      assert(block.x + block.w <= other.x || other.x + other.w <= block.x || block.y + block.h <= other.y || other.y + other.h <= block.y);
    });
  });
  if (level >= 3 && level <= 8) layouts.add(brick.bricks.map(function(b){return b.baseX + ',' + b.y;}).join(';'));
  assert.strictEqual(brick.bricks.some(function(b){return b.moving;}), level >= 5);
}
assert.strictEqual(layouts.size, 6);
brick.level = 6; brick.elapsed = 0; brick.speedFactor = 1;
api.makeBrickLevel(); api.resetBrickBall();
api.beginArcadeAttempt('brick');
var moving = brick.bricks.find(function(b){ return b.moving; });
var movingX = moving.x;
api.stepGame('brick', 0.1);
assert.notStrictEqual(moving.x, movingX);
assert(api.applyBrickExtra('fast'));
assert(Math.abs(brick.ballSpeed - api.brickLevelSpeed(6) * 1.15) < 0.00001);
var factor = brick.speedFactor;
brick.level = 7; api.makeBrickLevel(); api.resetBrickBall();
assert(Math.abs(brick.ballSpeed - api.brickLevelSpeed(7) * factor) < 0.00001);
elements.brickHomeBtn.events.click();
// High-contrast holes break the rail; only Superman draws a bridge across them.
[0, 332].forEach(function(y){
  var fills = [], labels = [];
  var ctx = {save:function(){},restore:function(){},beginPath:function(){},moveTo:function(){},lineTo:function(){},stroke:function(){},
    fillRect:function(x,top,w,h){ fills.push({color:this.fillStyle,x:x,y:top,w:w,h:h}); },
    fillText:function(label){ labels.push(label); }};
  var gap = {x:100,w:120};
  api.drawGravityGap(ctx, gap, y, y === 0 ? -1 : 1, false);
  assert(fills.some(function(f){return f.color === '#000000' && f.x === 100 && f.w === 120 && f.h === 28;}));
  assert.strictEqual(fills.filter(function(f){return f.color === '#ffe269';}).length, 2);
  assert.strictEqual(fills.filter(function(f){return f.color === '#ffffff';}).length, 2);
  assert(!fills.some(function(f){return f.color === '#68d8ff';}));
  assert(labels.indexOf('LÜCKE') !== -1);
  fills = []; labels = [];
  api.drawGravityGap(ctx, gap, y, y === 0 ? -1 : 1, true);
  assert(fills.some(function(f){return f.color === '#68d8ff' && f.w === 120 && f.h === 4;}));
  assert(labels.indexOf('BRÜCKE') !== -1);
});
// Tower world/camera regression: blocks never change world coordinates.
api.startTowerGame(true);
api.placeTowerBlock(); // Start without spending a play in demo mode.
var tower = api.games().tower;
var previousCamera = 0;
for (var floor = 1; floor <= 65; floor++){
  var oldY = tower.blocks.map(function(block){ return block.y; });
  tower.moving.x = tower.blocks[tower.blocks.length - 1].x;
  api.placeTowerBlock();
  assert.strictEqual(tower.height, floor);
  oldY.forEach(function(y, index){ assert.strictEqual(tower.blocks[index].y, y); });
  assert.strictEqual(tower.blocks[0].y, 438);
  var top = tower.blocks[tower.blocks.length - 1];
  assert.strictEqual(top.y, 438 - floor * 27);
  assert.strictEqual(tower.moving.y, top.y - 27);
  assert(tower.cameraY >= previousCamera);
  assert.strictEqual(top.y + tower.cameraY, Math.max(120, top.y));
  previousCamera = tower.cameraY;
  var scene = api.towerSceneSpec(floor, tower.cameraY);
  assert.strictEqual(scene.groundY, 465 + tower.cameraY);
  if (floor >= 13) assert(scene.groundY >= 480, 'Grass must leave the viewport');
  if (floor % 10 === 0) assert(tower.altitudeNotice.text.indexOf(floor + '. Etage') === 0);
  api.drawTowerGame();
}
function towerSceneAt(height){ return api.towerSceneSpec(height, Math.max(0, 120 - (438 - height * 27))); }
assert.strictEqual(towerSceneAt(9).objects.length, 0);
assert(towerSceneAt(10).objects.some(function(o){ return o.kind === 'birds'; }));
assert(!towerSceneAt(19).objects.some(function(o){ return o.kind === 'plane'; }));
assert(towerSceneAt(20).objects.some(function(o){ return o.kind === 'plane'; }));
assert.strictEqual(towerSceneAt(20).space, 0);
assert.strictEqual(towerSceneAt(25).space, 0.5);
assert.strictEqual(towerSceneAt(30).space, 1);
assert(!towerSceneAt(29).objects.some(function(o){ return o.kind === 'shuttle' || o.kind === 'station'; }));
[[30,'shuttle'],[40,'station'],[50,'shuttle'],[60,'station']].forEach(function(spec){
  assert(towerSceneAt(spec[0]).objects.some(function(o){ return o.level === spec[0] && o.kind === spec[1]; }));
});
// Verify drawing removes the grass, not merely hiding it in the scene metadata.
var highCamera = tower.cameraY;
tower.moving.x = 500;
api.placeTowerBlock();
assert.strictEqual(tower.attempts, 1);
assert.strictEqual(tower.height, 65);
assert.strictEqual(tower.cameraY, highCamera);
api.placeTowerBlock(); // Continue the same tower, rather than restoring the ground.
assert(tower.running);
assert.strictEqual(tower.cameraY, highCamera);
var towerCtx = api.towerContext(), originalFillRect = towerCtx.fillRect, fills = [];
towerCtx.fillRect = function(x,y,w,h){ fills.push({color:this.fillStyle,y:y}); };
api.drawTowerGame();
assert(!fills.some(function(fill){ return fill.color === '#b8dc87' || fill.color === '#7fba66'; }));
elements.towerHomeBtn.events.click();
api.startTowerGame(true);
fills = []; api.drawTowerGame();
assert.strictEqual(api.games().tower.cameraY, 0);
assert(fills.some(function(fill){ return fill.color === '#b8dc87' && fill.y === 465; }));
towerCtx.fillRect = originalFillRect;
elements.towerHomeBtn.events.click();
console.log('Tower: stable world coordinates, moving scenery, grass removal and altitude events through floor 65 OK');
// Snow: every landed flip adds 20 percentage points; active whole seconds lose 1.
api.startArcadeGame('snow', true);
api.beginArcadeAttempt('snow');
var snow = api.games().snow;
assert.strictEqual(api.snowSpeedPercent(snow), 100);
api.snowCompleteTrick(snow, {rotation:0}, true); // A grind alone is not a backflip.
assert.strictEqual(api.snowSpeedPercent(snow), 100);
[120,140,160,180,200,200].forEach(function(expected){
  api.snowCompleteTrick(snow, {rotation:-Math.PI * 2}, false);
  assert.strictEqual(api.snowSpeedPercent(snow), expected);
});
snow.speedPercent = 100;
api.snowCompleteTrick(snow, {rotation:-Math.PI * 4}, false);
assert.strictEqual(api.snowSpeedPercent(snow), 140);
api.decaySnowSpeed(snow, .99);
assert.strictEqual(api.snowSpeedPercent(snow), 140);
api.decaySnowSpeed(snow, .01);
assert.strictEqual(api.snowSpeedPercent(snow), 139);
api.decaySnowSpeed(snow, 9);
assert.strictEqual(api.snowSpeedPercent(snow), 130);
api.pauseGame(elements['screen-snow']);
api.decaySnowSpeed(snow, 20);
api.stepGame('snow', 1);
assert.strictEqual(api.snowSpeedPercent(snow), 130);
api.resumeGame(elements['screen-snow']);
snow.running = false;
api.decaySnowSpeed(snow, 20);
assert.strictEqual(api.snowSpeedPercent(snow), 130);
snow.running = true;
api.decaySnowSpeed(snow, 200);
assert.strictEqual(api.snowSpeedPercent(snow), 100);
snow.player.grounded = true; api.snowPress();
var jump100 = -snow.player.vy;
var speed100 = api.snowSpeed(snow);
snow.speedPercent = 200; snow.player.grounded = true; api.snowPress();
var jump200 = -snow.player.vy;
assert.strictEqual(jump100, 410);
assert.strictEqual(jump200, 615);
assert.strictEqual(api.snowSpeed(snow), speed100 * 2);
assert.strictEqual(api.snowPhysicsScale(snow), 1.5);
assert.strictEqual(2 * jump100 / 720, 2 * jump200 / 1080); // Similar airtime/control.
assert(Math.abs((jump200 * jump200 / (2 * 1080)) / (jump100 * jump100 / (2 * 720)) - 1.5) < 1e-10);
api.startArcadeGame('snow', true); api.beginArcadeAttempt('snow');
snow = api.games().snow; snow.speedPercent = 200; snow.spawnIn = 999;
snow.ramps = [{x:150,w:11,launch:500}];
api.stepSnowPhysics(1 / 180);
assert.strictEqual(snow.player.vy, -750, 'Ramp impulses scale with high speed');
snow.ramps = []; snow.player.y = api.snowGround(snow.distance + 160) - 120;
snow.player.grounded = false; snow.player.vy = -100;
api.stepGame('snow', .01);
assert(Math.abs(snow.player.vy - (-100 + 1080 * .01)) < 1e-8, 'Airborne gravity uses the same scale');
snow.patternBag = ['rocks']; snow.nextFeatureX = 0; snow.rocks = [];
var lookAhead = Math.max(790, api.snowSpeed(snow) * 2.5);
api.spawnSnowTerrain();
assert(snow.rocks[0].x >= snow.distance + lookAhead, 'Fast terrain must spawn with adequate warning');
// Use the actual landing/collision path, not just the bonus helper.
[true, false].forEach(function(success){
  api.startArcadeGame('snow', true); api.beginArcadeAttempt('snow');
  var g = api.games().snow, p = g.player;
  g.spawnIn = 999;
  p.grounded = false; p.y = api.snowSurface(g, 160) - p.h - .1; p.vy = 500;
  p.rotation = success ? -Math.PI * 2 : Math.PI;
  api.stepGame('snow', .01);
  assert.strictEqual(g.flips, success ? 1 : 0);
  assert.strictEqual(api.snowSpeedPercent(g), success ? 120 : 100);
  assert.strictEqual(g.attempts, success ? 0 : 1);
});
[
  {percent:149,decay:0,breaks:false}, {percent:150,decay:0,breaks:true},
  {percent:200,decay:0,breaks:true}, {percent:150,decay:1,breaks:false}
].forEach(function(spec){
  api.startArcadeGame('snow', true); api.beginArcadeAttempt('snow');
  var g = api.games().snow;
  g.speedPercent = spec.percent; g.spawnIn = 999;
  api.decaySnowSpeed(g, spec.decay);
  g.rocks = [{x:155,w:40,h:35}];
  api.stepGame('snow', .001);
  assert.strictEqual(g.rocks.length, spec.breaks ? 0 : 1);
  assert.strictEqual(g.attempts, spec.breaks ? 0 : 1);
  if (spec.breaks) assert.strictEqual(g.score, 30);
});
elements.snowHomeBtn.events.click();
api.startArcadeGame('snow', true);
assert.strictEqual(api.snowSpeedPercent(api.games().snow), 100);
elements.snowHomeBtn.events.click();
console.log('Snow: landed-flip boosts, active-time decay, 100..200% caps, jump physics and 150% rock collisions OK');
// The right edge leads the camera before the rider reaches a downhill ravine.
api.startArcadeGame('snow',true);
snow=api.games().snow;
snow.distance=600;
snow.terrainCache[0]={knots:[0,160,480,1400],heights:[250,250,440,440]};
snow.player.y=222;snow.cameraY=5;
var originalSnowHeight=elements.snowCanvas.viewHeight;
elements.snowCanvas.viewHeight=360;
snow.gaps=[{x:1050,w:170}];
api.updateSnowCamera(snow,1/60);
assert(snow.cameraY>=128,'Upcoming low terrain must retain 48px bottom clearance');
assert(snow.player.y-snow.cameraY>=60,'Rider remains visible above upcoming terrain');
assert.strictEqual(api.snowGround(snow.distance+160),250,'Rider has not reached the descent yet');
for(var cameraFrame=0;cameraFrame<120;cameraFrame++)api.updateSnowCamera(snow,1/60);
assert(Math.abs(snow.cameraY-162)<.001,'Right-edge terrain, bounded by rider visibility, drives camera');
// A valley in the middle stays visible even after the right edge climbs again.
snow.terrainCache[0]={knots:[0,160,320,640,1400],heights:[250,250,440,250,250]};
snow.cameraY=5;
api.updateSnowCamera(snow,1/60);
assert(snow.cameraY>=128,'Visible valley must not be cropped by a higher right bank');
// Portrait view scales framing; a high jump keeps the rider on screen.
elements.snowCanvas.viewHeight=720;snow.cameraY=5;
api.updateSnowCamera(snow,1/60);
assert(snow.player.y-snow.cameraY>=120);
elements.snowCanvas.viewHeight=360;snow.player.y=-100;snow.cameraY=5;
api.updateSnowCamera(snow,1/60);
assert(snow.player.y-snow.cameraY>=60);
elements.snowCanvas.viewHeight=originalSnowHeight;
elements.snowHomeBtn.events.click();
console.log('Snow camera: right-edge lookahead, early ravine visibility, valley framing, portrait and jumps OK');
// A successful landing grants one active second of rock smashing at base speed.
api.startArcadeGame('snow',true);
snow=api.games().snow;api.beginArcadeAttempt('snow');
snow.spawnIn=100;snow.nextChaseAt=1000;
snow.player.grounded=false;snow.player.y=api.snowSurface(snow,160)-snow.player.h-.01;
snow.player.vy=100;snow.player.rotation=0;
snow.rocks=[{x:155,w:40,h:35}];
api.stepGame('snow',.001);
assert.strictEqual(snow.player.grounded,true);
assert.strictEqual(snow.speedPercent,100);
assert.strictEqual(snow.rocks.length,0,'Rock touching the landing is destroyed');
assert.strictEqual(snow.attempts,0);
assert(Math.abs(snow.landingSmashUntil-snow.elapsed-1)<1e-8);
api.pauseGame(elements['screen-snow']);
var landingElapsed=snow.elapsed;
api.stepGame('snow',2);
assert.strictEqual(snow.elapsed,landingElapsed);
api.resumeGame(elements['screen-snow']);
api.stepGame('snow',.9);
snow.rocks=[{x:snow.distance+155,w:40,h:35}];
api.stepGame('snow',.001);
assert.strictEqual(snow.rocks.length,0,'Protection persists near the end of the second');
assert.strictEqual(snow.attempts,0);
api.stepGame('snow',.11);
snow.rocks=[{x:snow.distance+155,w:40,h:35}];
api.stepGame('snow',.001);
assert.strictEqual(snow.attempts,1,'Normal rock collision resumes after the window');
elements.snowHomeBtn.events.click();
console.log('Snow landing: one active second of rock smashing, including landing frame and pause OK');
// Base speed never grows with elapsed time. Each chase locks its starting speed.
api.startArcadeGame('snow',true);snow=api.games().snow;
[0,35,143,180].forEach(function(seconds){
  snow.elapsed=seconds;snow.speedPercent=100;assert.strictEqual(api.snowSpeed(snow),286);
  snow.speedPercent=200;assert.strictEqual(api.snowSpeed(snow),572);
});
snow.elapsed=35;snow.nextChaseAt=35;snow.speedPercent=150;
api.updateSnowChaser(snow,0);
assert.strictEqual(snow.chaser.speed,445,'Chaser starts 16px/s faster than current 150% pace');
api.updateSnowChaser(snow,1);
assert.strictEqual(snow.chaser.gap,164,'Chaser gains ground at unchanged rider speed');
snow.speedPercent=170;api.updateSnowChaser(snow,1);
assert.strictEqual(snow.chaser.speed,445,'Later boosts do not accelerate the chaser');
assert(Math.abs(snow.chaser.gap-205.2)<1e-8,'A later boost lets the rider pull away');
snow.speedPercent=140;api.updateSnowChaser(snow,1);
assert(Math.abs(snow.chaser.gap-160.6)<1e-8,'Boost decay lets the chaser catch up');
snow.chaser=null;snow.nextChaseAt=snow.elapsed;snow.speedPercent=100;snow.chasesEscaped=3;
api.updateSnowChaser(snow,0);
assert.strictEqual(snow.chaser.speed,302,'Next chase samples its own starting rider speed');
elements.snowHomeBtn.events.click();
console.log('Snow pace: fixed base speed and chaser locked to starting rider speed plus 16px/s OK');
// Cleo glides along locked grid segments, with only one future turn buffered.
api.startArcadeGame('snake', true);
var cleo = api.games().snake;
cleo.food = {x:0,y:0};
api.beginArcadeAttempt('snake');
var cleoStep = api.snakeStepTime(cleo);
function cleoPoint(index,x,y){
  var point = api.snakeRenderSegment(cleo,index);
  assert(Math.abs(point.x-x)<1e-8, 'Cleo x: '+point.x+' vs '+x);
  assert(Math.abs(point.y-y)<1e-8, 'Cleo y: '+point.y+' vs '+y);
}
api.stepGame('snake', cleoStep/2);
assert.strictEqual(cleo.body[0].x,7); // Logical position changes only on arrival.
cleoPoint(0,7.5,10);
api.turnSnake(0,1);
api.turnSnake(-1,0); // No second future turn, even with rapid swipes.
assert.strictEqual(cleo.turns.length,1);
assert.strictEqual(cleo.turns[0].y,1);
cleoPoint(0,7.5,10); // Queuing cannot bend a segment halfway through.
api.stepGame('snake', cleoStep/2);
cleoPoint(0,8,10);
assert.strictEqual(cleo.direction.y,1);
assert.strictEqual(cleo.turns.length,0);
api.stepGame('snake', cleoStep/2);
cleoPoint(0,8,10.5);
cleoPoint(1,7.5,10); // Body follows the corner, never a diagonal shortcut.
api.turnSnake(0,-1); // Reversal is still forbidden.
assert.strictEqual(cleo.turns.length,0);
api.pauseGame(elements['screen-snake']);
var frozenTick = cleo.tick;
api.stepGame('snake',1);
assert.strictEqual(cleo.tick,frozenTick);
cleoPoint(0,8,10.5);
api.resumeGame(elements['screen-snake']);
api.stepGame('snake',cleoStep/2);
cleoPoint(0,8,11);
elements.snakeHomeBtn.events.click();

// Every wrapping direction interpolates across the seam, not across the board.
[
  {x:19,y:10,dx:1,dy:0}, {x:0,y:10,dx:-1,dy:0},
  {x:10,y:19,dx:0,dy:1}, {x:10,y:0,dx:0,dy:-1}
].forEach(function(spec){
  api.startArcadeGame('snake',true);cleo=api.games().snake;
  cleo.body=[{x:spec.x,y:spec.y}];cleo.direction={x:spec.dx,y:spec.dy};
  cleo.food={x:3,y:3};api.beginArcadeAttempt('snake');
  var duration=api.snakeStepTime(cleo);
  api.stepGame('snake',duration/2);
  cleoPoint(0,spec.x+spec.dx/2,spec.y+spec.dy/2);
  var translations=[];
  cleo.ctx.translate=function(x,y){translations.push([x,y]);};
  api.drawSnakeGame();
  var seamCopies=translations.filter(function(p){return spec.dx?p[1]===252:p[0]===252;});
  assert(seamCopies.length>=2,'Both sides of the seam must be drawn');
  delete cleo.ctx.translate;
  api.stepGame('snake',duration/2);
  cleoPoint(0,(spec.x+spec.dx+20)%20,(spec.y+spec.dy+20)%20);
  elements.snakeHomeBtn.events.click();
});

// Eating and collisions happen at arrival, not when rendering begins moving.
api.startArcadeGame('snake',true);cleo=api.games().snake;
cleo.food={x:8,y:10};api.beginArcadeAttempt('snake');
cleoStep=api.snakeStepTime(cleo);
api.stepGame('snake',cleoStep/2);
assert.strictEqual(cleo.score,0);
assert.strictEqual(cleo.body.length,4);
api.stepGame('snake',cleoStep/2);
assert.strictEqual(cleo.score,25);
assert.strictEqual(cleo.body.length,5);
assert.strictEqual(cleo.stepDuration,api.snakeStepTime(cleo));
cleo.bombs=[{x:9,y:10}];
api.stepGame('snake',cleo.stepDuration/2);
assert.strictEqual(cleo.attempts,0);
api.stepGame('snake',cleo.stepDuration/2);
assert.strictEqual(cleo.attempts,1);
assert.strictEqual(cleo.tick,0);
assert.strictEqual(cleo.stepDuration,0);
assert.strictEqual(cleo.turns.length,0);
elements.snakeHomeBtn.events.click();
api.startArcadeGame('snake',true);cleo=api.games().snake;
cleo.food={x:0,y:0};api.beginArcadeAttempt('snake');
api.stepGame('snake',api.snakeStepTime(cleo)*2.5);
cleoPoint(0,9.5,10); // Catch-up can cross several cells without losing remainder.
elements.snakeHomeBtn.events.click();
console.log('Cleo: smooth grid movement, one buffered turn, corners, wrap rendering, pause, food and collisions OK');
// Metro Run: integration and real world-preserving collision/collectible paths.
var metroProfile=api.getState();metroProfile.reward.availablePlays=1;elements.chooseRunnerBtn.click();var metro=api.games().runner;
assert(metro.active&&!metro.running);assert.equal(metroProfile.reward.availablePlays,1);assert.equal(elements.runnerTime.textContent,'3:00');assert(elements['screen-runner'].classList.contains('game-immersive'));
api.runnerAction('left');assert.equal(metroProfile.reward.availablePlays,0);assert.equal(metro.lane,-1);api.runnerAction('left');assert.equal(metro.lane,-1);
api.runnerAction('right');api.runnerAction('right');assert.equal(metro.lane,1);
var generated=metro.objects.slice();var rows={};generated.filter(function(o){return o.length;}).forEach(function(o){(rows[o.z]||(rows[o.z]=[])).push(o);});Object.values(rows).forEach(function(row){assert(new Set(row.map(function(o){return o.lane;})).size<3||row.some(function(o){return o.type==='barrier'||o.type==='gate';}));});
function cleanMetro(){
 api.startArcadeGame('runner',true);api.beginArcadeAttempt('runner');var g=api.games().runner;g.objects=[];g.nextRow=10000;return g;
}
metro=cleanMetro();metro.objects=[{type:'coin',lane:0,z:.2}];api.runnerUpdate(.01);assert.equal(metro.coins,1);assert(metro.score>=20);
metro=cleanMetro();metro.objects=[{type:'barrier',length:2,lane:0,z:9}];api.runnerAction('jump');
for(var t=0;t<.5;t+=1/60)api.runnerUpdate(1/60);assert.equal(metro.attempts,0);assert(metro.jump>0);
metro=cleanMetro();metro.objects=[{type:'gate',length:2,lane:0,z:.2}];api.runnerAction('slide');api.runnerUpdate(.01);assert.equal(metro.attempts,0);
metro=cleanMetro();metro.objects=[{type:'train',length:14,lane:0,z:.2},{type:'coin',lane:1,z:90}];metro.distance=0;metro.coins=7;metro.score=140;
api.runnerUpdate(.01);assert.equal(metro.attempts,1);assert(metro.awaitingStart);assert.equal(metro.coins,7);assert(metro.distance>0);assert.equal(metro.score,140);assert(metro.objects.some(function(o){return o.z===90;}));assert(metro.graceUntil>metro.elapsed);
var freeze=metro.playTimeMs;api.runnerUpdate(1);assert.equal(metro.playTimeMs,freeze);api.beginArcadeAttempt('runner');assert(metro.running);
metro=cleanMetro();metro.objects=[{type:'shield',lane:0,z:.2}];api.runnerUpdate(.01);assert.equal(metro.shieldUntil,metro.elapsed+8);
metro.objects=[{type:'train',lane:0,z:metro.distance+.2,length:14}];api.runnerUpdate(.01);assert.equal(metro.attempts,0);assert.equal(metro.shieldUntil,0);assert(metro.graceUntil>metro.elapsed);
metro=cleanMetro();metro.objects=[{type:'magnet',lane:0,z:.2}];api.runnerUpdate(.01);assert.equal(metro.magnetUntil,metro.elapsed+10);
metro.objects=[{type:'coin',lane:-1,z:metro.distance+4}];api.runnerUpdate(.01);assert.equal(metro.coins,1);
elements.runnerPauseBtn.click();freeze=metro.playTimeMs;var distance=metro.distance;api.runnerAction('left');api.runnerUpdate(1);assert.equal(metro.playTimeMs,freeze);assert.equal(metro.distance,distance);assert.equal(metro.lane,0);elements.runnerPauseBtn.click();
metro=cleanMetro();var event={pointerId:9,clientX:100,clientY:100,preventDefault:function(){}};
elements.runnerWrap.events.pointerdown(event);elements.runnerWrap.events.pointermove({pointerId:9,clientX:140,clientY:100,preventDefault:function(){}});assert.equal(metro.lane,1);
elements.runnerWrap.events.pointerup({pointerId:9,clientX:140,clientY:100,preventDefault:function(){}});assert.equal(metro.lane,1);assert.equal(metro.vy,0);
elements.runnerWrap.events.pointerdown(event);elements.runnerWrap.events.pointercancel();elements.runnerWrap.events.pointerup({pointerId:9,clientX:100,clientY:40,preventDefault:function(){}});assert.equal(metro.vy,0);
// Actual rendered geometry adapts to both aspect ratios and keeps near/far order.
elements.runnerWrap.getBoundingClientRect=function(){return {width:390,height:650};};api.runnerResize();assert.equal(elements.runnerCanvas.height,800);
var near=api.runnerProject(metro,1,0),far=api.runnerProject(metro,1,100);assert(near.y>far.y);assert(near.k>far.k);api.runnerDraw();
elements.runnerWrap.getBoundingClientRect=function(){return {width:800,height:300};};api.runnerResize();assert.equal(elements.runnerCanvas.height,300);api.runnerDraw();
metro.playTimeMs=180000;api.runArcadeGame('runner',1000);assert.equal(metro.active,false);elements.runnerHomeBtn.click();assert.equal(api.games().runner,null);
assert(api.getState().reward.bestRunnerScore>=140);
api.getState().reward.availablePlays=0;elements.navGames.click();assert.equal(elements.chooseRunnerBtn.disabled,true);
console.log('OK: eighth-game rewards/locking, jump/slide/lane rules, continuation, coins/shield/magnet, swipe/cancel, pause/timer, responsive projection and backup record.');
// Perspective keeps lanes on straight rails, even when objects pass the rider.
metro=cleanMetro();
[-1,0,1].forEach(function(lane){
  var horizon=elements.runnerCanvas.height*.2;
  [0,5,20,90].forEach(function(z){
    var point=api.runnerProject(metro,lane,z);
    assert(Math.abs((point.x-240)/(point.y-horizon)-lane*122/(elements.runnerCanvas.height*.63))<1e-9);
  });
});
assert(api.runnerProject(metro,1,-8).y>api.runnerProject(metro,1,-3).y);
// Seasonal graphics are deterministic paint: no simulation changes or randomness.
var savedRandom=context.Math.random;
context.Math.random=function(){throw new Error('Decoration must not consume gameplay randomness');};
var beforeDecoration=JSON.stringify(metro);
api.runnerDraw();
assert.strictEqual(JSON.stringify(metro),beforeDecoration);
var artCtx=new Element().getContext();
api.drawHalloweenSky(artCtx,480,720,12,false);
api.drawHalloweenSky(artCtx,480,480,12,true);
api.drawPumpkin(artCtx,30,40,12);
context.Math.random=savedRandom;
// At later stages every fully occupied row still has a jump/slide route.
context.Math.random=function(){return .1;};
metro.elapsed=120;metro.nextRow=metro.distance+40;metro.objects=[];api.runnerSpawn(metro);
var denseRows={};
metro.objects.filter(function(o){return o.length;}).forEach(function(o){(denseRows[o.z]||(denseRows[o.z]=[])).push(o);});
Object.keys(denseRows).forEach(function(key){
  var row=denseRows[key];assert(row.length<=3);
  assert(row.length<3||row.some(function(o){return o.type==='barrier'||o.type==='gate';}));
});
context.Math.random=savedRandom;
elements.runnerHomeBtn.events.click();
console.log('Metro perspective, late-stage routes and cosmetic-only Halloween drawing OK');
// Halloween weather fades slowly, never flashes the full screen and honors reduced motion.
assert.strictEqual(api.halloweenWeather(0,false).lightning,0);
assert.strictEqual(api.halloweenWeather(12,false).lightning,0);
assert(Math.abs(api.halloweenWeather(12.6,false).lightning-.55)<1e-8);
assert.strictEqual(api.halloweenWeather(14,false).lightning,0);
assert(Math.abs(api.halloweenWeather(30.6,false).lightning-.55)<1e-8);
assert.strictEqual(api.halloweenWeather(12.6,true).lightning,0);
assert.strictEqual(api.halloweenWeather(12.6,true).drift,0);
var weatherLines=[],weatherFills=[];
var weatherCtx=new Element().getContext();
weatherCtx.stroke=function(){weatherLines.push(weatherCtx.strokeStyle);};
weatherCtx.fillRect=function(x,y,w,h){weatherFills.push([w,h]);};
api.drawHalloweenSky(weatherCtx,480,720,12.6,false);
assert(weatherLines.indexOf('#d4c6ef')!==-1,'A distant bolt is drawn during the weather window');
assert(!weatherFills.some(function(p){return p[0]===480&&p[1]===720;}),'No full-screen flash');
weatherLines=[];
context.window.matchMedia=function(){return {matches:true};};
api.drawHalloweenSky(weatherCtx,480,720,12.6,false);
assert(weatherLines.indexOf('#d4c6ef')===-1,'Reduced motion disables lightning');
delete context.window.matchMedia;
// Cleo's pickups are always pumpkins, including replacement food after eating.
api.startArcadeGame('snake',true);cleo=api.games().snake;
assert.strictEqual(cleo.food.type,'pumpkin');
cleo.food={x:8,y:10,type:'pumpkin'};api.beginArcadeAttempt('snake');
api.stepGame('snake',api.snakeStepTime(cleo));
assert.strictEqual(cleo.score,25);
assert.strictEqual(cleo.food.type,'pumpkin');
var pumpkinColors=[],pumpkinCtx=new Element().getContext();
pumpkinCtx.fill=function(){pumpkinColors.push(pumpkinCtx.fillStyle);};
api.drawSnakePumpkin(pumpkinCtx,cleo.food);
assert(pumpkinColors.indexOf('#df6f28')!==-1,'Pumpkin has a distinct orange body');
elements.snakeHomeBtn.events.click();
console.log('Halloween: slow distant weather, reduced motion, no screen flash, pumpkin rendering and pickups OK');
// All four new games share real rewards, pause, continuation, records and timers.
['doodle','tiles','maze','asteroid'].forEach(function(kind){
 elements[kind+'Canvas'].height=640;
 api.getState().reward.availablePlays=1;api.startArcadeGame(kind,false);var g=api.games()[kind];
 assert(g.active&&!g.running);assert.equal(api.getState().reward.availablePlays,1);
 var action=kind==='asteroid'?'up':'left';api.extras.action(kind,action,true);
 assert(g.running);assert.equal(api.getState().reward.availablePlays,0);api.extras.action(kind,action,true);assert.equal(api.getState().reward.availablePlays,0);
 api.extras.action(kind,action,false);
 assert(elements['screen-'+kind].classList.contains('game-immersive'));
 if(kind==='asteroid'){
  var canvas=elements.asteroidCanvas,oldBounds=canvas.getBoundingClientRect;canvas.height=640;canvas.viewHeight=640;g.viewHeight=640;
  canvas.getBoundingClientRect=function(){return {left:100,top:20,width:800,height:300};};
  function finger(id,x,y){return {pointerId:id,clientX:x,clientY:y,preventDefault:function(){}};}
  var wrap=elements.asteroidWrap;
  wrap.events.pointerdown(finger(41,500,170));assert.equal(g.touchTarget.x,240);assert.equal(g.touchTarget.y,320);
  wrap.events.pointerdown(finger(42,900,300));assert.equal(g.touchTarget.x,240,'second finger cannot replace first');
  wrap.events.pointermove(finger(42,900,300));assert.equal(g.touchTarget.x,240);
  wrap.events.pointermove(finger(41,550,200));assert(Math.abs(g.touchTarget.x-346.6666667)<.001);assert.equal(g.touchTarget.y,384);
  wrap.events.pointerup(finger(42,550,200));assert(g.touchTarget);
  wrap.events.pointerup(finger(41,550,200));assert.equal(g.touchTarget,null);
  ['pointercancel','lostpointercapture'].forEach(function(event){wrap.events.pointerdown(finger(43,500,170));wrap.events[event](finger(43,500,170));assert.equal(g.touchTarget,null);});
  wrap.events.pointerdown(finger(44,500,170));elements.asteroidPauseBtn.click();assert.equal(g.touchTarget,null);elements.asteroidPauseBtn.click();
  wrap.events.pointermove(finger(44,550,200));assert.equal(g.touchTarget,null,'resume requires new contact');
  canvas.getBoundingClientRect=oldBounds;
  ['left','up','fire','right'].forEach(function(action){
   var b=elements['asteroid'+action+'Btn'];
   ['contextmenu','selectstart','dragstart'].forEach(function(event){var prevented=false;b.events[event]({preventDefault:function(){prevented=true;}});assert(prevented);});
   b.events.pointerdown({preventDefault:function(){},pointerId:7});assert.equal(g.keys[action],true);
   api.extras.update(kind,.2);assert.equal(g.keys[action],true);
   b.events.pointerup({pointerId:7});assert.equal(g.keys[action],false);
  });
 }
 var before=g.playTimeMs||0;elements[kind+'PauseBtn'].click();api.runArcadeGame(kind,2000);assert.equal(g.playTimeMs||0,before);assert(g.active);
 elements[kind+'PauseBtn'].click();api.extras.draw(kind);
 g.score=321;g.playTimeMs=api.gameDurationMs(g);api.runArcadeGame(kind,1000);assert.equal(g.active,false);
 var field={doodle:'bestDoodleScore',tiles:'bestTilesScore',maze:'bestMazeScore',asteroid:'bestAsteroidScore'}[kind];assert.equal(api.getState().reward[field],321);
 elements[kind+'HomeBtn'].click();assert.equal(api.games()[kind],null);
});
var savedRoot=JSON.parse(storage.km_1x1_trainer_v2);
var newer=savedRoot.profiles[savedRoot.activeProfileId];
assert.equal(newer.reward.bestMazeScore,321);assert.equal(newer.reward.bestTilesScore,321);
console.log('OK: all twelve games integrate; new four consume one play, support immersion/pause, end on active deadline and preserve profile records/backups.');
var migratedGames = api.defaultProfile();
['bestDoodleScore','bestTilesScore','bestMazeScore','bestAsteroidScore'].forEach(function(key){delete migratedGames.reward[key];});
migratedGames.reward.availablePlays = 3;
migratedGames.reward.bestTowerScore = 42;
delete migratedGames.reward.gamesTrackedSince;
delete migratedGames.reward.gamesPlayed;
delete migratedGames.reward.bestSnowScore;
delete migratedGames.reward.bestRunnerScore;
api.normalizeProfile(migratedGames);
['bestDoodleScore','bestTilesScore','bestMazeScore','bestAsteroidScore'].forEach(function(key){assert.strictEqual(migratedGames.reward[key],0);});
assert.strictEqual(migratedGames.reward.availablePlays, 3);
assert.strictEqual(migratedGames.reward.bestTowerScore, 42);
assert.strictEqual(migratedGames.reward.bestSnowScore, 0);
assert.strictEqual(migratedGames.reward.bestRunnerScore, 0);
assert.strictEqual(migratedGames.reward.gamesPlayed, 0);
assert(/^\d{4}-\d{2}-\d{2}$/.test(migratedGames.reward.gamesTrackedSince));
console.log('Twelve games: rewards, replay without confetti, pause, per-game timers and migration OK');
console.log('Bricks: six layouts, 25% speed growth, moving rows and extras; Gravity: high-contrast gaps OK');
console.log('Sticker awards: unseen first, balanced repeats and existing albums OK');
// Public avatar customization uses allowlisted values and leaves learning untouched.
var identity=api.normalizeProfile(api.defaultProfile());identity.config.childName='Cleo';api.setState(identity);api.ensureFactPool();api.renderHome();
assert.notStrictEqual(elements.profileBtn.style.display,'none');
var identityRecords=JSON.stringify(identity.facts);
elements.homeAvatarBtn.events.click();assert(elements.playerOverlay.classList.contains('active'));
var outfitSelect=elements.avatarFields.children.find(function(field){return field.children[0].textContent==='Kostüme und saisonale Outfits';}).children[1];
outfitSelect.value='halloween';outfitSelect.events.change();
elements.playerName.value='Mia';elements.playerForm.events.submit({preventDefault:function(){}});
assert.strictEqual(identity.config.avatar.outfit,'halloween');assert.strictEqual(identity.config.childName,'Mia');
assert.strictEqual(JSON.stringify(identity.facts),identityRecords);
var identityBackup=JSON.parse(storage.km_1x1_trainer_v2);
assert.strictEqual(identityBackup.profiles[identityBackup.activeProfileId].config.avatar.outfit,'halloween');
elements.profileBtn.events.click();elements.editPlayerBtn.events.click();
elements.playerName.value='Nicht speichern';elements.cancelPlayerBtn.events.click();
assert.strictEqual(identity.config.childName,'Mia');assert.strictEqual(identity.config.avatar.outfit,'halloween');
var identityRoot=api.getRoot(),identityId=identityRoot.activeProfileId;
var secondIdentity=api.normalizeProfile(api.defaultProfile());secondIdentity.config.childName='Lina-Test';secondIdentity.config.avatar.hair='waves';
identityRoot.profiles.avatarTest=secondIdentity;
elements.profileBtn.events.click();elements.profileList.children.find(function(button){return button.textContent==='Lina-Test';}).events.click();
assert.strictEqual(api.getState().config.avatar.hair,'waves');assert(elements.homeGreeting.textContent.indexOf('Lina-Test')!==-1);
elements.profileBtn.events.click();elements.profileList.children.find(function(button){return button.textContent==='Mia';}).events.click();
assert.strictEqual(identityRoot.activeProfileId,identityId);assert.strictEqual(api.getState().config.avatar.outfit,'halloween');
delete identityRoot.profiles.avatarTest;
var safeAvatar=api.normalizeAvatar({skin:'url(javascript:bad)',hair:'<script>',accessory:['star','<script>','star'],outfit:'unknown'});
assert.strictEqual(safeAvatar.skin,api.avatarOptions.skin[0][0]);assert.strictEqual(safeAvatar.hair,'short');
assert.strictEqual(JSON.stringify(safeAvatar.accessory),'["star"]');
['longCurls','waves','braids','bun'].forEach(function(hair){
  var backup=api.defaultProfile();backup.config.avatar.hair=hair;api.normalizeProfile(backup);assert.strictEqual(backup.config.avatar.hair,hair);
  assert(api.avatarSvg(backup.config.avatar).children.length>20);
});
var oldIdentity=api.defaultProfile();delete oldIdentity.config.avatar;api.normalizeProfile(oldIdentity);
assert.strictEqual(JSON.stringify(oldIdentity.config.avatar),JSON.stringify(api.normalizeAvatar()));
var longSleeves=api.avatarSvg({top:'purple'}).children.find(function(shape){return shape.getAttribute('data-avatar-part')==='long-sleeves';});
assert(longSleeves);
// Modal keyboard viewport must not shrink the learning/game shell underneath.
elements.adminOverlay.classList.add('active');context.document.activeElement=elements.rewardEvery;elements.rewardEvery.tagName='INPUT';
context.window.visualViewport={height:520,offsetTop:28,scale:1};api.viewport();
assert.strictEqual(context.document.documentElement.style['--app-height'],'100dvh');
assert.strictEqual(context.document.documentElement.style['--modal-height'],'520px');
assert.strictEqual(context.document.documentElement.style['--modal-top'],'28px');
var oldModalBounds=elements.adminOverlay.getBoundingClientRect,oldInputBounds=elements.rewardEvery.getBoundingClientRect;
elements.adminOverlay.scrollTop=0;
elements.adminOverlay.getBoundingClientRect=function(){return {top:28,bottom:548};};
elements.rewardEvery.getBoundingClientRect=function(){return {top:576-elements.adminOverlay.scrollTop,bottom:620-elements.adminOverlay.scrollTop};};
api.keepModalVisible();assert.strictEqual(elements.adminOverlay.scrollTop,88);api.keepModalVisible();assert.strictEqual(elements.adminOverlay.scrollTop,88);
elements.adminOverlay.getBoundingClientRect=oldModalBounds;elements.rewardEvery.getBoundingClientRect=oldInputBounds;
elements.adminOverlay.classList.remove('active');delete context.window.visualViewport;context.document.activeElement=context.document.body;
console.log('Avatar: first launch, public save/cancel, allowlists, hairstyles, sleeves, backup/migration and modal keyboard viewport OK');
// Expanded avatar options: garment cut and colour are independent, with old looks migrated.
[['blue','tshirt','#508fe3'],['coral','tshirt','#ed7b79'],['green','sweater','#599d83'],['purple','hoodie','#9170c8']].forEach(function(old){
  var original={top:old[0],outfit:'pumpkin'},migrated=api.normalizeAvatar(original);
  assert.strictEqual(migrated.top,old[1]);assert.strictEqual(migrated.topColor,old[2]);
  assert.strictEqual(migrated.outfit,'pumpkin');assert.strictEqual(original.top,old[0],'Migration does not mutate draft/source');
});
assert.strictEqual(api.normalizeAvatar({topColor:'url(bad)',bottomColor:'#abc'}).topColor,'#508fe3');
assert.strictEqual(api.normalizeAvatar({topColor:'#ABCDEF'}).topColor,'#abcdef');
['shoulderCurls','long','longCurls','waves','braids','bun'].forEach(function(hair){
  var profile=api.defaultProfile();profile.config.avatar.hair=hair;api.normalizeProfile(profile);
  assert.strictEqual(profile.config.avatar.hair,hair);assert(api.avatarSvg(profile.config.avatar).children.length>20);
});
api.avatarOptions.top.forEach(function(option){assert(api.avatarSvg({top:option[0],topColor:'#123abc'}).children.length>20);});
api.avatarOptions.bottom.forEach(function(option){assert(api.avatarSvg({bottom:option[0],bottomColor:'#abcdef'}).children.length>20);});
elements.homeAvatarBtn.events.click();
assert(!elements.avatarClothesHint.hidden,'Explain when a costume hides everyday garments');
function garmentField(label){return elements.avatarFields.children.find(function(field){return field.children[0].textContent===label;}).children[1];}
var topRow=garmentField('Oberteil'),bottomRow=garmentField('Unterteil');
assert.strictEqual(topRow.children[0].children.length,9);assert.strictEqual(bottomRow.children[0].children.length,12);
assert.strictEqual(topRow.children[1].children[0].type,'color');
var wardrobe=garmentField('Kostüme und saisonale Outfits');wardrobe.value='everyday';wardrobe.events.change();assert(elements.avatarClothesHint.hidden);
topRow.children[0].value='tank';topRow.children[0].events.change();
topRow.children[1].children[0].value='#12ab89';topRow.children[1].children[0].events.input();
bottomRow.children[0].value='pleated';bottomRow.children[0].events.change();
bottomRow.children[1].children[0].value='#be5678';bottomRow.children[1].children[0].events.change();
elements.playerName.value=api.getState().config.childName;elements.playerForm.events.submit({preventDefault:function(){}});
var savedWardrobeRoot=JSON.parse(storage.km_1x1_trainer_v2);
var savedWardrobe=api.normalizeProfile(savedWardrobeRoot.profiles[savedWardrobeRoot.activeProfileId]).config.avatar;
assert.strictEqual(savedWardrobe.top,'tank');assert.strictEqual(savedWardrobe.topColor,'#12ab89');
assert.strictEqual(savedWardrobe.bottom,'pleated');assert.strictEqual(savedWardrobe.bottomColor,'#be5678');
var wardrobeBeforeCancel=JSON.stringify(api.getState().config.avatar);
elements.homeAvatarBtn.events.click();var cancelColor=garmentField('Oberteil').children[1].children[0];cancelColor.value='#998877';cancelColor.events.input();elements.cancelPlayerBtn.events.click();
assert.strictEqual(JSON.stringify(api.getState().config.avatar),wardrobeBeforeCancel);
console.log('Avatar wardrobe: nine tops/twelve bottoms, independent colours, hairstyle options, migration, backup and cancel OK');
// Shoulder waves use continuous inward-falling locks, with the saved key unchanged.
assert.strictEqual(api.avatarOptions.hair.find(function(option){return option[0]==='shoulderCurls';})[1],'Schulterlange Wellen');
var shoulderWaves=api.avatarSvg({hair:'shoulderCurls'});
assert(shoulderWaves.children.some(function(shape){return shape.getAttribute('d').indexOf('M76 91C70 108')===0;}));
var waveProfile=api.defaultProfile();waveProfile.config.avatar.hair='shoulderCurls';
assert.strictEqual(api.normalizeProfile(JSON.parse(JSON.stringify(waveProfile))).config.avatar.hair,'shoulderCurls');
// High-DPI 2048 preserves its board and runs for five active minutes.
api.startArcadeGame('tiles',true);var retina=api.games().tiles;
var oldSlot=elements.tilesWrap.getBoundingClientRect,oldCanvasSlot=elements.tilesCanvas.getBoundingClientRect;
elements.tilesWrap.getBoundingClientRect=function(){return {width:1024,height:720};};
elements.tilesCanvas.getBoundingClientRect=function(){return elements.tilesWrap.getBoundingClientRect();};context.window.devicePixelRatio=2;
var boardBefore=JSON.stringify(retina.board);api.resizeExtraCanvases();
assert(retina.canvas.width>=2044&&retina.canvas.width<=2048);assert.strictEqual(retina.viewHeight,338);assert(retina.canvas.height>=1439);
assert.strictEqual(JSON.stringify(retina.board),boardBefore);
var transforms=[];retina.ctx.setTransform=function(){transforms.push(Array.from(arguments));};api.resizeExtraCanvases();
assert.strictEqual(transforms[0][0],transforms[0][3]);assert(Math.abs(transforms[0][0]-retina.canvas.width/480)<1e-8);
api.extras.action('tiles','left',true);retina.playTimeMs=180000;api.runArcadeGame('tiles',1000);assert(retina.active);
retina.playTimeMs=300000;api.runArcadeGame('tiles',2000);assert(!retina.active);assert(elements.tilesOverlayTitle.textContent.indexOf('Fünf Minuten')!==-1);
elements.tilesWrap.getBoundingClientRect=oldSlot;elements.tilesCanvas.getBoundingClientRect=oldCanvasSlot;elements.tilesHomeBtn.events.click();
// Each game's bitmap is sharp, while its world dimensions remain logical.
[
  ['Dino','game','dino'],['Flappy','flappy','flappy'],['Tower','tower','tower'],['Gravity','gravity','gravity'],
  ['Brick','brick','brick'],['Snake','snake','snake'],['Snow','snow','snow'],['Runner','runner','runner'],
  ['Doodle','doodle','doodle'],['Tiles','tiles','tiles'],['Maze','maze','maze'],['Asteroid','asteroid','asteroid']
].forEach(function(spec){
  api.getState().reward.availablePlays=1;elements['choose'+spec[0]+'Btn'].events.click();
  var canvas=elements[spec[1]+'Canvas'],game=api.games()[spec[2]];
  assert(canvas.height>canvas.viewHeight,spec[2]+' has separate logical and physical dimensions');
  var before=JSON.stringify([game.player,game.ship,game.board,game.distance]);
  api.prepareGameCanvas(canvas,canvas.getContext('2d'),spec[1]==='gravity'||spec[1]==='snow'?640:480,canvas.viewHeight);
  assert.strictEqual(JSON.stringify([game.player,game.ship,game.board,game.distance]),before);
  elements[spec[1]+'HomeBtn'].events.click();
});
context.window.devicePixelRatio=1;
assert(!html.includes('user-scalable=no'),'Keep pinch zoom accessible');
console.log('Retina: all twelve games preserve world coordinates; 2048 board and five-minute limit OK');
// Ordinary division with a required remainder, including explicitly entered zero.
var remainderProfile=api.normalizeProfile(api.defaultProfile());
remainderProfile.config.sound=false;remainderProfile.config.rewardEvery=1;
api.setState(remainderProfile);api.ensureFactPool();
assert.strictEqual(api.practiceSkill('rd:1x1'),null);
assert(api.practiceSkillsInRange(null,'remainder').length>0);
assert(api.practiceSkillsInRange(null,'remainder').every(function(skill){return skill.kind==='remainder';}));
var oldRandom=context.Math.random,zeroRemainders=0;
for(var percentile=0;percentile<100;percentile++){
  context.Math.random=function(){return percentile/100;};
  var remainderTask=api.remainderDivisionQuestion(api.practiceSkill('rd:5x5'));
  assert.strictEqual(remainderTask.dividend,remainderTask.correct*remainderTask.divisor+remainderTask.rest);
  assert(remainderTask.rest>=0&&remainderTask.rest<remainderTask.divisor);
  if(remainderTask.rest===0)zeroRemainders++;
}
assert.strictEqual(zeroRemainders,5,'Exactly the upper 5% random interval generates rest zero');
context.Math.random=oldRandom;
for(var remainderSample=0;remainderSample<300;remainderSample++){
  var unitTask=api.remainderDivisionQuestion(api.practiceSkill('rd:1x7'));
  assert.strictEqual(unitTask.divisor,7,'Never divide by 1 in remainder practice');
  assert.strictEqual(Math.floor(unitTask.dividend/unitTask.divisor),unitTask.correct);
}
remainderProfile.config.min=5;remainderProfile.config.max=7;remainderProfile.config.enabledTables=[5,7];
api.normalizeProfile(remainderProfile);
assert.strictEqual(api.practiceSkillsInRange(null,'remainder').length,3,'Honor configured numbers');
assert.strictEqual(api.buildQueue(10,null,'remainder').length,10,'No mixed-round new-fact limit');
remainderProfile.config.answerMode='choice';
elements.remainderBtn.events.click();assert.strictEqual(remainderProfile.today.mode,'remainder');
var remainderForm=elements.remainderDivisionForm;
function remainderFind(id){
  function visit(node){if(node.id===id)return node;for(var i=0;i<node.children.length;i++){var found=visit(node.children[i]);if(found)return found;}}
  return visit(remainderForm);
}
function remainderSubmit(){remainderForm.onsubmit({preventDefault:function(){}});}
function showRemainder(rest){
  remainderProfile.today.queue=['rd:5x5'];remainderProfile.today.index=0;remainderProfile.today.correct=0;
  remainderProfile.today.requeueCounts={};api.renderQuestion();
  api.renderRemainderDivision('rd:5x5',{dividend:25+rest,divisor:5,correct:5,rest:rest});
}
showRemainder(0);
assert(!remainderForm.hidden&&elements.writtenDivisionForm.hidden&&elements.semiDivisionForm.hidden);
assert.strictEqual(remainderFind('remainderRest').value,'','Never prefill even rest zero');
assert(remainderFind('remainderQuotient').readOnly);
var quotientChoices=elements.choicesWrap.children;
assert.strictEqual(quotientChoices.length,4);
quotientChoices.find(function(button){return String(button.textContent)==='5';}).click();
assert.strictEqual(context.document.activeElement,remainderFind('remainderRest'));
assert.strictEqual(api.correctAnswersForProfile(remainderProfile),0,'Selecting quotient alone earns nothing');
remainderSubmit();assert.strictEqual(remainderProfile.today.index,0,'Blank rest is not zero');
remainderFind('remainderRest').value='0';remainderSubmit();remainderSubmit();
assert.strictEqual(remainderProfile.facts['5x5'].remainder.correctCount,1);
assert.strictEqual(remainderProfile.facts['5x5'].division.correctCount,0,'Keep normal division progress independent');
assert.strictEqual(remainderProfile.reward.availablePlays,1);
assert.strictEqual(remainderProfile.history[remainderProfile.today.date].byOperation.remainderDivide.correct,1);
api.finishSession();assert(api.repeatRoundLabel(false).includes('Division mit Rest'));
elements.doneBonusBtn.events.click();assert.strictEqual(remainderProfile.today.mode,'remainder');
remainderProfile.config.answerMode='input';showRemainder(3);
assert(!remainderFind('remainderQuotient').readOnly);
assert.strictEqual(context.document.activeElement,remainderFind('remainderQuotient'));
function remainderKey(label){elements.choicesWrap.children.find(function(button){return button.textContent===label;}).click();}
remainderKey('5');remainderKey('OK');
assert.strictEqual(context.document.activeElement,remainderFind('remainderRest'));
remainderKey('3');remainderKey('OK');
assert.strictEqual(remainderProfile.facts['5x5'].remainder.correctCount,2);
assert.strictEqual(remainderProfile.reward.availablePlays,2);
showRemainder(3);remainderFind('remainderQuotient').value='5';remainderFind('remainderRest').value='8';remainderSubmit();
assert.strictEqual(remainderProfile.facts['5x5'].remainder.wrongCount,1);
assert.strictEqual(remainderProfile.today.queue.length,2,'Wrong rest repeats like a normal wrong answer');
assert(elements.feedbackText.textContent.includes('5 R 3'));
showRemainder(3);remainderFind('remainderQuotient').value='4';remainderFind('remainderRest').value='3';remainderSubmit();
assert.strictEqual(remainderProfile.facts['5x5'].remainder.wrongCount,2);
remainderProfile.config.answerMode='adaptive';remainderProfile.facts['5x5'].remainder.seen=true;
remainderProfile.facts['5x5'].remainder.box=2;showRemainder(3);
assert(!remainderFind('remainderQuotient').readOnly,'Adaptive input follows normal box >= 2 rule');
remainderProfile.facts['5x5'].remainder.box=1;showRemainder(3);
assert(remainderFind('remainderQuotient').readOnly,'Adaptive mode retains choices for newer skills');
var staleRemainderSubmit=remainderForm.onsubmit;
elements.abortSessionBtn.events.click();
assert.strictEqual(remainderProfile.today.mode,'mixed');
assert.strictEqual(remainderProfile.reward.availablePlays,2,'Abort keeps earned rewards');
staleRemainderSubmit({preventDefault:function(){}});
assert.strictEqual(api.correctAnswersForProfile(remainderProfile),2,'Aborted form cannot submit');
var remainderBackup=api.normalizeProfile(JSON.parse(JSON.stringify(remainderProfile)));
assert.strictEqual(remainderBackup.facts['5x5'].remainder.correctCount,2);
assert.strictEqual(remainderBackup.history[remainderBackup.today.date].byOperation.remainderDivide.wrong,2);
delete remainderBackup.facts['5x5'].remainder;api.normalizeProfile(remainderBackup);
assert.strictEqual(remainderBackup.facts['5x5'].remainder.correctCount,0,'Old backups acquire safe defaults');
assert.strictEqual(remainderBackup.facts['5x5'].division.correctCount,0);
remainderBackup.config.min=1;remainderBackup.config.max=1;remainderBackup.config.enabledTables=[1];
api.normalizeProfile(remainderBackup);api.setState(remainderBackup);api.renderHome();
assert(elements.remainderBtn.disabled,'Explain unavailable mode instead of generating impossible remainders for divisor 1');
console.log('Division with remainder: 95/5 generation, explicit zero, choice/input/adaptive, retry, rewards, abort and backup OK');
// Repeated keyboard notifications do not rewrite CSS, scroll or clear canvases.
api.startArcadeGame('brick',true);
var savedRaf=context.requestAnimationFrame,savedCancel=context.cancelAnimationFrame;
var savedSetStyle=context.document.documentElement.style.setProperty;
var pendingViewport=new Map(),viewportSerial=100,viewportWrites=0,modalScrollWrites=0;
context.requestAnimationFrame=function(fn){var id=++viewportSerial;pendingViewport.set(id,fn);return id;};
context.cancelAnimationFrame=function(id){pendingViewport.delete(id);};
context.document.documentElement.style.setProperty=function(key,value){viewportWrites++;savedSetStyle.call(this,key,value);};
function flushViewport(){var frames=Array.from(pendingViewport.values());pendingViewport.clear();frames.forEach(function(fn){fn();});}
var fittingModal=elements.adminOverlay,editingField=elements.rewardEvery,modalScroll=0;
var savedPanelRect=fittingModal.getBoundingClientRect,savedFieldRect=editingField.getBoundingClientRect;
Object.defineProperty(fittingModal,'scrollTop',{configurable:true,get:function(){return modalScroll;},set:function(value){modalScrollWrites++;modalScroll=value;}});
fittingModal.classList.add('active');editingField.tagName='INPUT';editingField.value='12';
context.document.activeElement=editingField;
context.window.visualViewport={width:390,height:420,offsetTop:0,scale:1};
fittingModal.getBoundingClientRect=function(){return {top:0,bottom:420};};
var fieldBottom=300;editingField.getBoundingClientRect=function(){return {top:fieldBottom-44-modalScroll,bottom:fieldBottom-modalScroll};};
api.viewport();flushViewport();viewportWrites=0;modalScrollWrites=0;
var brickForViewport=api.games().brick,retainedRect={x:1};brickForViewport.inputRect=retainedRect;
for(var typingEvent=0;typingEvent<20;typingEvent++){editingField.value+='1';api.viewport();api.keepModalVisible();}
assert.strictEqual(viewportWrites,0,'Unchanged keyboard viewport performs no CSS writes');
assert.strictEqual(modalScrollWrites,0,'Fitting modal input is never rescrolled');
assert.strictEqual(pendingViewport.size,0,'Unchanged viewport queues no layout');
context.window.visualViewport.height=420.2;api.viewport();
assert.strictEqual(pendingViewport.size,0,'Subpixel viewport noise is ignored');
context.window.visualViewport.offsetTop=8;api.viewport();flushViewport();
assert.strictEqual(brickForViewport.inputRect,retainedRect,'Scrolling without resizing does not rebuild game canvases');
fieldBottom=470;context.window.visualViewport.height=415;api.viewport();
context.window.visualViewport.height=410;api.viewport();assert.strictEqual(pendingViewport.size,1,'Coalesce keyboard resize into one frame');
flushViewport();assert(modalScroll>0,'Covered input becomes visible');
modalScrollWrites=0;api.keepModalVisible();assert.strictEqual(modalScrollWrites,0,'No repeat scroll once visible');
assert.notStrictEqual(brickForViewport.inputRect,retainedRect,'Actual resize invalidates game bounds');
fittingModal.classList.remove('active');context.document.activeElement=context.document.body;
delete context.window.visualViewport;api.viewport();flushViewport();
assert.strictEqual(context.document.documentElement.style['--app-height'],'100dvh');
fittingModal.getBoundingClientRect=savedPanelRect;editingField.getBoundingClientRect=savedFieldRect;
delete fittingModal.scrollTop;fittingModal.scrollTop=0;
context.requestAnimationFrame=savedRaf;context.cancelAnimationFrame=savedCancel;context.document.documentElement.style.setProperty=savedSetStyle;
elements.brickHomeBtn.click();
console.log('Viewport: no typing/subpixel CSS or scroll writes, coalesced resize, covered input reveal and no canvas reset on scroll OK');

// Shared local-date seasons: annual inclusive starts, exclusive ends, midnight.
[2026,2027,2028].forEach(function(year){
  [[10,19,null],[10,20,'halloween'],[10,31,'halloween'],[11,1,null],[11,30,null],[12,1,'christmas'],[12,27,'christmas'],[12,28,null],[1,1,null]].forEach(function(spec){
    assert.strictEqual(api.seasonAt(new Date(year,spec[0]-1,spec[1])),spec[2]);
  });
});
var realDate=context.Date,seasonClock=0;
function SeasonalDate(){return Reflect.construct(realDate,arguments.length?Array.from(arguments):[seasonClock]);}
SeasonalDate.now=function(){return seasonClock;};SeasonalDate.prototype=realDate.prototype;
context.Date=SeasonalDate;
function seasonDate(month,day,hour,minute,second,ms){seasonClock=new realDate(2026,month-1,day,hour||0,minute||0,second||0,ms||0).getTime();}
[[10,19,null,'halloween'],[10,31,'halloween',null],[11,30,null,'christmas'],[12,27,'christmas',null]].forEach(function(edge){
  seasonDate(edge[0],edge[1],23,59,59,999);assert.strictEqual(api.season(),edge[2]);seasonClock++;assert.strictEqual(api.season(),edge[3]);
});
seasonDate(10,27);assert.strictEqual(api.season(),'halloween','Clock moved backwards refreshes the cached season');
var seasonalPaint=[],seasonalCtx=new Proxy({}, {
  get:function(target,key){return function(){seasonalPaint.push([key].concat(Array.from(arguments)));};},
  set:function(target,key,value){seasonalPaint.push([key,value]);return true;}
});
seasonDate(11,1);api.seasonDraw(seasonalCtx,480,640,30,false);api.seasonToken(seasonalCtx,10,10,8);
assert.strictEqual(seasonalPaint.length,0,'No automatic decorations outside the season windows');
seasonDate(10,27);api.seasonDraw(seasonalCtx,480,640,30,true);
assert(seasonalPaint.some(function(op){return op[0]==='arc'&&op[3]===20;}),'Moon also appears in quiet scenes');
assert(seasonalPaint.some(function(op){return op[0]==='fillStyle'&&op[1]==='#df6f28';}));
seasonalPaint=[];seasonDate(12,1);api.seasonDraw(seasonalCtx,480,640,30,false);
assert(seasonalPaint.some(function(op){return op[0]==='fillStyle'&&op[1]==='#ce475b';}));
assert(!seasonalPaint.some(function(op){return op[0]==='fillStyle'&&op[1]==='#df6f28';}),'No Halloween pumpkins at Christmas');
seasonalPaint=[];seasonDate(12,28);api.seasonDraw(seasonalCtx,480,640,30,false);assert.strictEqual(seasonalPaint.length,0);
var seasonRandom=context.Math.random;context.Math.random=function(){throw Error('Decoration must not use gameplay random');};
seasonDate(10,27);api.seasonDraw(seasonalCtx,480,640,30,false);seasonDate(12,1);api.seasonDraw(seasonalCtx,480,640,30,false);
context.Math.random=seasonRandom;
// Reduced-motion Christmas decorations freeze their animation geometry too.
context.window.matchMedia=function(){return {matches:true};};seasonalPaint=[];api.seasonDraw(seasonalCtx,480,640,5,false);
var stillChristmas=JSON.stringify(seasonalPaint);seasonalPaint=[];api.seasonDraw(seasonalCtx,480,640,30,false);
assert.strictEqual(JSON.stringify(seasonalPaint),stillChristmas);delete context.window.matchMedia;
var seasonProfile=api.normalizeProfile(api.defaultProfile());seasonProfile.config.sound=false;api.setState(seasonProfile);api.ensureFactPool();
function seasonalWorld(game){
  var world={};['player','dino','bird','body','food','bombs','board','platforms','obstacles','objects','bricks','balls','gaps','items','ship','rocks','terrainCache','cameraY','height','distance','elapsed','score','attempts','playTimeMs','speedPercent'].forEach(function(key){world[key]=game[key];});
  return JSON.stringify(world);
}
[
  ['Dino','game','dino'],['Flappy','flappy','flappy'],['Tower','tower','tower'],['Gravity','gravity','gravity'],
  ['Brick','brick','brick'],['Snake','snake','snake'],['Snow','snow','snow'],['Runner','runner','runner'],
  ['Doodle','doodle','doodle'],['Tiles','tiles','tiles'],['Maze','maze','maze'],['Asteroid','asteroid','asteroid']
].forEach(function(spec){
  seasonProfile.reward.availablePlays=2;elements['choose'+spec[0]+'Btn'].click();
  var game=api.games()[spec[2]],before=seasonalWorld(game),identity=JSON.stringify(seasonProfile.config.avatar);
  [[10,27],[11,1],[12,1],[12,28]].forEach(function(date){
    seasonDate(date[0],date[1]);var paints=[];
    var originalCtx=spec[2]==='gravity'?api.gravityContext():game.ctx;
    var wrapped=new Proxy(originalCtx||new Element().getContext(),{set:function(target,key,value){if(key==='fillStyle'||key==='strokeStyle')paints.push(value);target[key]=value;return true;}});
    if(spec[2]==='gravity')api.gravityContext(wrapped);else if(originalCtx)game.ctx=wrapped;
    context.Math.random=function(){throw Error('Season rendering changed random stream: '+spec[2]);};
    api.drawGame(spec[2]);context.Math.random=seasonRandom;
    assert.strictEqual(seasonalWorld(game),before,spec[2]+' season does not change gameplay');
    var costume={gravity:'#f8edcd',snake:'#684575',doodle:'#674979'}[spec[2]];
    if(costume)assert.strictEqual(paints.indexOf(costume)!==-1,date[0]===10,spec[2]+' Halloween costume switches off');
    if(spec[2]==='snake')assert.strictEqual(paints.indexOf('#df6f28')!==-1,date[0]===10,'Cleo pumpkins only during Halloween');
    if(spec[2]==='gravity')api.gravityContext(originalCtx);else if(originalCtx)game.ctx=originalCtx;
    assert.strictEqual(JSON.stringify(seasonProfile.config.avatar),identity,'Season does not overwrite chosen avatar outfit');
  });
  elements[spec[1]+'HomeBtn'].click();
});
seasonalPaint=[];seasonDate(11,1);api.streetDraw({ctx:seasonalCtx,elapsed:30,distance:0,viewHeight:360},300,1,0);
assert(!seasonalPaint.some(function(op){return op[0]==='fillText';}));
seasonalPaint=[];seasonDate(12,1);api.streetDraw({ctx:seasonalCtx,elapsed:30,distance:0,viewHeight:360},300,1,1);
assert(seasonalPaint.some(function(op){return op[0]==='fillStyle'&&op[1]==='#fff4df';}),'Metro Christmas snowman');
context.Date=realDate;
console.log('Seasons: annual/midnight/backwards-clock boundaries, decorations and costumes in all twelve games, reduced motion, unchanged worlds/avatars/random OK');
// Point-before-line: independently evaluate generated expressions, including brackets.
var priorityProfile=api.normalizeProfile(api.defaultProfile());priorityProfile.config.sound=false;priorityProfile.config.rewardEvery=1;
api.setState(priorityProfile);api.ensureFactPool();
assert.strictEqual(api.practiceSkillsInRange(null,'precedence').length,11);
assert.strictEqual(api.practiceSkill('p:unknown'),null);
var priorityRandom=context.Math.random;
api.precedenceTypes.forEach(function(type){
  for(var sample=0;sample<300;sample++){
    if(sample===0)context.Math.random=function(){return 0;};
    else if(sample===1)context.Math.random=function(){return .999999;};
    else context.Math.random=priorityRandom;
    var task=api.specialQuestion(api.practiceSkill('p:'+type));
    assert.strictEqual((task.prompt.match(/[+−·:]/g)||[]).length,2,'Only two operations, including brackets: '+task.prompt);
    var independentlyCalculated=vm.runInNewContext(task.prompt.replace(/·/g,'*').replace(/:/g,'/').replace(/−/g,'-'));
    assert.strictEqual(task.gen.correct,independentlyCalculated,task.prompt);
    assert(Number.isInteger(task.gen.correct)&&task.gen.correct>=0&&task.gen.correct<=100);
    assert.strictEqual(task.gen.options.length,4);assert.strictEqual(new Set(task.gen.options).size,4);
    assert(task.gen.options.includes(task.gen.correct));
    assert(task.gen.options.every(function(value){return Number.isInteger(value)&&value>=0;}));
    assert(task.gen.options.some(function(value){return value!==task.gen.correct&&Math.abs(value-task.gen.correct)<=2;}),'Nearby distractor prevents magnitude-only guessing');
    task.products.forEach(function(pair){assert(pair[0]>=1&&pair[0]<=9&&pair[1]>=1&&pair[1]<=9,task.prompt);});
    task.divisions.forEach(function(pair){
      assert.strictEqual(pair[0]%pair[1],0);var quotient=pair[0]/pair[1];
      assert(pair[1]>=2&&pair[1]<=9&&quotient>=1&&quotient<=9);
      assert(pair[1]<=5||quotient<=5,task.prompt+' respects lower five division families');
    });
    assert(task.explanation.includes('Klammern zuerst'));
    var firstMistake=task.mistakes.find(function(value){return Number.isInteger(value)&&value>=0&&value!==task.gen.correct;});
    assert(task.gen.options.includes(firstMistake),'Keep the first meaningful misconception: '+task.prompt);
  }
});
context.Math.random=priorityRandom;
var prioritySequence=[.125,.25,.12];context.Math.random=function(){return prioritySequence.length?prioritySequence.shift():.5;};
var priorityExample=api.precedenceQuestion('mulAdd');context.Math.random=priorityRandom;
assert.strictEqual(priorityExample.prompt,'3 · 4 + 2');
assert(priorityExample.gen.options.includes(14)&&priorityExample.gen.options.includes(18));
for(var round=0;round<100;round++){
  var priorityQueue=api.buildQueue(5,null,'precedence');
  assert.strictEqual(priorityQueue.length,5);assert.strictEqual(new Set(priorityQueue).size,5);
  assert(priorityQueue.some(function(key){return key.startsWith('p:bracket');}));
  assert(priorityQueue.some(function(key){return !key.startsWith('p:bracket');}));
}
priorityProfile.config.answerMode='choice';elements.precedenceBtn.click();
assert.strictEqual(priorityProfile.today.mode,'precedence');
assert(!elements.choicesWrap.hidden&&elements.remainderDivisionForm.hidden&&elements.writtenDivisionForm.hidden&&elements.semiDivisionForm.hidden);
assert.strictEqual(elements.choicesWrap.children.length,4);
assert(!elements.precedenceHint.hidden);
var priorityKey=priorityProfile.today.queue[0],priorityType=api.practiceSkill(priorityKey).precedenceType;
var priorityAnswer=vm.runInNewContext(elements.questionText.textContent.replace(/·/g,'*').replace(/:/g,'/').replace(/−/g,'-'));
elements.choicesWrap.children.find(function(button){return Number(button.textContent)===priorityAnswer;}).click();
assert.strictEqual(priorityProfile.precedenceSkills[priorityType].correctCount,1);
assert.strictEqual(priorityProfile.reward.availablePlays,1);
assert.strictEqual(priorityProfile.history[priorityProfile.today.date].byOperation.precedence.correct,1);
assert(elements.feedbackText.textContent.includes('Klammern zuerst'));
api.finishSession();assert(api.repeatRoundLabel(false).includes('Punkt vor Strich'));
elements.doneBonusBtn.click();assert.strictEqual(priorityProfile.today.mode,'precedence');
priorityProfile.today.queue=['p:mulAdd'];priorityProfile.today.index=0;
priorityProfile.precedenceSkills.mulAdd.seen=true;priorityProfile.precedenceSkills.mulAdd.box=2;
priorityProfile.config.answerMode='adaptive';api.renderQuestion();assert.strictEqual(elements.choicesWrap.children.length,12);
priorityProfile.precedenceSkills.mulAdd.box=1;api.renderQuestion();assert.strictEqual(elements.choicesWrap.children.length,4);
api.onAnswer('p:mulAdd',-1,999,null,false,'test');
assert.strictEqual(priorityProfile.today.queue.length,2);assert.strictEqual(priorityProfile.today.requeueCounts['p:mulAdd'],1);
elements.abortSessionBtn.click();assert.strictEqual(priorityProfile.today.mode,'mixed');
assert.strictEqual(priorityProfile.reward.availablePlays,1,'Abort preserves priority-mode rewards');
var priorityBackup=api.normalizeProfile(JSON.parse(JSON.stringify(priorityProfile)));
assert.strictEqual(api.correctAnswersForProfile(priorityBackup),1);
assert.strictEqual(priorityBackup.history[priorityBackup.today.date].byOperation.precedence.correct,1);
priorityBackup.today.mode='precedence';priorityBackup.today.queue=['p:bracketMul'];priorityBackup.today.focusTable=null;
api.normalizeProfile(priorityBackup);assert.strictEqual(priorityBackup.today.mode,'precedence');
assert.strictEqual(priorityBackup.today.queue[0],'p:bracketMul');
delete priorityBackup.precedenceSkills;api.normalizeProfile(priorityBackup);
assert.strictEqual(Object.keys(priorityBackup.precedenceSkills).length,14);
assert.strictEqual(priorityBackup.precedenceSkills.mulAdd.correctCount,0,'Old backups get defaults');
['bracketMixed','allMixed','bracketAll'].forEach(function(type){
  var legacy=api.practiceSkill('p:'+type);assert(legacy,'Old queue keys remain readable');
  for(var sample=0;sample<100;sample++){
    var task=api.specialQuestion(legacy);
    assert.strictEqual((task.prompt.match(/[+−·:]/g)||[]).length,2,'Old saved rounds also use two operations');
  }
  assert(!api.buildQueue(30,null,'precedence').includes('p:'+type),'Do not schedule retired long types');
});
priorityProfile.precedenceSkills.allMixed.correctCount=3;
assert.strictEqual(api.correctAnswersForProfile(priorityProfile),4,'Preserve rewards from retired task types');
var legacyPriority=api.normalizeProfile(JSON.parse(JSON.stringify(priorityProfile)));
assert.strictEqual(legacyPriority.precedenceSkills.allMixed.correctCount,3);
console.log('Punkt vor Strich: 11 two-operation types, simple saved legacy rounds, preserved progress, independent evaluation and normal learning lifecycle OK');
console.log('Learning modes: generation, UI answers, retries, rewards, migration, replay and completion OK');
