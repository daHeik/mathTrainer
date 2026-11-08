'use strict';
var assert=require('assert'),vm=require('vm'),fs=require('fs'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'..','chicken-shooter.js'),'utf8'),ctx);
var api=ctx.window.ChickenShooter;
[[1,1,'winter'],[3,31,'winter'],[4,1,'spring'],[6,30,'spring'],[7,1,'summer'],[9,14,'summer'],[9,15,'autumn'],[11,30,'autumn'],[12,1,'winter']].forEach(function(t){assert.strictEqual(api.theme(new Date(2026,t[0]-1,t[1])).season,t[2]);});
[[10,19,null],[10,20,'halloween'],[10,31,'halloween'],[11,1,null],[12,1,'christmas'],[12,27,'christmas'],[12,28,null]].forEach(function(t){assert.strictEqual(api.theme(new Date(2026,t[0]-1,t[1])).holiday,t[2]);});
assert.strictEqual(api.easter(2026).getDate(),5);assert.strictEqual(api.easter(2026).getMonth(),3);
[-8,-7,0,7,8].forEach(function(offset){assert.strictEqual(api.theme(new Date(2026,3,5+offset)).holiday,Math.abs(offset)<=7?'easter':null);});
var g=api.create(function(){return .5;});assert(!api.shoot(g,0,0));g.running=true;api.advance(g,2);assert.strictEqual(g.targets.length,2);
var target={born:0,layer:2,r:30,size:30,speed:100,direction:1,baseY:180,phase:0,maneuver:false,points:55};g.targets=[target];var p=api.position(g,target);
assert(api.shoot(g,p.x,p.y));assert.strictEqual(g.score,55);assert.strictEqual(g.targets.length,0);assert(!api.shoot(g,p.x,p.y));assert.strictEqual(g.score,-45);
g.pausedAt=1;var frozen=g.elapsed,ammo=g.ammo;api.advance(g,50);assert(!api.shoot(g,0,0));assert(!api.reload(g));assert.strictEqual(g.elapsed,frozen);assert.strictEqual(g.ammo,ammo);g.pausedAt=null;
assert(api.reload(g));assert(!api.shoot(g,0,0));api.advance(g,.99);assert(g.reloadUntil);api.advance(g,.02);assert.strictEqual(g.ammo,6);assert.strictEqual(g.reloadUntil,0);
var o=api.obstacles(g,0)[0];target.layer=0;assert(api.covered(g,target,o.x,o.y-o.r));target.layer=2;assert(!api.covered(g,target,o.x,o.y-o.r));
o=api.obstacles(g,2)[1];assert(api.covered(g,target,o.x,o.y));
// Place a bird completely inside the foreground barn: the same geometry blocks the shot.
g.targets=[target];target.born=g.elapsed-(o.x+100)/target.speed;target.baseY=o.y-Math.sin((g.elapsed-target.born)*2)*16;assert(!api.shoot(g,o.x,o.y));assert.strictEqual(g.targets.length,1);
for(var n=0;n<6;n++)api.shoot(g,0,0);assert.strictEqual(g.ammo,0);assert(g.reloadUntil);api.advance(g,1.01);assert.strictEqual(g.ammo,6);
assert(api.advance(g,200));assert.strictEqual(g.elapsed,90);assert(!g.running);assert(!api.shoot(g,100,100));assert(!api.advance(g,1));
var entries=[];for(var i=0;i<8;i++)entries.push({id:'chicken-'+i,at:i,score:i*10});assert.strictEqual(api.topFive(entries).length,5);assert.strictEqual(api.topFive(entries)[0].score,70);assert.strictEqual(api.topFive([{id:'chicken-new',at:7,score:70}].concat(entries))[0].id,'chicken-new');
assert.strictEqual(api.topFive([{id:'bad',at:0,score:1},{id:'chicken-x',at:Infinity,score:3},{id:'chicken-y',at:0,score:1.5}]).length,0);assert.strictEqual(api.topFive([entries[0],entries[0]]).length,1);
var seed=123;g=api.create(function(){seed=(seed*16807)%2147483647;return seed/2147483647;});g.running=true;var vehicles={},layers={},sizes={},speeds={},man=false;
for(i=0;i<800;i++){api.advance(g,.1);g.targets.forEach(function(t){vehicles[t.vehicle]=true;layers[t.layer]=true;sizes[Math.round(t.r)]=true;speeds[Math.round(t.speed)]=true;man=man||t.maneuver;});}
assert(vehicles.plane&&vehicles.balloon&&vehicles.glider);assert.strictEqual(Object.keys(layers).length,3);assert(Object.keys(sizes).length>6);assert(Object.keys(speeds).length>10);assert(man);
console.log('Chicken Shooter: seasons/holidays/Easter boundaries, targets, vehicles, maneuvers, hit/decking, score, ammunition/reload, pause, deadline and top-five validation OK');

