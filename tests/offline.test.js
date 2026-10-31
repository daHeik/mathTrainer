'use strict';
// No browser data or network: check the complete offline asset graph.
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');
var handlers = {};
var context = { self:{ addEventListener:function(name, fn){ handlers[name] = fn; } } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
var assets = Array.from(context.ASSETS);
assets.forEach(function(asset){ assert(fs.existsSync(path.join(root, asset)), 'Missing cached asset: ' + asset); });
['gravity','brick','snake','snow','flappy','tower','runner','doodle','tiles','maze','asteroid'].forEach(function(game){
  assert(assets.indexOf('./' + game + '.html') !== -1);
  assert(fs.readFileSync(path.join(root, game + '.html'), 'utf8').indexOf('?demo=' + game) !== -1);
});
['index.html','app.js','arcade-extra.js','styles.css','icons.svg','manifest.json'].forEach(function(file){ assert(assets.indexOf('./' + file) !== -1); });
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var home = html.slice(html.indexOf('id="screen-home"'), html.indexOf('id="screen-semi-intro"'));
var modeOrder = ['precedenceBtn','semiBtn','writtenBtn','riddlesBtn','remainderBtn','hundredsBtn','termsBtn','tablePracticeBtn','startBtn','bonusBtn'];
modeOrder.forEach(function(id,index){
  assert(home.indexOf('id="'+id+'"')!==-1,'Home mode exists: '+id);
  if(index)assert(home.indexOf('id="'+modeOrder[index-1]+'"')<home.indexOf('id="'+id+'"'),'Home modes run from advanced/new to basic');
});
var css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
// Avatar imports must not replace the app shell, learning forms or game layout.
[
  '.app-bar', '#app>.card', '.screen.active', '.app-navigation',
  'body.standalone-app .app-navigation', 'body.focused-view',
  '.game-immersive.active', '.game-immersive .game-toolbar',
  '.game-immersive .game-wrap', '.written-equation', '.written-number',
  '.semi-division', '.semi-work', '.runner-controls', '.classic-controls',
  '.direction-pad', '.icon', '.snake-controls button', '.home-actions .action-label', '.remainder-answer',
  '.home-avatar', '.player-modal', '.avatar-settings'
].forEach(function(selector){
  assert(css.indexOf(selector + ' {') !== -1 || css.indexOf(selector + '{') !== -1,
    'Required layout rule: ' + selector);
});
assert(/@media\s*\(min-width:760px\)/.test(css), 'Desktop sidebar layout remains available');
assert(/@media\s*\(orientation:landscape\)/.test(css), 'Landscape layout remains available');
assert(/\.modal-overlay\s*\{[^}]*height:var\(--modal-height,/.test(css), 'Modal follows keyboard viewport independently of app shell');
var appVersion = html.match(/id="appVersion">Version (\d+)<\/p>/);
assert(appVersion, 'Home screen shows the app version');
assert.strictEqual('1x1-trainer-v' + appVersion[1], context.CACHE_NAME, 'Visible app version matches the release cache version');
var icons = fs.readFileSync(path.join(root, 'icons.svg'), 'utf8');
assert.strictEqual((icons.match(/<\/svg>/g)||[]).length,1,'Exactly one SVG root');
assert(icons.lastIndexOf('</symbol>')<icons.indexOf('</svg>'),'All icons belong inside the sprite root');
['dino','bird','tower','gravity','brick','jump','tiles','maze','rocket'].forEach(function(name){
  var symbol=icons.match(new RegExp('<symbol id="'+name+'"[\\s\\S]*?</symbol>'));
  assert(symbol&&/fill="#[\da-f]{6}"/i.test(symbol[0]),'Colored game icon: '+name);
});
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
console.log('Offline: all twelve games, launchers, colored SVG icons, module load order and screen structure OK');
