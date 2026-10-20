'use strict';
var assert=require('node:assert/strict'),A=require('../arcade-extra.js');
function ctx(){return new Proxy({createLinearGradient:function(){return {addColorStop:function(){}};}},{get:function(o,k){return k in o?o[k]:function(){};}});}
var games={},losses=[],api=A.create({
 get:function(kind){return games[kind];},
 begin:function(kind){games[kind].awaitingStart=false;games[kind].running=true;return true;},
 advance:function(g,dt){if(!g.active||!g.running||g.pausedAt!=null)return 0;g.playTimeMs=(g.playTimeMs||0)+dt*1000;return dt;},
 lose:function(kind,reason){var g=games[kind];losses.push({kind:kind,reason:reason});g.attempts++;g.running=false;if(g.attempts>=3)g.active=false;else{api.definitions[kind].recover(g);g.awaitingStart=true;}}
});
function start(kind){
 var g=games[kind]={kind:kind,active:true,running:true,awaitingStart:false,attempts:0,score:0,elapsed:0,canvas:{width:480,height:640},ctx:ctx()};api.definitions[kind].init(g);return g;
}
assert.deepEqual(A.mergeLine([2,2,2,2]),{line:[4,4,0,0],score:8});
assert.deepEqual(A.mergeLine([2,2,4,0]),{line:[4,4,0,0],score:4});
assert.deepEqual(A.mergeLine([0,4,4,8]),{line:[8,8,0,0],score:8});
var grid=[2,2,4,4,0,0,0,0,0,0,0,0,0,0,0,0];
assert.deepEqual(A.slideBoard(grid,'left').board.slice(0,4),[4,8,0,0]);assert.equal(A.slideBoard(grid,'left').score,12);
assert.deepEqual(A.slideBoard(grid,'right').board.slice(0,4),[0,0,4,8]);
assert.deepEqual(A.slideBoard([2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0],'down').board,[0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0]);
var tiles=start('tiles');tiles.board=[2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];api.action('tiles','left',true);assert.equal(tiles.moves,0);assert.equal(tiles.board.filter(Boolean).length,1);
tiles.board=grid.slice();api.action('tiles','left',true);assert.equal(tiles.score,12);assert.equal(tiles.moves,1);assert.equal(tiles.board.filter(Boolean).length,3);api.update('tiles',.14);
tiles.board=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];tiles.score=880;api.update('tiles',.01);assert.equal(tiles.attempts,1);assert.equal(tiles.score,880);assert.equal(tiles.board.filter(Boolean).length,14);assert(tiles.board.includes(4));assert(A.canMove(tiles.board));
api.draw('tiles');
// Even at the highest difficulty every next platform is within the normal jump
// envelope, including the worst opposing positions of two moving platforms.
function checkDoodleChain(g){
 var ordered=g.platforms.slice().sort(function(a,b){return b.y-a.y;});
 for(var i=1;i<ordered.length;i++){
  var prev=ordered[i-1],next=ordered[i],rise=prev.y-next.y;
  assert(rise>=80&&rise<=106.01);
  var shift=Math.abs(next.baseX+next.w/2-prev.baseX-prev.w/2);
  assert(shift>=101.99&&shift<=136.01);
  var moving=(prev.type==='moving'?14:0)+(next.type==='moving'?14:0);
  var descendingTime=(510+Math.sqrt(510*510-2*1100*rise))/1100;
  assert(shift+moving<245*descendingTime+next.w/2+11,'next platform remains reachable');
 }
}
for(var route=0;route<80;route++){
 var easy=start('doodle');checkDoodleChain(easy);assert(easy.platforms.slice(1).every(function(p){return p.w>=66;}));
 easy.cameraY=-6000;easy.topY=-5800;easy.topX=240;easy.player.y=-5700;easy.player.vy=0;easy.platforms=[];api.update('doodle',.001);
 checkDoodleChain(easy);assert(easy.platforms.length>=3);assert(easy.platforms.every(function(p){return p.w===48;}));
}
var doodle=start('doodle');
doodle.platforms=[{x:190,y:300,w:90,type:'spring',baseX:190}];doodle.topY=-10000;doodle.player={x:230,y:265,vy:200};api.update('doodle',.01);assert.equal(doodle.player.vy,-760);assert.equal(doodle.player.y,266);
doodle.player.x=479;doodle.axis=1;api.update('doodle',.02);assert(doodle.player.x<10);
doodle.score=450;var before=doodle.height;doodle.player.y=doodle.cameraY+700;api.update('doodle',.01);assert.equal(doodle.attempts,1);assert(doodle.awaitingStart);assert(doodle.height>=before);assert(doodle.platforms.length>0);assert(doodle.player.y<doodle.cameraY+640);
api.draw('doodle');
// Broken platforms remain in the world, cannot support a landing/respawn,
// and return exactly four active seconds later, even across a retry or pause.
var crumbGame=start('doodle'),crumb={x:190,y:300,w:80,type:'crumb',baseX:190};
crumbGame.platforms=[crumb,{x:190,y:400,w:90,type:'normal',baseX:190}];crumbGame.topY=-10000;
crumbGame.player={x:230,y:265,vy:200};api.update('doodle',.01);
assert.equal(crumb.broken,true);assert.equal(crumb.respawnAt,crumbGame.elapsed+4);assert(crumbGame.platforms.includes(crumb));
var brokenAt=crumbGame.elapsed;crumbGame.elapsed=brokenAt+3.98;crumbGame.player={x:230,y:265,vy:200};api.update('doodle',.01);
assert.equal(crumb.broken,true);assert(crumbGame.player.vy>0,'broken platform is non-solid');
crumbGame.pausedAt=1;var frozen=crumbGame.elapsed;api.update('doodle',2);assert.equal(crumbGame.elapsed,frozen);assert.equal(crumb.broken,true);crumbGame.pausedAt=null;
api.definitions.doodle.recover(crumbGame);assert.equal(crumbGame.player.y,366,'respawn uses the intact lower platform');assert.equal(crumb.broken,true);
crumbGame.elapsed=brokenAt+4-.01;crumbGame.player={x:230,y:265,vy:200};api.update('doodle',.01);
assert.equal(crumbGame.player.vy,-510,'platform supports landing again at four seconds');
assert.equal(crumb.respawnAt,crumbGame.elapsed+4,'second break starts a new four-second cooldown');
crumbGame.elapsed=crumb.respawnAt;crumbGame.player={x:400,y:330,vy:0};api.update('doodle',.001);assert.equal(crumb.broken,false);assert.equal(crumb.respawnAt,null);api.draw('doodle');
// Every dot in generated labyrinths can be reached, including the wrap tunnel.
for(var sample=0;sample<12;sample++){
 var maze=start('maze'),queue=[19*19+1],seen=new Set(queue);
 for(var at=0;at<queue.length;at++){var id=queue[at],x=id%19,y=Math.floor(id/19);[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var xx=(x+d[0]+19)%19,yy=y+d[1],ii=yy*19+xx;if(yy>=0&&yy<21&&!maze.grid[ii]&&!seen.has(ii)){seen.add(ii);queue.push(ii);}});}
 assert.equal(seen.size,maze.grid.filter(function(v){return !v;}).length);assert.equal(maze.ghosts.length,4);assert(maze.ghosts.every(function(p){return seen.has(p.home);}));
}
var maze=start('maze');maze.ghosts.forEach(function(g){g.wait=999;});maze.player={x:1,y:1,dx:0,dy:0,t:0};maze.wanted={x:0,y:0};api.update('maze',.01);assert(maze.powerUntil>maze.elapsed);assert.equal(maze.score,50);
maze.ghosts[0]={x:1,y:1,dx:0,dy:0,t:0,home:9*19+9,wait:0};api.update('maze',.001);assert(maze.score>=250);assert.equal(maze.attempts,0);
maze.powerUntil=0;maze.grace=0;maze.ghosts[0]={x:1,y:1,dx:0,dy:0,t:0,home:9*19+9,wait:0};var pellets=maze.pellets.slice(),score=maze.score;api.update('maze',.001);assert.equal(maze.attempts,1);assert.equal(maze.score,score);assert.deepEqual(maze.pellets,pellets);api.draw('maze');
// Inertial ship wraps, fires without tiny controls, and rocks split instead of resetting a wave.
var asteroid=start('asteroid');asteroid.rocks=[{x:100,y:100,r:38,vx:0,vy:0,angle:0,spin:0,points:Array(10).fill(1)}];asteroid.shots=[{x:100,y:100,vx:0,vy:0,life:1}];api.update('asteroid',.001);assert.equal(asteroid.rocks.length,2);assert(asteroid.rocks.every(function(r){return r.r===22.8;}));assert.equal(asteroid.score,20);
asteroid.ship.x=479;asteroid.ship.vx=200;api.update('asteroid',.02);assert(asteroid.ship.x<10);
api.action('asteroid','up',true);var vy=asteroid.ship.vy;api.update('asteroid',.05);assert(asteroid.ship.vy<vy);api.action('asteroid','up',false);assert.equal(asteroid.keys.up,false);
asteroid.grace=0;asteroid.rocks=[{x:asteroid.ship.x,y:asteroid.ship.y,r:38,vx:0,vy:0,angle:0,spin:0,points:Array(10).fill(1)}];asteroid.shots=[];asteroid.shotIn=99;api.update('asteroid',.001);assert.equal(asteroid.attempts,1);assert.equal(asteroid.rocks.length,1);assert.equal(asteroid.score,20);assert(asteroid.grace>asteroid.elapsed);api.draw('asteroid');
// Finger aiming steers acceleration, never teleports or replaces momentum.
var touch=start('asteroid');touch.grace=999;touch.shotIn=99;
touch.rocks=[{x:30,y:30,r:8,vx:0,vy:0,angle:0,spin:0,points:Array(10).fill(1)}];
touch.ship={x:240,y:320,vx:160,vy:40,angle:0};touch.touchTarget={x:200,y:320};
api.update('asteroid',.05);
assert.equal(touch.ship.angle,Math.PI);assert(touch.ship.x>240,'momentum still carries ship past target');
assert(touch.ship.vx>0&&touch.ship.vx<160,'counter-thrust brakes rather than instantly reversing');
assert(touch.ship.vy>39,'perpendicular velocity persists');
touch.ship={x:240,y:320,vx:160,vy:0,angle:0};touch.touchTarget={x:260,y:320};
for(var i=0;i<4;i++)api.update('asteroid',.05);
assert(touch.ship.x>260);assert(touch.ship.vx>0);assert(Math.abs(touch.ship.angle)>3,'nose turns back after overshoot');
for(var i=0;i<20;i++)api.update('asteroid',.05);
assert(touch.ship.vx<0,'continued counter-thrust eventually reverses velocity');
touch.touchTarget=null;var vx=touch.ship.vx,x=touch.ship.x;
api.update('asteroid',.05);assert(Math.abs(touch.ship.vx-vx*Math.exp(-.12*.05))<1e-9);assert.notEqual(touch.ship.x,x);
touch.touchTarget={x:touch.ship.x,y:touch.ship.y};api.update('asteroid',.01);assert(Number.isFinite(touch.ship.vx)&&Number.isFinite(touch.ship.angle));
api.definitions.asteroid.recover(touch);assert.equal(touch.touchTarget,null);
touch.touchTarget={x:20,y:30};touch.canvas.height=300;api.resize('asteroid',640);assert.equal(touch.touchTarget,null);
A.kinds.forEach(function(kind){var g=start(kind);g.pausedAt=1;var before=JSON.stringify(g);api.update(kind,1);api.action(kind,'left',true);assert.equal(JSON.stringify(g),before);g.canvas.height=300;api.draw(kind);g.canvas.height=960;api.draw(kind);});
console.log('OK: canonical 2048 merges/no-op/spawn/rescue, reachable Doodle chain/bounce/wrap/recovery, connected maze/power/ghosts, inertial Asteroid split/wrap/respawn, pause and portrait/landscape rendering.');