// Every part of the painted bird counts, including reversed and rotated silhouettes.
[0,1,2,3,4,5].forEach(function(character){[1,-1].forEach(function(direction){[false,true].forEach(function(reduced){
  var game=api.create();game.running=true;game.elapsed=4;game.reduced=reduced;
  var bird={born:0,layer:2,r:30,speed:100,direction:direction,baseY:160,phase:.8,maneuver:true,loopAt:3,loopEvery:8,character:character,points:50};
  var pose=api.position(game,bird),angle=reduced?0:pose.angle;
  [[15,-49],[-46,-23],[44,-15],[0,0]].concat(character===1?[[3,-50],[35,-50]]:[]).forEach(function(part){
    var localX=part[0]*direction,localY=part[1],x=pose.x+localX*Math.cos(angle)-localY*Math.sin(angle),y=pose.y+localX*Math.sin(angle)+localY*Math.cos(angle);
    assert(api.birdHit(game,bird,x,y),'Crest, bow, tail and beak count in the actual rendering pose');
  });
  assert(!api.birdHit(game,bird,pose.x,pose.y+100),'Empty sky below a bird is not a target');
});});});
var mobile=api.create(function(){return .5;});mobile.width=390;mobile.running=true;for(i=0;i<850;i++){api.advance(mobile,.1);assert(mobile.targets.length<=5,'Phone density is capped at five');}
var desktop=api.create(function(){return .5;});desktop.running=true;for(i=0;i<850;i++){api.advance(desktop,.1);assert(desktop.targets.length<=7,'Wide scene density is capped at seven');}
var resizeBird=desktop.targets[0],beforeResize=api.position(desktop,resizeBird);api.resize(desktop,600);var afterResize=api.position(desktop,resizeBird);assert(Math.abs(afterResize.x-beforeResize.x*.6)<.001);assert.strictEqual(afterResize.y,beforeResize.y,'Resize preserves age, maneuver and height');
var flights={};g.targets.forEach(function(b){flights[b.flight]=true;});
console.log('Chicken Shooter refinement: complete crest/bow/tail/beak silhouettes with rotation/mirroring/reduced motion, capped density and stable resize OK');
// Distinct motion modes have different trajectories and a genuine stationary hover phase.
var motionGame=api.create(),motionBird={born:0,layer:2,r:30,speed:100,direction:1,baseY:180,phase:.7,amplitude:40,frequency:1.3,pace:0,hoverAt:3,hold:2,points:50};
var motionPaths={};['cruise','swoop','flutter','zigzag','hover','balloon','glide'].forEach(function(mode){motionBird.flight=mode;var samples=[];[2,3.5,4.5,6].forEach(function(age){motionGame.elapsed=age;var point=api.position(motionGame,motionBird);samples.push(point.x.toFixed(2)+','+point.y.toFixed(2));});motionPaths[samples.join(';')]=true;});assert.strictEqual(Object.keys(motionPaths).length,7);
motionBird.flight='hover';motionGame.elapsed=3.5;var hoverX=api.position(motionGame,motionBird).x;motionGame.elapsed=4.5;assert.strictEqual(api.position(motionGame,motionBird).x,hoverX);
// Exercise the public shooting path on actual outlying figure parts, not just the helper.
[[0,[15,-49]],[1,[2,-51]],[0,[-54,-20]],[0,[45,-15]],[0,[-11,30]]].forEach(function(sample){var hitGame=api.create();hitGame.running=true;hitGame.elapsed=3;var b={born:0,layer:2,r:30,speed:100,direction:1,baseY:160,phase:0,character:sample[0],points:50};hitGame.targets=[b];var pose=api.position(hitGame,b),c=Math.cos(pose.angle),s=Math.sin(pose.angle),v=sample[1];assert(api.shoot(hitGame,pose.x+v[0]*c-v[1]*s,pose.y+v[0]*s+v[1]*c),'The full crest/bow/tail/beak/feet award points');assert.strictEqual(hitGame.score,50);});
console.log('Chicken Shooter individuality: seven distinct paths, real hovering and scored crest/bow/tail/beak/feet hits OK');
var renderCalls=0,gradient={addColorStop:function(){}};
var drawing=new Proxy({createLinearGradient:function(){return gradient;},createRadialGradient:function(){return gradient;}},{get:function(object,key){if(key in object)return object[key];return function(){renderCalls++;Array.from(arguments).forEach(function(value){if(typeof value==='number')assert(Number.isFinite(value),'Canvas coordinates stay finite');});};}});
[new Date(2026,10,8),new Date(2026,4,1),new Date(2026,7,1),new Date(2026,11,15),new Date(2026,9,25),new Date(2026,3,5)].forEach(function(date){[390,1000].forEach(function(width){var scene=api.create(function(){return .5;},date);scene.width=width;scene.running=true;api.advance(scene,12);scene.random=function(){throw new Error('Drawing must not consume gameplay randomness');};var before=JSON.stringify(scene);api.draw(drawing,scene,false);api.draw(drawing,scene,true);assert.strictEqual(JSON.stringify(scene),before,'Art must not mutate simulation state');});});
assert(renderCalls>1000);console.log('Chicken Shooter rendering: all six themes, narrow/wide, normal/reduced motion, finite coordinates, cosmetic-only art OK');

