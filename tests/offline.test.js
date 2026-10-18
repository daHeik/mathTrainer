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
['gravity','brick','snake','snow','flappy','tower'].forEach(function(game){
  assert(assets.indexOf('./' + game + '.html') !== -1);
  assert(fs.readFileSync(path.join(root, game + '.html'), 'utf8').indexOf('?demo=' + game) !== -1);
});
['index.html','app.js','styles.css','icons.svg','manifest.json'].forEach(function(file){ assert(assets.indexOf('./' + file) !== -1); });
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var icons = fs.readFileSync(path.join(root, 'icons.svg'), 'utf8');
Array.from(html.matchAll(/href="icons\.svg#([^"]+)"/g)).forEach(function(match){
  assert(icons.indexOf('id="' + match[1] + '"') !== -1, 'Unknown icon ' + match[1]);
});
assert(!/vocabulator|Vokabel|trainer\.js|data\/manifest/.test(html));
assert(handlers.install && handlers.activate && handlers.fetch);
console.log('Offline: all seven games, launchers, icons and app assets available');
