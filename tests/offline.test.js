'use strict';
// No browser data or network: check the complete offline asset graph.
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');
var handlers = {};
var context = { URL:URL, Response:Response, self:{ registration:{scope:"https://example.org/trainer/"}, addEventListener:function(name, fn){ handlers[name] = fn; } } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
var assets = Array.from(context.ASSETS);
assets.forEach(function(asset){ assert(fs.existsSync(path.join(root, asset)), 'Missing cached asset: ' + asset); });
['gravity','brick','snake','snow','flappy','tower','runner','doodle','tiles','maze','asteroid','golf','grab','pinball','frog','chicken'].forEach(function(game){
  assert(assets.indexOf('./' + game + '.html') !== -1);
  assert(fs.readFileSync(path.join(root, game + '.html'), 'utf8').indexOf('?demo=' + game) !== -1);
});
['index.html','app.js','blank-paper.js','curriculum.js','arcade-extra.js','frog-punch.js','chicken-shooter.js','styles.css','icons.svg','manifest.json'].forEach(function(file){ assert(assets.indexOf('./' + file) !== -1); });
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var home = html.slice(html.indexOf('id="screen-home"'), html.indexOf('id="screen-semi-intro"'));
var homeGroups = [
  ['Numbers',['numbers10000Btn','romanBtn','termsBtn']],
  ['Arithmetic',['tablePracticeBtn','hundredsBtn','remainderBtn','numberTheoryBtn']],
  ['Methods',['semiMultiplyBtn','semiBtn','writtenBtn','precedenceBtn']],
  ['Application',['wordProblemsBtn','riddlesBtn']]
];
homeGroups.forEach(function(group){
  var section=home.slice(home.indexOf('id="homeGroup'+group[0]+'"'));
  section=section.slice(0,section.indexOf('</section>'));
  group[1].forEach(function(id){assert(section.indexOf('id="'+id+'"')!==-1,'Topic belongs to '+group[0]+': '+id);});
});
assert(home.indexOf('id="exam1126Btn"')<home.indexOf('id="homeTopicGroups"'),'Test has a separate entry above topic groups');
assert(home.indexOf('id="mixedLearning"')<home.indexOf('id="homeTopicGroups"'),'Mixed round stays directly accessible');
var css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
// Avatar imports must not replace the app shell, learning forms or game layout.
[
  '.app-bar', '#app>.card', '.screen.active', '.app-navigation',
  'body.focused-view', 'body.learning-input-viewport',
  '.game-immersive.active', '.game-immersive .game-toolbar',
  '.game-immersive .game-wrap', '.written-equation', '.written-number',
  '.semi-division', '.semi-work', '.runner-controls', '.classic-controls',
  '.direction-pad', '.icon', '.snake-controls button', '.home-actions .action-label', '.remainder-answer',
  '.home-avatar', '.player-modal', '.avatar-settings'
].forEach(function(selector){
  assert(css.indexOf(selector + ' {') !== -1 || css.indexOf(selector + '{') !== -1,
    'Required layout rule: ' + selector);
});
assert(/\.app-navigation\s*\{[^}]*grid-row:3;[^}]*var\(--safe-bottom\)/.test(css), 'Mobile navigation reserves the full bottom safe area');
assert(/@media\s*\(min-width:760px\)/.test(css), 'Desktop sidebar layout remains available');
assert(/@media\s*\(orientation:landscape\)/.test(css), 'Landscape layout remains available');
assert(/\.modal-overlay\s*\{[^}]*height:var\(--modal-height,/.test(css), 'Modal follows keyboard viewport independently of app shell');
assert(html.includes('viewport-fit=contain') && !html.includes('black-translucent'),
  'iOS keeps the app viewport inside the system controls');
var appVersion = html.match(/id="appVersion">Version (\d+)<\/p>/);
assert(appVersion, 'Home screen shows the app version');
assert.strictEqual('1x1-trainer-v' + appVersion[1], context.CACHE_NAME, 'Visible app version matches the release cache version');
var icons = fs.readFileSync(path.join(root, 'icons.svg'), 'utf8');
assert.strictEqual((icons.match(/<\/svg>/g)||[]).length,1,'Exactly one SVG root');
assert(icons.lastIndexOf('</symbol>')<icons.indexOf('</svg>'),'All icons belong inside the sprite root');
['dino','bird','tower','gravity','brick','jump','tiles','maze','rocket','frog','chicken'].forEach(function(name){
  var symbol=icons.match(new RegExp('<symbol id="'+name+'"[\\s\\S]*?</symbol>'));
  assert(symbol&&/fill="#[\da-f]{6}"/i.test(symbol[0]),'Colored game icon: '+name);
});
assert(html.includes('id="openPaper"') && html.includes('id="paperCanvas"'));
assert(html.indexOf('<script src="blank-paper.js">') >= 0 && html.indexOf('<script src="blank-paper.js">') < html.indexOf('<script src="app.js">'));
assert(html.indexOf('<script src="chicken-shooter.js">')<html.indexOf('<script src="app.js">'),'Chicken Shooter loads before normalization');
assert(html.indexOf('<script src="frog-punch.js">')<html.indexOf('<script src="app.js">'),'Frog Punch loads before app/profile normalization');
assert(html.indexOf('<script src="arcade-extra.js">')<html.indexOf('<script src="app.js">'),'Arcade module loads before app');
var divs=[],screenCount=0;
Array.from(html.matchAll(/<(\/?)div\b([^>]*)>/g)).forEach(function(tag){
  if(tag[1]){assert(divs.length,'Balanced div closing tags');divs.pop();return;}
  var classes=(tag[2].match(/class="([^"]*)"/)||[])[1]||'';
  if(classes.split(/\s+/).indexOf('screen')!==-1){
    assert(divs.some(function(value){return value.split(/\s+/).indexOf('card')!==-1;}),'Screens remain inside app card');screenCount++;
  }
  divs.push(classes);
});
assert.strictEqual(divs.length,0);
assert(screenCount>=12);
Array.from(html.matchAll(/href="icons\.svg#([^"]+)"/g)).forEach(function(match){
  assert(icons.indexOf('id="' + match[1] + '"') !== -1, 'Unknown icon ' + match[1]);
});
assert(!/vocabulator|Vokabel|trainer\.js|data\/manifest/.test(html));
assert(handlers.install && handlers.activate && handlers.fetch);
console.log('Offline: all seventeen games, launchers, colored SVG icons, module load order and screen structure OK');