// Cows must face the direction they actually travel, including after turning.
[390,1000].forEach(function(width){for(var index=0;index<3;index++)[0,10,25,40,60,85].forEach(function(time){var scene={width:width,elapsed:time},pose=api.cowPose(scene,index,false);scene.elapsed+=.001;var movement=api.cowPose(scene,index,false).x-pose.x;if(Math.abs(movement)>.000001)assert.strictEqual(pose.direction,movement>0?1:-1,'Cows face their actual travel direction');var still=api.cowPose(scene,index,true);scene.elapsed+=20;assert.strictEqual(api.cowPose(scene,index,true).x,still.x,'Reduced motion keeps cows stationary');});});
console.log('Farm cows: face their walking direction before/after turns; reduced motion stays stationary OK');
// Pond guests follow seasons, use active time, and never score below the surface.
var pondGame=api.create(function(){return .5;},new Date(2026,6,4));pondGame.running=true;api.advance(pondGame,7.4);
var diver=pondGame.visitors.find(function(v){return v.visitor==='diver';});assert(diver,'A diving chicken visits the summer pond');assert.strictEqual(diver.duration,2);
var water=api.pond(pondGame),diverPose=api.position(pondGame,diver);assert(api.birdHit(pondGame,diver,diverPose.x+17*.7*diver.direction,diverPose.y-24*.7));assert(!api.birdHit(pondGame,diver,diverPose.x,water.y+1),'Submerged feathers never count');
pondGame.pausedAt=1;var pondClock=pondGame.elapsed;api.advance(pondGame,5);assert.strictEqual(pondGame.elapsed,pondClock);assert.strictEqual(pondGame.visitors.find(function(v){return v.visitor==='diver';}),diver);pondGame.pausedAt=null;
var diveAt=diver.born+diver.duration;pondGame.nextPond=1000;api.advance(pondGame,diveAt-pondGame.elapsed);assert(!pondGame.visitors.some(function(v){return v.visitor==='diver';}),'Diver leaves exactly at two active seconds');assert(!api.birdHit(pondGame,diver,diverPose.x,diverPose.y-20));
var winterGame=api.create(function(){return .5;},new Date(2026,0,4));winterGame.running=true;api.advance(winterGame,7.4);var skater=winterGame.visitors.find(function(v){return v.visitor==='skater';});assert(skater);assert(!winterGame.visitors.some(function(v){return v.visitor==='diver';}));var skateBefore=api.position(winterGame,skater);api.advance(winterGame,.2);assert.notStrictEqual(api.position(winterGame,skater).x,skateBefore.x,'Winter chicken skates across the ice');
// Door guests can be hit through their open door; the rest of the barn stays cover.
var barnGame=api.create(function(){return .5;},new Date(2026,6,4));barnGame.running=true;api.advance(barnGame,4.5);var peeker=barnGame.visitors.find(function(v){return v.visitor==='peek';});assert(peeker);var barn=api.obstacles(barnGame,peeker.layer)[1],peekPose=api.position(barnGame,peeker),eyeX=peekPose.x+25*.6*peeker.direction,eyeY=peekPose.y-24*.6;
assert(api.birdHit(barnGame,peeker,eyeX,eyeY));assert(!api.covered(barnGame,peeker,eyeX,eyeY));assert(!api.birdHit(barnGame,peeker,barn.x+barn.r*.8,eyeY),'Barn wall is not the visitor target');assert(api.shoot(barnGame,eyeX,eyeY));assert.strictEqual(barnGame.score,55);assert(!barnGame.visitors.includes(peeker));
[390,1000].forEach(function(width){[new Date(2026,0,4),new Date(2026,6,4)].forEach(function(date){var game=api.create(function(){return .5;},date);game.width=width;game.running=true;api.advance(game,7.4);var original=JSON.stringify(game);api.draw(drawing,game,false);api.draw(drawing,game,true);assert.strictEqual(JSON.stringify(game),original);var v=game.visitors.find(function(b){return b.visitor==='diver'||b.visitor==='skater';});assert(v);var before=api.position(game,v);api.resize(game,width*1.3);var after=api.position(game,v);assert(Math.abs(after.x-before.x*1.3)<10,'Pond guests stay attached to the pond after resize');});});
console.log('Farm visitors: two-second diver, underwater clipping/expiry, winter skating, open-door hits/wall rejection, pause, rendering and resize OK');
['summer','winter'].forEach(function(season){var scene=api.create(function(){return .5;},season==='winter'?new Date(2026,0,4):new Date(2026,6,4));scene.running=true;api.advance(scene,7.5);var guest=scene.visitors.find(function(v){return v.layer===3;});assert.strictEqual(guest.duration,season==='winter'?6:2);var pose=api.position(scene,guest),face=pose.direction||guest.direction;assert(api.shoot(scene,pose.x+25*.7*face,pose.y-24*.7));assert.strictEqual(scene.score,season==='winter'?60:65);assert(!scene.visitors.includes(guest));});
var lateGuest=api.create(function(){return .5;},new Date(2026,0,4));lateGuest.elapsed=89;lateGuest.running=true;lateGuest.nextPond=89;lateGuest.nextPeek=89;lateGuest.nextSpawn=1000;api.advance(lateGuest,.1);assert.strictEqual(lateGuest.visitors.length,0,'No truncated guest window is started near the deadline');
console.log('Pond scoring: diver/skater hits award 65/60 once; late partial visits are rejected OK');

var misses=api.create();assert(!api.shoot(misses,900,50));assert.strictEqual(misses.score,0);misses.running=true;
assert(!api.shoot(misses,900,50));assert.strictEqual(misses.score,-100);assert.strictEqual(misses.effects[0].points,-100);
misses.pausedAt=1;api.shoot(misses,900,50);assert.strictEqual(misses.score,-100);misses.pausedAt=null;api.reload(misses);api.shoot(misses,900,50);assert.strictEqual(misses.score,-100);
api.advance(misses,1.1);misses.ammo=1;api.shoot(misses,900,50);assert.strictEqual(misses.score,-200);api.shoot(misses,900,50);assert.strictEqual(misses.score,-200,'Empty/reloading shots cost no points');
assert.strictEqual(api.topFive([{id:'chicken-low',at:1,score:-300},{id:'chicken-high',at:2,score:-100}])[0].score,-100,'Negative scores rank numerically');
console.log('Miss penalty: minus 100 per fired miss, signed leaderboard, no charge before start/during pause/reload/empty ammo OK');
