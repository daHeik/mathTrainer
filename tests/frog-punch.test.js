'use strict';
var assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
var context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','frog-punch.js'),'utf8'),context);
var api=context.window.FrogPunch;
function live(g){return g.holes.map(function(h,i){return h.born!==null&&h.hitAt===null?i:-1;}).filter(function(i){return i>=0;});}
var g=api.create(function(){return .5;});assert.strictEqual(g.holes.length,0);assert(!api.hit(g,0));
assert(api.beginRound(g));assert.strictEqual(g.holes.length,15);assert(!api.beginRound(g));
api.advance(g,.35);var first=live(g)[0];assert.strictEqual(live(g).length,1);assert.strictEqual(g.holes[first].duration,.75);
assert.strictEqual(api.pose(g,g.holes[first],false),0);
api.advance(g,.08);assert(api.pose(g,g.holes[first],false)>0&&api.pose(g,g.holes[first],false)<1);
g.pausedAt=123;var elapsed=g.elapsed;
assert(!api.advance(g,20));assert(!api.hit(g,first));assert.strictEqual(g.elapsed,elapsed);g.pausedAt=null;
assert(api.hit(g,first));assert(!api.hit(g,first));assert.strictEqual(g.score,1);
api.advance(g,.2);assert.strictEqual(api.pose(g,g.holes[first],false),0);api.advance(g,.8);assert.strictEqual(g.missed,0);
var miss=api.create(function(){return .5;});api.beginRound(miss);api.advance(miss,.35);var missedIndex=live(miss)[0];api.advance(miss,.75);
assert(!api.hit(miss,missedIndex));assert.strictEqual(miss.missed,1,'A frog disappears exactly 750 ms after appearing');
var pair=api.create(function(){return .5;});api.beginRound(pair);pair.nextDouble=.35;api.advance(pair,.35);
var pairIndices=live(pair);assert.strictEqual(pairIndices.length,2);api.advance(pair,.8);
assert.strictEqual(live(pair).length,2,'Both frogs in a pair remain hittable past 750 ms');
assert(api.hit(pair,pairIndices[0]));api.advance(pair,pair.holes[pairIndices[1]].born+1-pair.elapsed);assert(!api.hit(pair,pairIndices[1]));assert.strictEqual(pair.missed,1,'The second frog expires at one second');
var pairTimes=[];
g=api.create(function(){return .5;});
for(var round=0;round<3;round++){
  assert(api.beginRound(g));var doubleCount=0;
  while(g.running){
    var active=live(g);assert(active.length<=2);
    if(active.length===2){active.forEach(function(i){assert.strictEqual(g.holes[i].duration,1);});doubleCount++;if(round===0)pairTimes.push(g.elapsed);}
    active.forEach(function(i){assert(api.hit(g,i));});
    api.advance(g,.025);
  }
  assert.strictEqual(g.elapsed,40);assert.strictEqual(g.missed,0);assert.strictEqual(g.roundScore,g.spawned);
  assert(g.spawned>=27&&g.spawned<=35);assert(doubleCount>=2);assert.strictEqual(g.completedRounds,round+1);
}
assert(!api.beginRound(g));assert.strictEqual(g.score,g.spawned*3);
assert(pairTimes[0]>=14&&pairTimes[0]<=16);assert(pairTimes[1]-pairTimes[0]>=14&&pairTimes[1]-pairTimes[0]<=16);
var fast=api.create(function(){return 0;});api.beginRound(fast);assert(api.advance(fast,100));assert.strictEqual(fast.elapsed,40);assert.strictEqual(fast.missed,fast.spawned);assert(!api.advance(fast,1));
assert.strictEqual(fast.completedRounds,1,'Long frames finish a round once without skipping expired frogs');
var entries=[{id:'frog-old',at:100,score:80},{id:'frog-new',at:200,score:80},{id:'frog-best',at:1,score:100},{id:'frog-a',at:1,score:10},{id:'frog-b',at:1,score:9},{id:'frog-c',at:1,score:8}];
var leaders=api.topFive(entries);assert.strictEqual(leaders.length,5);assert.strictEqual(leaders[0].id,'frog-best');assert.strictEqual(leaders[1].id,'frog-new');assert.strictEqual(leaders[2].id,'frog-old');
assert.strictEqual(entries.length,6,'Leaderboard normalization does not mutate its input');
assert.strictEqual(api.topFive([{id:'frog-current',at:200,score:80}].concat(entries))[1].id,'frog-current','Newest insertion wins an exact timestamp tie');
[null,{},[{id:'frog-bad',at:NaN,score:4}],[{id:'frog-bad',at:100,score:-1}],[{id:'<img>',at:100,score:4}],[{id:'frog-bad',at:Infinity,score:4}]].forEach(function(bad){assert.strictEqual(api.topFive(bad).length,0);});
assert.strictEqual(api.topFive([entries[0],entries[0]]).length,1);
console.log('Frog Punch: 15 holes, 750ms singles/one-second pairs, pop animation, unique hits, simultaneous pairs every ~15s, pause, 3×40s, perfect/missed rounds and safe top-five ordering OK');