assert(html.indexOf('src="curriculum.js"')<html.indexOf('src="app.js"'),'Curriculum loads before the app');

async function verifyFetch(){
  var base=context.self.registration.scope, stored=new Map(), cached=new Response('working');
  stored.set(base+'app.js', cached);
  stored.set(base+'index.html', new Response('home'));
  context.caches={open:async function(name){
    assert.strictEqual(name,context.CACHE_NAME);
    return {match:async function(key){return stored.get(key);},put:async function(key,value){stored.set(key,value);}};
  }};
  async function visit(path){
    var result, work=[];
    handlers.fetch({request:new Request(new URL(path,base)),respondWith:function(p){result=p;},waitUntil:function(p){work.push(p);}});
    var response=await result;
    await Promise.all(work);
    return response;
  }
  context.fetch=async function(){return new Response('unavailable',{status:503});};
  assert.strictEqual(await visit('app.js'),cached);
  assert.strictEqual(stored.get(base+'app.js'),cached);
  context.fetch=async function(){throw Error('offline');};
  assert.strictEqual(await (await visit('index.html?demo=golf')).text(),'home');
  assert.strictEqual((await visit('styles.css')).type,'error');
  assert.strictEqual(await visit('unknown.js'),undefined);
  context.fetch=async function(){return new Response('updated');};
  assert.strictEqual(await (await visit('app.js')).text(),'updated');
  assert.strictEqual(await stored.get(base+'app.js').text(),'updated');
  console.log('Offline fetch: updates, server errors, missing assets and demo navigation OK');
}
verifyFetch().catch(function(error){console.error(error);process.exitCode=1;});
