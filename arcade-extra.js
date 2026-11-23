/* Original Canvas implementations. No assets, dependencies or network. */
(function(global){
  'use strict';
  var KINDS=['doodle','tiles','maze','asteroid','golf','grab','pinball'];
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function delta(a,b,size){var d=a-b;return d>size/2?d-size:d<-size/2?d+size:d;}
  function mergeLine(values){
    var compact=values.filter(function(v){return v>0;}),line=[],score=0;
    for(var i=0;i<compact.length;i++){var v=compact[i];if(compact[i+1]===v){v*=2;score+=v;i++;}line.push(v);}
    while(line.length<4)line.push(0);return {line:line,score:score};
  }
  function slideBoard(board,action){
    var next=board.slice(),score=0,motions=[];
    for(var row=0;row<4;row++){
      var ids=[];for(var j=0;j<4;j++)ids.push(action==='left'?row*4+j:action==='right'?row*4+3-j:action==='up'?j*4+row:(3-j)*4+row);
      var values=ids.map(function(id){return board[id];}),merged=mergeLine(values);score+=merged.score;
      ids.forEach(function(id,j){next[id]=merged.line[j];});
      var target=0,previous=0,justMerged=false;
      ids.forEach(function(id){var value=board[id];if(!value)return;
        if(previous===value&&!justMerged){motions.push({from:id,to:ids[target-1],value:value});justMerged=true;previous=0;}
        else{motions.push({from:id,to:ids[target],value:value});target++;previous=value;justMerged=false;}
      });
    }
    return {board:next,score:score,motions:motions,changed:next.some(function(v,i){return v!==board[i];})};
  }
  function canMove(board){return board.some(function(v){return !v;})||['left','up'].some(function(a){return slideBoard(board,a).changed;});}
  function create(host){
    function viewHeight(s){return s.viewHeight||s.canvas.viewHeight||s.canvas.height;}
    function g(kind){return host.get(kind);}
    function begin(kind){var s=g(kind);return s&&s.active&&s.pausedAt==null&&(!s.awaitingStart||host.begin(kind));}
    function tick(s,dt){dt=host.advance(s,dt);if(dt)s.elapsed+=dt;return dt;}
    function text(ctx,value,x,y,size,color,align){ctx.fillStyle=color||'#fff';ctx.font='bold '+size+'px system-ui,sans-serif';ctx.textAlign=align||'center';ctx.fillText(value,x,y);}
    function round(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();}
    function sky(s,top,bottom){var c=s.ctx,h=viewHeight(s),gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);c.fillStyle=gradient;c.fillRect(0,0,480,h);if(host.decor)host.decor(c,480,h,s.elapsed,false);}
    function dot(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
    function path(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(function(p,i){if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);});c.closePath();c.fill();}
    function notice(s,value){s.notice={text:value,until:s.elapsed+2};}
    function banner(s){if(s.notice&&s.elapsed<s.notice.until)text(s.ctx,s.notice.text,240,32,15,'#fff4bb');}

    // DOODLE: reachable main chain, automatic bounce, scrolling world and wrap.
    function doodleGenerate(s){
      while(s.topY>s.cameraY-180){
        // Keep the next landing reachable, but require a deliberate sideways jump.
        // Only active time raises difficulty: full difficulty starts at 120 seconds.
        var difficulty=clamp(s.elapsed/120,0,1);
        s.topY-=70+difficulty*24+Math.random()*12;s.platformCount++;
        var shift=86+difficulty*16+Math.random()*(24+difficulty*10),direction=Math.random()<.5?-1:1;
        if(s.topX+shift*direction<46||s.topX+shift*direction>434)direction=-direction;
        s.topX+=shift*direction;
        var roll=Math.random(),type=s.platformCount>6&&roll<.045?'spring':s.platformCount>4&&roll<.22+difficulty*.16?'crumb':s.platformCount>3&&roll<.48+difficulty*.24?'moving':'normal';
        var width=84-difficulty*36;
        s.platforms.push({x:s.topX-width/2,y:s.topY,w:width,type:type,baseX:s.topX-width/2,phase:Math.random()*6,speed:1.8+difficulty,amplitude:14});
        if(s.platformCount%3===0)s.coins.push({x:s.topX,y:s.topY-35,taken:false});
      }
    }
    function initDoodle(s){
      var y=viewHeight(s)-80;s.cameraY=0;s.baseY=y;s.height=0;s.coinCount=0;s.topY=y;s.topX=240;s.platformCount=0;s.axis=0;s.pointerX=null;s.grace=0;
      s.player={x:240,y:y-34,vy:-510};s.platforms=[{x:160,y:y,w:160,type:'normal',baseX:160,phase:0}];s.coins=[];doodleGenerate(s);
    }
    function recoverDoodle(s){
      var bottom=s.cameraY+viewHeight(s)-55,candidates=s.platforms.filter(function(p){return !p.broken&&p.y<s.cameraY+viewHeight(s)-40&&p.y>s.cameraY+80;}).sort(function(a,b){return b.y-a.y;});
      var p=candidates[0];if(!p){p={x:170,y:bottom,w:140,type:'normal',baseX:170,phase:0};s.platforms.push(p);}
      s.player={x:p.x+p.w/2,y:p.y-34,vy:-510};s.axis=0;s.pointerX=null;s.grace=s.elapsed+1.5;
    }
    function updateDoodle(s,dt){
      dt=tick(s,dt);if(!dt)return;var p=s.player,old=p.y+34;
      if(s.pointerX!==null)p.x+=clamp(s.pointerX-p.x,-260*dt,260*dt);else p.x+=s.axis*245*dt;
      p.x=(p.x+480)%480;p.vy+=1100*dt;p.y+=p.vy*dt;
      s.platforms.forEach(function(platform){
        if(platform.broken){if(s.elapsed<platform.respawnAt)return;platform.broken=false;platform.respawnAt=null;}
        if(platform.type==='moving')platform.x=platform.baseX+Math.sin(s.elapsed*(platform.speed||1.8)+platform.phase)*(platform.amplitude||14);
        if(p.vy>0&&old<=platform.y&&p.y+34>=platform.y&&Math.abs(delta(p.x,platform.x+platform.w/2,480))<platform.w/2+11){
          p.y=platform.y-34;p.vy=platform.type==='spring'?-760:-510;platform.bounceAt=s.elapsed;
          if(platform.type==='crumb'){platform.broken=true;platform.respawnAt=s.elapsed+4;}if(platform.type==='spring')notice(s,'Boing!');}
      });
      s.height=Math.max(s.height,s.baseY-p.y-34);s.cameraY=Math.min(s.cameraY,p.y-viewHeight(s)*.42);
      s.coins.forEach(function(c){if(!c.taken&&Math.abs(delta(p.x,c.x,480))<23&&Math.abs(p.y+15-c.y)<28){c.taken=true;s.coinCount++;}});
      s.score=Math.floor(s.height/6)+s.coinCount*25;
      s.platforms=s.platforms.filter(function(a){return a.y<s.cameraY+viewHeight(s)+100;});s.coins=s.coins.filter(function(a){return !a.taken&&a.y<s.cameraY+viewHeight(s)+50;});doodleGenerate(s);
      if(p.y>s.cameraY+viewHeight(s)+30)host.lose('doodle','Daneben gesprungen');
    }
    function drawDoodle(s){
      var c=s.ctx,h=viewHeight(s);sky(s,'#685d96','#ead8b4');c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=1;
      for(var x=0;x<480;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
      for(var y=(-s.cameraY%24+24)%24;y<h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(480,y);c.stroke();}
      s.platforms.forEach(function(p){if(p.broken)return;var y=p.y-s.cameraY;if(y<-20||y>h)return;round(c,p.x,y,p.w,13,5,p.type==='crumb'?'#b28169':p.type==='moving'?'#64bfda':'#8ecd8b');round(c,p.x+3,y+2,p.w-6,3,1,'#e9f4bd');
        if(p.type==='spring'){c.strokeStyle='#f1ca7c';c.lineWidth=3;c.beginPath();c.moveTo(p.x+25,y);for(var k=0;k<5;k++)c.lineTo(p.x+25+(k%2?14:0),y-3-k*3);c.stroke();}if(p.type==='crumb'){c.strokeStyle='#644761';c.beginPath();c.moveTo(p.x+20,y);c.lineTo(p.x+27,y+7);c.lineTo(p.x+22,y+13);c.stroke();}});
      s.coins.forEach(function(p){dot(c,p.x,p.y-s.cameraY,8,'#ffd266');text(c,'★',p.x,p.y-s.cameraY+4,11,'#a36b35');});
      var p=s.player,y=p.y-s.cameraY,bob=s.running?Math.sin(s.elapsed*12)*2:0;
      [-480,0,480].forEach(function(offset){var x=p.x+offset;if(x<-30||x>510)return;c.save();c.translate(x,y);c.strokeStyle='#42334e';c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(-7,27);c.lineTo(-10,35);c.moveTo(7,27);c.lineTo(11,35);c.stroke();
        round(c,-17,2,34,29,12,'#b8d780');dot(c,-6,12,5,'#fff8de');dot(c,7,12,5,'#fff8de');dot(c,-5+s.axis,12,2,'#343749');dot(c,8+s.axis,12,2,'#343749');c.strokeStyle='#4b6047';c.lineWidth=2;c.beginPath();c.arc(1,19,5,0,Math.PI);c.stroke();var season=host.season?host.season():null;if(season==='halloween'){path(c,[[-20,4],[0,-18+bob],[16,4]],'#674979');round(c,-22,2,42,4,2,'#efa957');}else if(season==='christmas'){path(c,[[-18,3],[2,-17+bob],[21,-2]],'#cf4e63');round(c,-19,0,38,6,3,'#fff4df');dot(c,21,-2,5,'#fff4df');}c.restore();});
      text(c,Math.floor(s.height/10)+' m · '+s.coinCount+' Münzen',240,h-15,13,'#46384f');banner(s);
    }

    // 2048: one merge per original tile, no spawn on unchanged input.
    function addTile(s){var free=[];s.board.forEach(function(v,i){if(!v)free.push(i);});if(!free.length)return;s.spawn=free[Math.floor(Math.random()*free.length)];s.board[s.spawn]=Math.random()<.9?2:4;}
    function initTiles(s){s.board=Array(16).fill(0);s.moves=0;s.anim=0;s.pending=null;s.won=false;addTile(s);addTile(s);}
    function tilesAction(s,a){
      if(!begin('tiles')||['left','right','up','down'].indexOf(a)===-1)return;
      if(s.anim>0){s.pending=a;return;}
      var result=slideBoard(s.board,a);if(!result.changed){if(!canMove(s.board))host.lose('tiles','Kein Zug mehr möglich');return;}
      s.board=result.board;s.motions=result.motions;s.score+=result.score;s.moves++;s.anim=.13;addTile(s);
      if(!s.won&&s.board.some(function(n){return n>=2048;})){s.won=true;notice(s,'2048! Du kannst weiterspielen.');}
    }
    function updateTiles(s,dt){
      dt=tick(s,dt);if(!dt)return;s.anim=Math.max(0,s.anim-dt);
      if(!s.anim){if(!canMove(s.board)){host.lose('tiles','Kein Zug mehr möglich');return;}if(s.pending){var a=s.pending;s.pending=null;tilesAction(s,a);}}
    }
    function drawTiles(s){
      var c=s.ctx,h=viewHeight(s);sky(s,'#6c5684','#eacdb0');
      var size=Math.min(438,h-104),cell=size/4,gap=8,left=(480-size)/2,top=(h-size)/2+14;
      round(c,left-8,top-8,size+16,size+16,14,'#73647c');
      function tile(id,v,x,y,scale){
        var xx=left+x*cell,yy=top+y*cell,palette=['#f1e5d3','#e9d8ae','#f7b783','#f29b75','#ed806c','#e96865','#f3d181','#f0c164','#e8af54','#e59c47','#edcc67'],index=v?Math.min(10,Math.log2(v)-1):0;
        round(c,xx+gap/2,yy+gap/2,cell-gap,cell-gap,9,v?palette[index]:'#968698');
        if(v){text(c,String(v),xx+cell/2,yy+cell/2+cell*.12,Math.min(35,cell*(v>=1024?.28:.36)),v<=4?'#5a4b57':'#fffaf0');}
      }
      s.board.forEach(function(v,i){tile(i,0,i%4,Math.floor(i/4));});
      if(s.anim>0&&s.motions){var t=1-s.anim/.13;s.motions.forEach(function(m){tile(m.to,m.value,(m.from%4)*(1-t)+(m.to%4)*t,Math.floor(m.from/4)*(1-t)+Math.floor(m.to/4)*t);});}
      else s.board.forEach(function(v,i){if(v)tile(i,v,i%4,Math.floor(i/4));});
      text(c,'Gleiche Zahlen zusammenschieben',240,Math.max(60,top-24),16,'#fff3d2');text(c,s.moves+(s.moves===1?' Zug':' Züge')+' · Höchste Zahl: '+Math.max.apply(null,s.board),240,h-17,14,'#49364f');banner(s);
    }

    // MAZE: connected procedural corridors, power pellets and individual ghost routes.
    var MW=19,MH=21,DIRS=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
    function mazeGrid(){
      var grid=Array(MW*MH).fill(1),stack=[{x:1,y:1}];grid[MW+1]=0;
      while(stack.length){var p=stack[stack.length-1],choices=DIRS.filter(function(d){var x=p.x+d.x*2,y=p.y+d.y*2;return x>0&&x<MW-1&&y>0&&y<MH-1&&grid[y*MW+x];});if(!choices.length){stack.pop();continue;}var d=choices[Math.floor(Math.random()*choices.length)],q={x:p.x+d.x*2,y:p.y+d.y*2};grid[(p.y+d.y)*MW+p.x+d.x]=0;grid[q.y*MW+q.x]=0;stack.push(q);}
      for(var y=2;y<MH-2;y++)for(var x=2;x<MW-2;x++)if(grid[y*MW+x]&&((!grid[y*MW+x-1]&&!grid[y*MW+x+1])||(!grid[(y-1)*MW+x]&&!grid[(y+1)*MW+x]))&&Math.random()<.23)grid[y*MW+x]=0;
      for(var x=0;x<MW;x++)grid[11*MW+x]=0;return grid;
    }
    function mazeCell(s,x,y){x=(x+MW)%MW;return y<0||y>=MH?1:s.grid[y*MW+x];}
    function mazeDistances(s,tx,ty){
      var distances=Array(MW*MH).fill(9999),q=[{x:tx,y:ty}];distances[ty*MW+tx]=0;
      for(var at=0;at<q.length;at++){var p=q[at];DIRS.forEach(function(d){var x=(p.x+d.x+MW)%MW,y=p.y+d.y;if(!mazeCell(s,x,y)&&distances[y*MW+x]===9999){distances[y*MW+x]=distances[p.y*MW+p.x]+1;q.push({x:x,y:y});}});}return distances;
    }
    function newMaze(s){
      s.grid=mazeGrid();s.pellets=s.grid.map(function(w){return w?0:1;});[[1,1],[17,1],[1,19],[17,19]].forEach(function(p){s.pellets[p[1]*MW+p[0]]=2;});
      s.player={x:9,y:19,dx:0,dy:0,t:0};s.wanted={x:0,y:0};s.powerUntil=0;s.grace=s.elapsed+2;
      var distances=mazeDistances(s,9,19),cells=s.grid.map(function(v,i){return {i:i,d:distances[i]};}).filter(function(p){return p.d<9999&&p.d>9;}).sort(function(a,b){return b.d-a.d;});
      s.ghosts=[0,1,2,3].map(function(i){var p=cells[Math.min(cells.length-1,i*3)]||{i:9*MW+9};return {x:p.i%MW,y:Math.floor(p.i/MW),home:p.i,dx:0,dy:0,t:0,wait:s.elapsed+i*1.2};});
      s.pellets[19*MW+9]=0;
    }
    function initMaze(s){s.level=1;s.eaten=0;s.ghostChain=0;newMaze(s);}
    function recoverMaze(s){s.player={x:9,y:19,dx:0,dy:0,t:0};s.wanted={x:0,y:0};s.powerUntil=0;s.grace=s.elapsed+2;s.ghosts.forEach(function(p,i){p.x=p.home%MW;p.y=Math.floor(p.home/MW);p.t=0;p.dx=0;p.dy=0;p.wait=s.elapsed+1+i*.7;});}
    function mazePos(p){return {x:(p.x+p.dx*p.t+MW)%MW,y:p.y+p.dy*p.t};}
    function mazeMove(s,p,amount,choose){
      for(var left=amount;left>1e-8;){if(p.t===0)choose(p);if(!p.dx&&!p.dy)break;var step=Math.min(left,1-p.t);p.t+=step;left-=step;if(p.t>=1-1e-8){p.x=(p.x+p.dx+MW)%MW;p.y+=p.dy;p.t=0;}}
    }
    function updateMaze(s,dt){
      dt=tick(s,dt);if(!dt)return;
      mazeMove(s,s.player,dt*(5+Math.min(.8,s.level*.12)),function(p){
        if(!mazeCell(s,p.x+s.wanted.x,p.y+s.wanted.y)&&(s.wanted.x||s.wanted.y)){p.dx=s.wanted.x;p.dy=s.wanted.y;}
        if(mazeCell(s,p.x+p.dx,p.y+p.dy)){p.dx=0;p.dy=0;}
      });
      var p=s.player,index=p.y*MW+p.x;
      if(s.pellets[index]){var power=s.pellets[index]===2;s.pellets[index]=0;s.eaten++;s.score+=power?50:10;if(power){s.powerUntil=s.elapsed+8;s.ghostChain=0;notice(s,'Geister fangen!');}}
      var distances=mazeDistances(s,p.x,p.y),fright=s.elapsed<s.powerUntil;
      s.ghosts.forEach(function(ghost,i){
        if(s.elapsed<ghost.wait)return;
        mazeMove(s,ghost,dt*(fright?2.5:Math.min(4.8,3.3+s.level*.16)),function(q){
          var choices=DIRS.filter(function(d){return !mazeCell(s,q.x+d.x,q.y+d.y);}),forward=choices.filter(function(d){return d.x!==-q.dx||d.y!==-q.dy;});if(forward.length)choices=forward;
          choices.sort(function(a,b){var aa=distances[(q.y+a.y)*MW+(q.x+a.x+MW)%MW],bb=distances[(q.y+b.y)*MW+(q.x+b.x+MW)%MW];return fright?bb-aa:aa-bb;});
          var choice=choices[(i===2&&Math.random()<.35||Math.floor(s.elapsed/9)%3===2)&&choices.length>1?Math.floor(Math.random()*choices.length):0];if(choice){q.dx=choice.x;q.dy=choice.y;}
        });
      });
      var pos=mazePos(p);
      for(var i=0;i<s.ghosts.length;i++){var ghost=s.ghosts[i],q=mazePos(ghost);if(s.elapsed<ghost.wait||Math.hypot(delta(pos.x,q.x,MW),pos.y-q.y)>.65)continue;
        if(fright){s.ghostChain++;s.score+=200*Math.min(4,s.ghostChain);ghost.x=ghost.home%MW;ghost.y=Math.floor(ghost.home/MW);ghost.t=0;ghost.dx=0;ghost.dy=0;ghost.wait=s.elapsed+2;}
        else if(s.elapsed>=s.grace){host.lose('maze','Ein Geist hat dich erwischt');return;}
      }
      if(!s.pellets.some(function(v){return v>0;})){s.level++;s.score+=500;newMaze(s);notice(s,'Labyrinth '+s.level);}
    }
    function drawMaze(s){
      var c=s.ctx,h=viewHeight(s);sky(s,'#151d3c','#2d234b');var cell=Math.min(23,(h-70)/MH),left=(480-MW*cell)/2,top=(h-MH*cell)/2+10;
      s.grid.forEach(function(w,i){var x=left+i%MW*cell,y=top+Math.floor(i/MW)*cell;if(w){round(c,x+1,y+1,cell-2,cell-2,4,'#465da7');round(c,x+3,y+3,cell-6,Math.max(1,cell*.17),2,'#819ce0');}else if(s.pellets[i])dot(c,x+cell/2,y+cell/2,s.pellets[i]===2?cell*(.22+Math.sin(s.elapsed*6)*.04):2,'#ffe6ac');});
      function at(p,draw){var q=mazePos(p);[-MW,0,MW].forEach(function(wrap){var x=left+(q.x+wrap+.5)*cell;if(x<left-cell||x>left+MW*cell+cell)return;c.save();c.translate(x,top+(q.y+.5)*cell);draw();c.restore();});}
      at(s.player,function(){var mouth=.15+Math.abs(Math.sin(s.elapsed*10))*.4;c.rotate(Math.atan2(s.player.dy,s.player.dx));c.fillStyle='#ffdc60';c.beginPath();c.moveTo(0,0);c.arc(0,0,cell*.44,mouth,Math.PI*2-mouth);c.closePath();c.fill();});
      s.ghosts.forEach(function(p,i){at(p,function(){var r=cell*.43,fright=s.elapsed<s.powerUntil;c.fillStyle=fright?(s.powerUntil-s.elapsed<2&&Math.floor(s.elapsed*6)%2?'#ede7ce':'#496ec3'):['#ef7f8c','#8edbd4','#b39be6','#f6b97a'][i];c.beginPath();c.arc(0,-r*.1,r,Math.PI,0);c.lineTo(r,r);c.lineTo(r*.5,r*.6);c.lineTo(0,r);c.lineTo(-r*.5,r*.6);c.lineTo(-r,r);c.closePath();c.fill();dot(c,-r*.35,-r*.08,r*.25,'#fff');dot(c,r*.35,-r*.08,r*.25,'#fff');dot(c,-r*.35+p.dx,0,r*.12,'#26324d');dot(c,r*.35+p.dx,0,r*.12,'#26324d');});});
      text(c,'Labyrinth '+s.level+(s.elapsed<s.powerUntil?' · Kraft '+Math.ceil(s.powerUntil-s.elapsed)+' s':''),240,h-12,13,'#f9ddb4');banner(s);
    }

    // ASTEROIDS: wrapped inertial flight, auto fire, splitting rocks and safe respawn.
    function spawnRock(s,x,y,r,speed){
      var angle=Math.random()*Math.PI*2;s.rocks.push({x:x,y:y,r:r,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle:Math.random()*6,spin:(Math.random()-.5)*1.2,points:Array.from({length:10},function(){return .78+Math.random()*.22;})});
    }
    function asteroidWave(s){var h=viewHeight(s);for(var i=0;i<Math.min(10,3+s.wave);i++){var x=i%2?Math.random()*480:Math.random()<.5?15:465,y=i%2?Math.random()<.5?15:h-15:Math.random()*h;if(Math.hypot(delta(x,s.ship.x,480),delta(y,s.ship.y,h))<100)x=(x+240)%480;spawnRock(s,x,y,38,35+s.wave*5);}notice(s,'Welle '+s.wave);}
    function initAsteroid(s){s.wave=1;s.touchTarget=null;s.ship={x:240,y:viewHeight(s)/2,vx:0,vy:0,angle:-Math.PI/2};s.keys={left:false,right:false,up:false,fire:false};s.rocks=[];s.shots=[];s.sparks=[];s.shotIn=0;s.grace=2.5;asteroidWave(s);}
    function recoverAsteroid(s){
      var h=viewHeight(s),best={x:240,y:h/2,d:-1};for(var y=h*.2;y<h*.9;y+=h*.2)for(var x=80;x<450;x+=100){var d=Math.min.apply(null,s.rocks.map(function(r){return Math.hypot(delta(x,r.x,480),delta(y,r.y,h))-r.r;}).concat([999]));if(d>best.d)best={x:x,y:y,d:d};}
      s.touchTarget=null;s.ship={x:best.x,y:best.y,vx:0,vy:0,angle:-Math.PI/2};s.grace=s.elapsed+2.5;s.keys={left:false,right:false,up:false,fire:false};s.shots=[];
    }
    function updateAsteroid(s,dt){
      dt=tick(s,dt);if(!dt)return;var h=viewHeight(s),p=s.ship;
      if(s.touchTarget){var dx=s.touchTarget.x-p.x,dy=s.touchTarget.y-p.y;if(Math.hypot(dx,dy)>.5)p.angle=Math.atan2(dy,dx);}
      else p.angle+=((s.keys.right?1:0)-(s.keys.left?1:0))*3.6*dt;
      // Aim changes only the nose: thrust accelerates the existing velocity vector.
      if(s.touchTarget||s.keys.up){p.vx+=Math.cos(p.angle)*180*dt;p.vy+=Math.sin(p.angle)*180*dt;s.sparks.push({x:p.x-Math.cos(p.angle)*13,y:p.y-Math.sin(p.angle)*13,vx:-p.vx*.3,vy:-p.vy*.3,life:.25});}
      var speed=Math.hypot(p.vx,p.vy);if(speed>240){p.vx*=240/speed;p.vy*=240/speed;}p.vx*=Math.exp(-.12*dt);p.vy*=Math.exp(-.12*dt);p.x=(p.x+p.vx*dt+480)%480;p.y=(p.y+p.vy*dt+h)%h;
      s.shotIn-=dt;if(s.shotIn<=0){s.shotIn=s.keys.fire?.13:.25;s.shots.push({x:p.x+Math.cos(p.angle)*17,y:p.y+Math.sin(p.angle)*17,vx:Math.cos(p.angle)*440+p.vx,vy:Math.sin(p.angle)*440+p.vy,life:.95});}
      s.rocks.forEach(function(r){r.x=(r.x+r.vx*dt+480)%480;r.y=(r.y+r.vy*dt+h)%h;r.angle+=r.spin*dt;});
      s.shots.forEach(function(b){b.x=(b.x+b.vx*dt+480)%480;b.y=(b.y+b.vy*dt+h)%h;b.life-=dt;});
      for(var i=s.rocks.length-1;i>=0;i--){var r=s.rocks[i],shot=s.shots.find(function(b){return b.life>0&&Math.hypot(delta(b.x,r.x,480),delta(b.y,r.y,h))<r.r;});
        if(shot){shot.life=0;s.rocks.splice(i,1);s.score+=r.r>30?20:r.r>20?50:100;
          for(var j=0;j<8;j++){var angle=j*Math.PI/4;s.sparks.push({x:r.x,y:r.y,vx:Math.cos(angle)*65,vy:Math.sin(angle)*65,life:.45});}
          if(r.r>16){spawnRock(s,r.x,r.y,r.r*.6,Math.hypot(r.vx,r.vy)*1.25);spawnRock(s,r.x,r.y,r.r*.6,Math.hypot(r.vx,r.vy)*1.25);}
        }else if(s.elapsed>=s.grace&&Math.hypot(delta(p.x,r.x,480),delta(p.y,r.y,h))<r.r*.85+8){host.lose('asteroid','Asteroid getroffen');return;}
      }
      s.shots=s.shots.filter(function(b){return b.life>0;});s.sparks.forEach(function(b){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;});s.sparks=s.sparks.filter(function(b){return b.life>0;}).slice(-80);
      if(!s.rocks.length){s.wave++;asteroidWave(s);}
    }
    function drawAsteroid(s){
      var c=s.ctx,h=viewHeight(s);sky(s,'#111a36','#30203e');for(var i=0;i<80;i++)dot(c,(i*137+19)%480,(i*193+47)%h,i%8===0?1.8:.8,i%3?'#a5c2d8':'#f0d39c');
      s.rocks.forEach(function(r){[-480,0,480].forEach(function(xx){[-h,0,h].forEach(function(yy){var x=r.x+xx,y=r.y+yy;if(x+r.r<0||x-r.r>480||y+r.r<0||y-r.r>h)return;c.save();c.translate(x,y);c.rotate(r.angle);var points=r.points.map(function(v,i){var a=i/10*Math.PI*2;return [Math.cos(a)*r.r*v,Math.sin(a)*r.r*v];});path(c,points,'#695b73');c.strokeStyle='#ba94a1';c.lineWidth=2;c.stroke();dot(c,-r.r*.25,-r.r*.17,r.r*.17,'#4a415c');dot(c,r.r*.3,r.r*.26,r.r*.13,'#50445e');c.restore();});});});
      s.shots.forEach(function(b){dot(c,b.x,b.y,3,'#ffe6a0');});s.sparks.forEach(function(b){c.globalAlpha=Math.max(0,b.life/.45);dot(c,b.x,b.y,2,'#f2b76b');});c.globalAlpha=1;
      if(s.touchTarget){c.strokeStyle='rgba(144,226,229,.65)';c.lineWidth=1.5;c.beginPath();c.arc(s.touchTarget.x,s.touchTarget.y,12,0,Math.PI*2);c.stroke();dot(c,s.touchTarget.x,s.touchTarget.y,2,'#b7eee8');}
      var p=s.ship;c.save();c.translate(p.x,p.y);c.rotate(p.angle);if(s.touchTarget||s.keys.up)path(c,[[-12,-6],[-25-Math.sin(s.elapsed*35)*6,0],[-12,6]],'#f3aa65');path(c,[[17,0],[-12,-11],[-7,0],[-12,11]],'#c0ece8');c.strokeStyle='#688ba8';c.lineWidth=2;c.stroke();dot(c,2,0,3,'#8d82be');if(s.elapsed<s.grace){c.strokeStyle='#76d6dc';c.lineWidth=1.5;c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.stroke();}c.restore();
      text(c,'Welle '+s.wave+' · Automatisches Feuer',240,h-15,13,'#d5d6e7');banner(s);
    }
    // The three tabletop games share a fixed 480 × 640 world.
    function line(c,x,y,xx,yy,width,color){
      c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';
      c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();
    }
    function wallBounce(ball,x,y,xx,yy,radius,restitution){
      var dx=xx-x,dy=yy-y;
      var t=clamp(((ball.x-x)*dx+(ball.y-y)*dy)/(dx*dx+dy*dy||1),0,1);
      var nx=ball.x-x-t*dx,ny=ball.y-y-t*dy,d=Math.hypot(nx,ny);
      if(d>=radius)return false;
      if(d<.0001){nx=0;ny=-1;}else{nx/=d;ny/=d;}
      ball.x+=nx*(radius-d);ball.y+=ny*(radius-d);
      var speed=ball.vx*nx+ball.vy*ny;
      if(speed>=0)return false;
      ball.vx-=(1+restitution)*speed*nx;ball.vy-=(1+restitution)*speed*ny;return true;
    }
    function sideRails(b,margin,top){
      if(b.x<margin){b.x=margin;b.vx=Math.abs(b.vx)*.84;}
      if(b.x>480-margin){b.x=480-margin;b.vx=-Math.abs(b.vx)*.84;}
      if(b.y<top){b.y=top;b.vy=Math.abs(b.vy)*.84;}
    }

    // The same outlines and obstacles drive ball collisions and course artwork.
    var courses=[
      {name:'Mühlenhof',tee:[205,520],cup:[345,150],outline:[[80,560],[52,480],[62,330],[122,275],[95,180],[160,102],[369,102],[427,164],[420,262],[323,306],[356,492],[310,560]],rails:[[126,314,192,317],[278,306,324,301]],mill:[236,307],sand:[296,405]},
      {name:'Die Sprungschanze',tee:[236,518],cup:[242,146],outline:[[135,567],[92,484],[132,338],[86,265],[124,119],[231,94],[371,130],[391,242],[340,347],[384,483],[324,567]],rails:[],jump:[236,363],bar:[119,307,356,307],sand:[329,475]},
      {name:'Burg Falkenstein',tee:[114,507],cup:[336,152],outline:[[52,558],[48,295],[165,263],[165,126],[402,101],[431,310],[298,336],[308,537],[203,574]],rails:[[173,272,246,273],[297,299,415,277]],tunnel:[[110,335],[327,229]],sand:[204,474]},
      {name:'Die Steilkurve',tee:[110,521],cup:[359,503],outline:[[50,566],[43,237],[73,149],[148,99],[333,98],[406,152],[438,233],[429,563],[303,565],[306,265],[270,216],[202,214],[160,260],[172,565]],rails:[],sand:[350,322]},
      {name:'Glockenspiel',tee:[240,522],cup:[234,143],outline:[[151,564],[60,449],[95,334],[56,231],[135,114],[337,110],[426,223],[380,345],[419,449],[320,564]],rails:[],pins:[[170,264],[305,264],[240,341],[156,418],[322,418]],sand:[104,337]},
      {name:'Der Brückensteg',tee:[130,524],cup:[330,159],outline:[[52,562],[50,390],[168,355],[170,284],[61,258],[73,142],[166,98],[370,104],[423,174],[401,253],[276,286],[275,355],[417,399],[421,535],[331,570]],rails:[[86,437,167,419],[282,208,360,227]],bridge:true,sand:[315,467]}
    ];
    function golfCourse(s){
      var course=courses[(s.hole-1)%courses.length];
      s.ball={x:course.tee[0],y:course.tee[1],vx:0,vy:0};
      s.strokes=0;s.power=360;s.aim=Math.atan2(course.cup[1]-s.ball.y,course.cup[0]-s.ball.x);
      s.drag=null;s.rolling=false;s.air=0;s.portalLock=false;
    }
    function millBar(s,m){
      var dx=46*Math.cos(s.elapsed*1.8),dy=46*Math.sin(s.elapsed*1.8);
      return [m[0]-dx,m[1]-dy,m[0]+dx,m[1]+dy];
    }
    function golfShot(s){
      if(s.rolling||!begin('golf'))return;
      s.ball.vx=Math.cos(s.aim)*s.power;s.ball.vy=Math.sin(s.aim)*s.power;
      s.rolling=true;s.strokes++;s.drag=null;
    }
    function golfAction(s,a){
      if(s.rolling)return;
      if(a==='fire')golfShot(s);
      if(a==='left'||a==='right')s.aim+=(a==='left'?-1:1)*Math.PI/36;
      if(a==='up'||a==='down')s.power=clamp(s.power+(a==='up'?45:-45),80,720);
    }
    function golfPointer(s,phase,p){
      if(s.rolling)return;
      if(phase==='down'){s.drag=p;return;}
      if(!s.drag)return;
      if(phase==='cancel'){s.drag=null;return;}
      var dx=s.drag.x-p.x,dy=s.drag.y-p.y,d=Math.hypot(dx,dy);
      if(d>=5){s.aim=Math.atan2(dy,dx);s.power=clamp(d*5,80,720);}
      if(phase==='up'){s.drag=null;if(d>=5)golfShot(s);}
    }
    function updateGolf(s,dt){
      dt=tick(s,dt);if(!dt||!s.rolling)return;
      var course=courses[(s.hole-1)%courses.length],b=s.ball;
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      course.outline.forEach(function(p,i,points){
        var q=points[(i+1)%points.length];wallBounce(b,p[0],p[1],q[0],q[1],9,.84);
      });
      function collide(r){wallBounce(b,r[0],r[1],r[2],r[3],11,.85);}
      course.rails.forEach(collide);
      if(course.mill){
        var arm=millBar(s,course.mill),mx=course.mill[0],my=course.mill[1];
        collide(arm);collide([mx+my-arm[1],my+arm[0]-mx,mx+my-arm[3],my+arm[2]-mx]);
      }
      if(course.pins)course.pins.forEach(function(p){wallBounce(b,p[0],p[1],p[0],p[1],22,.92);});
      s.air=Math.max(0,s.air-dt);
      if(course.jump&&Math.abs(b.x-course.jump[0])<34&&Math.abs(b.y-course.jump[1])<15&&b.vy<-150)s.air=.52;
      if(course.bar&&!s.air)collide(course.bar);
      if(course.tunnel){
        var inlet=course.tunnel[0],out=course.tunnel[1];
        if(!s.portalLock&&Math.hypot(b.x-inlet[0],b.y-inlet[1])<20){
          b.x=out[0];b.y=out[1]-8;b.vx=12;b.vy=-135;s.portalLock=true;notice(s,'Burgtunnel!');
        }else if(s.portalLock&&Math.hypot(b.x-out[0],b.y-out[1])>40)s.portalLock=false;
      }
      var sand=Math.hypot((b.x-course.sand[0])/57,(b.y-course.sand[1])/37)<1;
      var speed=Math.hypot(b.vx,b.vy),factor=Math.max(0,1-(sand?550:190)*dt/(speed||1));
      b.vx*=factor;b.vy*=factor;
      if(Math.hypot(b.x-course.cup[0],b.y-course.cup[1])<15&&speed<310){
        s.score+=Math.max(25,175-25*s.strokes);s.hole++;golfCourse(s);notice(s,'Eingelocht!');return;
      }
      if(speed*factor<6){
        b.vx=b.vy=0;s.rolling=false;
        if(s.strokes>=6)host.lose('golf','Sechs Schläge gespielt');
      }
    }
    function drawGolf(s){
      var c=s.ctx,course=courses[(s.hole-1)%courses.length],b=s.ball;
      sky(s,'#143835','#214b42');
      // Tree crowns, stone edging and fairway stripes are anchored to the landscape.
      for(var i=0;i<68;i++){
        var tx=(i*163+21)%480,ty=80+(i*137)%510;
        dot(c,tx+3,ty+5,13+i%9,'#173d34');dot(c,tx,ty,12+i%9,i%2?'#306a52':'#42755a');
        dot(c,tx-4,ty-5,6+i%6,'#548164');
      }
      path(c,course.outline,'#81bf80');c.strokeStyle='#e2ca98';c.lineWidth=10;c.lineJoin='round';c.stroke();
      c.save();c.clip();for(var k=-560;k<500;k+=66)path(c,[[k,90],[k+32,90],[k+480,575],[k+448,575]],'#88c686');
      c.save();c.translate(course.sand[0],course.sand[1]);c.scale(1,.64);dot(c,0,0,49,'#bfad70');dot(c,0,-3,46,'#ead593');
      for(var j=0;j<42;j++){var ang=j*2.4,rad=Math.sqrt(j)*6;dot(c,Math.cos(ang)*rad,Math.sin(ang)*rad,1.4,'#cfb879');}c.restore();c.restore();
      function rail(r){line(c,r[0],r[1]+4,r[2],r[3]+4,11,'#536a4c');line(c,r[0],r[1],r[2],r[3],9,'#e7dcc0');}
      course.rails.forEach(rail);
      if(course.mill){
        var m=course.mill;
        path(c,[[m[0]-19,m[1]+15],[m[0]-12,m[1]-35],[m[0]+12,m[1]-35],[m[0]+19,m[1]+15]],'#f1cc96');
        path(c,[[m[0]-22,m[1]-29],[m[0],m[1]-54],[m[0]+22,m[1]-29]],'#9e5046');
        c.save();c.translate(m[0],m[1]);c.rotate(s.elapsed*1.8);
        for(var sail=0;sail<4;sail++){
          line(c,0,0,46,0,3,'#855e43');path(c,[[13,0],[44,0],[41,-8],[16,-7]],'#ffedb7');
          for(var slat=20;slat<=39;slat+=6)line(c,slat,-6,slat,0,1,'#b68b59');
          c.rotate(Math.PI/2);
        }
        dot(c,0,0,6,'#86523a');c.restore();
      }
      if(course.jump){
        var jx=course.jump[0],jy=course.jump[1];path(c,[[jx-35,jy+25],[jx+35,jy+25],[jx+28,jy-17],[jx-28,jy-17]],'#cb905d');
        for(var n=0;n<4;n++)line(c,jx-21,jy+17-n*8,jx+21,jy+17-n*8,3,'#f5d596');
        rail(course.bar);text(c,'↑',jx,jy+8,23,'#fff');
      }
      if(course.tunnel)course.tunnel.forEach(function(p){
        round(c,p[0]-29,p[1]-28,58,40,5,'#827e80');dot(c,p[0],p[1],18,'#26373a');
        for(var i=0;i<4;i++)round(c,p[0]-30+i*16,p[1]-37,12,14,2,'#c9bdb0');
      });
      if(course.bridge)for(var plank=0;plank<9;plank++)line(c,173,279+plank*10,272,279+plank*10,9,plank%2?'#ba895f':'#ce9e6e');
      if(course.pins)course.pins.forEach(function(p){dot(c,p[0]+2,p[1]+3,16,'#587957');dot(c,p[0],p[1],14,'#a77238');dot(c,p[0]-2,p[1]-3,10,'#f1c962');dot(c,p[0]-4,p[1]-6,4,'#fff1ad');});
      var x=course.cup[0],y=course.cup[1];dot(c,x,y,14,'#284b3b');
      line(c,x,y,x,y-47,3,'#fff8db');path(c,[[x,y-47],[x+27,y-39],[x,y-32]],'#df574e');
      if(!s.rolling){
        var reach=s.power/6;
        line(c,b.x,b.y,b.x+Math.cos(s.aim)*reach,b.y+Math.sin(s.aim)*reach,3,'#fffbce');
      }
      dot(c,b.x+2,b.y+3,8,'#547d59');dot(c,b.x,b.y-(s.air?12*Math.sin(Math.PI*s.air/.52):0),8,'#fffdf3');
      text(c,course.name,240,53,25,'#fff2cc');
      text(c,'Bahn '+s.hole+' · Schlag '+Math.min(6,s.strokes+1)+'/6 · Kraft '+Math.round(s.power/720*100)+' %',240,612,17,'#e0edce');banner(s);
    }

    var catchTypes={
      fish:{value:35,r:19,weight:225},goldfish:{value:70,r:15,weight:255},
      pearl:{value:30,r:14,weight:275},chest:{value:100,r:20,weight:137},
      boot:{value:-35,r:18,weight:180},can:{value:-20,r:13,weight:235},
      crown:{value:200,r:18,weight:145}
    };
    function fillSeabed(s){
      s.treasures=['fish','goldfish','fish','pearl','boot','chest','can','pearl'].map(function(type,i){
        var swimmer=i<3, x=swimmer?90+115*i:55+(i-3)*92;
        return {type:type,x:x,y:swimmer?220+i*73:440+i%3*24,home:x,depth:swimmer?220+i*73:440+i%3*24,
          seed:i*1.7,r:catchTypes[type].r,readyAt:0,facing:1};
      });
      s.crab={x:240,y:550,readyAt:0};s.delivered=0;
    }
    function resetHook(s){s.phase='swing';s.length=52;s.cargo=null;}
    function hookTip(s){return {x:240+Math.sin(s.angle)*s.length,y:89+(s.cargo?6:0)+Math.cos(s.angle)*s.length};}
    function updateGrab(s,dt){
      dt=tick(s,dt);if(!dt)return;
      var now=s.elapsed;
      s.treasures.forEach(function(t){
        if(t.type==='fish'||t.type==='goldfish'){
          var a=now*(t.type==='goldfish'?.69:.4)+t.seed;
          t.x=240+187*Math.sin(a);t.y=t.depth+14*Math.sin(now*1.6+t.seed);t.facing=Math.cos(a)>=0?1:-1;
        }
      });
      s.crab.x=240+174*Math.sin(now*.36);
      if(s.phase==='swing'){s.angle=Math.sin(now*1.46)*1.07;return;}
      if(s.phase==='out'){
        s.length+=365*dt;var p=hookTip(s);
        var target=s.treasures.find(function(t){return t.readyAt<=now&&Math.hypot(t.x-p.x,t.y-p.y)<t.r+8;});
        if(target){s.cargo=target;target.readyAt=Infinity;}
        else if(now>=s.crab.readyAt&&Math.hypot(p.x-s.crab.x,p.y-(s.crab.y-26))<26){
          s.cargo={type:'crown'};s.crab.readyAt=now+13;
        }
        if(s.cargo||p.y>568||p.x<14||p.x>466)s.phase='in';
      }else{
        s.length-=dt*(s.cargo?catchTypes[s.cargo.type].weight:440);
        if(s.length<=52){
          var cargo=s.cargo;resetHook(s);if(!cargo)return;
          var value=catchTypes[cargo.type].value;s.score+=value;
          cargo.readyAt=now+3.5;
          if(cargo.type!=='crown'&&cargo.type!=='fish'&&cargo.type!=='goldfish')cargo.x=clamp(cargo.home+Math.sin(now)*33,32,448);
          if(value>0)s.delivered++;
          notice(s,(value>0?'+':'')+value+' Punkte');
        }
      }
    }
    function oval(c,x,y,rx,ry,color){
      c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
    }
    function reefCatch(c,type,x,y,facing,time){
      c.save();c.translate(x,y);
      if(type==='fish'||type==='goldfish'){
        c.scale(facing||1,1);var gold=type==='goldfish',fin=gold?'#e47138':'#e9a661';
        path(c,[[-12,0],[-30,-12+Math.sin(time*8)*3],[-27,12]],fin);
        path(c,[[-8,-6],[1,-19],[9,-8]],fin);
        oval(c,0,0,gold?16:22,11,gold?'#ffba53':'#67cfc1');oval(c,2,4,13,5,gold?'#ffdd87':'#c9ead2');
        for(var stripe=0;stripe<3;stripe++)line(c,-12+stripe*5,-6,-10+stripe*5,0,1.7,gold?'#d98b45':'#489d9b');
        path(c,[[-4,-2],[0,8],[-11,4]],fin);dot(c,10,-3,4,'#fffae5');dot(c,11,-3,2,'#26394a');
      }else if(type==='boot'){
        path(c,[[-12,-19],[4,-17],[2,1],[17,6],[17,13],[-17,13]],'#986e4e');line(c,-16,13,17,13,5,'#443f3a');line(c,-12,-17,4,-16,5,'#d7a877');
      }else if(type==='can'){
        c.rotate(.32);round(c,-10,-15,20,30,4,'#a8bec0');round(c,-10,-7,20,13,2,'#bc6457');oval(c,0,-14,10,4,'#d5dfd4');oval(c,2,-14,5,1.6,'#46646b');
      }else if(type==='pearl'){
        path(c,[[-16,3],[-11,-7],[-3,-2],[3,-10],[13,-5],[17,3],[5,12],[-6,12]],'#ca90aa');
        oval(c,0,4,14,5,'#f1c9ca');dot(c,0,0,8,'#fff1df');dot(c,-2,-3,2,'#fff');
      }else{
        if(type==='crown'){c.shadowColor='#ffc550';c.shadowBlur=10;}
        round(c,-17,-12,34,24,5,'#9d5336');round(c,-17,-10,34,8,3,'#da9153');
        [-10,9].forEach(function(px){line(c,px,-11,px,10,4,'#f3cd67');});
        round(c,-3,-3,7,8,2,'#fff09c');if(type==='crown')dot(c,1,-7,5,'#7ae3d5');
      }
      c.restore();
    }
    function drawGrab(s){
      var c=s.ctx,p=hookTip(s),time=s.elapsed;sky(s,'#67cbbf','#103956');
      // Sunlit shallows fade into blue silhouettes and a warmer foreground reef.
      for(var i=0;i<5;i++){
        var rx=i*132-95+Math.sin(time*.22+i)*12;
        path(c,[[rx,82],[rx+37,82],[rx+137,445],[rx+60,445]],'rgba(216,255,210,.08)');
      }
      for(var layer=0;layer<2;layer++){
        var edge=[[0,640]];
        for(var x=0;x<=480;x+=12)edge.push([x,523+layer*54+Math.sin(x*.018+layer)*16+Math.sin(x*.052)*5]);
        edge.push([480,640]);path(c,edge,layer?'#bc9972':'#327476');
      }
      for(var i=0;i<25;i++){
        var x=(i*77)%482,y=570+Math.sin(x*.018+1)*16;
        for(var j=0;j<3;j++){
          var h=13+(i*11+j*13)%31,w=Math.sin(time*.9+i+j)*4;
          c.strokeStyle=i%3===0?'#d98272':'#478b79';c.lineWidth=i%3===0?5:3;c.lineCap='round';
          c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+j*4-6,y-h*.5,x+j*5-5+w,y-h);c.stroke();
        }
      }
      for(var i=0;i<22;i++){
        var y=530-(time*(8+i%4)+i*73)%415;var x=(i*97+5*Math.sin(time*.8+i)+480)%480;
        c.strokeStyle='rgba(188,241,225,.39)';c.lineWidth=1.2;c.beginPath();c.arc(x,y,2+i%4,0,7);c.stroke();
      }
      // A sunken hull and sea fans give the middle distance its own silhouette.
      c.save();c.translate(84,512);c.rotate(-.22);
      path(c,[[-52,-5],[38,-8],[29,5],[-28,11]],'#376268');
      for(var rib=0;rib<5;rib++)line(c,-32+rib*13,3,-38+rib*14,-12-rib%2*8,4,'#477176');
      line(c,-4,1,-6,-54,4,'#436c71');line(c,-6,-46,30,-4,1,'#68908f');c.restore();
      for(var i=0;i<16;i++){
        var px=(i*101+11)%480,py=581+Math.sin(px*.018+1)*15+i%3*4;
        oval(c,px,py,5+i%5,2+i%3,'#947d65');
      }
      // A wooden fishing skiff, brass reel and bent rod share the line's anchor.
      var air=c.createLinearGradient(0,0,0,91);air.addColorStop(0,'#95d8dc');air.addColorStop(1,'#f8deb0');
      c.fillStyle=air;c.fillRect(0,0,480,88);dot(c,369,31,18,'#ffe8a7');
      path(c,[[0,84],[40,63],[72,70],[123,44],[192,83],[280,87],[360,66],[415,74],[480,48],[480,91],[0,91]],'#79a99e');
      line(c,0,89,480,89,5,'#c0ead5');
      path(c,[[24,64],[191,63],[171,86],[65,89],[40,80]],'#8b5142');line(c,27,64,187,64,6,'#ebc897');
      round(c,66,40,46,22,4,'#ab7250');round(c,72,45,14,10,2,'#77b9b9');round(c,91,45,14,10,2,'#77b9b9');
      c.strokeStyle='#404f50';c.lineWidth=4;c.beginPath();c.moveTo(138,65);c.quadraticCurveTo(213,s.cargo?13:0,240,s.cargo?95:89);c.stroke();
      line(c,135,68,154,52,6,'#bb8556');line(c,138,65,151,54,2,'#f3d3a1');
      dot(c,147,61,9,'#514b44');dot(c,147,61,6,'#dbac68');dot(c,147,61,2,'#fff0bc');
      line(c,240,s.cargo?95:89,p.x,p.y,2,'#c4e4d4');
      c.save();c.translate(p.x,p.y);c.rotate(-s.angle*.65);line(c,0,-3,0,10,3,'#e9d4a4');
      c.strokeStyle='#f0e1be';c.lineWidth=3;c.beginPath();c.arc(-5,10,5,0,Math.PI);c.stroke();path(c,[[-12,9],[-9,3],[-7,10]],'#fff0ce');c.restore();
      s.treasures.forEach(function(t){if(t.readyAt<=time)reefCatch(c,t.type,t.x,t.y,t.facing,time);});
      var cx=s.crab.x,cy=s.crab.y;
      for(var i=0;i<3;i++)[-1,1].forEach(function(dir){
        var foot=cy+8+Math.sin(time*7+i)*4;
        line(c,cx+dir*10,cy+2,cx+dir*(19+i*4),foot,3,'#e57850');
      });
      oval(c,cx,cy,18,10,'#e48050');[-1,1].forEach(function(dir){dot(c,cx+dir*22,cy-6,6,'#ef9161');dot(c,cx+dir*7,cy-9,3,'#443e39');});
      if(time>=s.crab.readyAt)reefCatch(c,'crown',cx,cy-25,1,time);
      if(s.cargo)reefCatch(c,s.cargo.type,p.x,p.y+12,1,time);
      text(c,'Schatzkrabbe +200   ·   Müll kostet Punkte',240,611,16,'#352f2e');banner(s);
    }
    // Orbital Express: continuous world coordinates, three decks, two-way scrolling.
    var pinHeight=1510, pinDrain=1470;
    var decks=[{y:1350,x:106,len:124},{y:824,x:79,len:108},{y:402,x:92,len:89}];
    var pinBumpers=[[140,1046],[333,1030],[234,951],[128,620],[348,597],[241,540],[179,227],[319,195]];
    var pinRails=[[24,1203,106,1350],[456,1203,374,1350],[24,740,79,824],[456,740,401,824],
      [24,333,92,402],[456,333,388,402],[88,1132,130,1195],[392,1132,350,1195]];
    var pinRoutes=[
      {name:'Startrampe',color:'#53dfce',points:[[127,1240],[18,1040],[38,732],[146,698]],time:.92,exit:[195,-340],pointsWon:90},
      {name:'Ionenröhre',color:'#9e92ff',points:[[371,924],[461,761],[464,379],[327,289]],time:1.12,exit:[-245,-230],pointsWon:140},
      {name:'Sonnenorbit',color:'#fbbd60',points:[[104,487],[22,279],[42,68],[239,113]],time:.98,exit:[272,115],pointsWon:160},
      {name:'Hyperraum',color:'#fa8cad',points:[[232,170],[464,109],[450,491],[319,696]],time:1.25,exit:[-240,220],pointsWon:250}
    ];
    function ridePoint(route,t){
      var p=route.points,u=1-t;
      return [0,1].map(function(i){return u*u*u*p[0][i]+3*u*u*t*p[1][i]+3*u*t*t*p[2][i]+t*t*t*p[3][i];});
    }
    function startRide(s,index,launch){
      s.ride={index:index,t:0};
      if(!launch){
        var route=pinRoutes[index];s.score+=route.pointsWon;
        notice(s,route.name+' +'+route.pointsWon);if(index===3)s.lamps.fill(false);
      }
    }
    function servePin(s){
      s.ball={x:127,y:1240,vx:0,vy:0};s.flips={left:0,right:0};s.camera=Math.max(0,pinHeight-viewHeight(s));
      s.trail=[];s.safeUntil=s.elapsed+6;startRide(s,0,true);
    }
    function paddle(s,side,deck){
      var left=side==='left',x=left?deck.x:480-deck.x;
      var timer=s.flips[side],lift=Math.min(1,(.2-timer)/.048,timer/.105);
      var angle=.37-.91*lift;
      return [x,deck.y,x+(left?1:-1)*deck.len*Math.cos(angle),deck.y+deck.len*Math.sin(angle)];
    }
    function movePinCamera(s,dt){
      var height=viewHeight(s),bottom=pinHeight-height,target=clamp(s.ball.y-height*.55,0,bottom);
      s.camera+=(target-s.camera)*(1-Math.exp(-12*dt));
      s.camera=clamp(s.camera,s.ball.y-height*.87,s.ball.y-height*.12);
      s.camera=clamp(s.camera,0,bottom);
      s.trail.push([s.ball.x,s.ball.y]);if(s.trail.length>9)s.trail.shift();
    }
    function updatePin(s,dt){
      dt=tick(s,dt);if(!dt)return;
      var b=s.ball;
      if(s.ride){
        var route=pinRoutes[s.ride.index];s.ride.t=Math.min(1,s.ride.t+dt/route.time);
        var pos=ridePoint(route,s.ride.t);b.x=pos[0];b.y=pos[1];
        if(s.ride.t>=1){s.ride=null;b.vx=route.exit[0];b.vy=route.exit[1];}
      }else{
        b.vy+=650*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;sideRails(b,28,64);
        for(var i=0;i<pinRoutes.length;i++){
          var entry=pinRoutes[i].points[0];
          if(b.vy<-45&&Math.hypot(b.x-entry[0],b.y-entry[1])<28&&(i!==3||s.lamps.every(Boolean))){
            startRide(s,i,false);break;
          }
        }
        if(!s.ride){
          pinBumpers.forEach(function(p,i){
            if(wallBounce(b,p[0],p[1],p[0],p[1],32,1)){
              b.vx+=(b.x-p[0])*5;b.vy+=(b.y-p[1])*5;s.score+=20;s.lamps[i%3]=true;s.flash[i]=s.elapsed+.24;
            }
          });
          pinRails.forEach(function(r){wallBounce(b,r[0],r[1],r[2],r[3],15,.86);});
          decks.forEach(function(deck){
            ['left','right'].forEach(function(side){
              var r=paddle(s,side,deck);
              if(wallBounce(b,r[0],r[1],r[2],r[3],18,.78)&&s.flips[side]>.08&&b.y<Math.max(r[1],r[3])){
                var tip=clamp(Math.abs(b.x-r[0])/deck.len,0,1);
                b.vy=-935-115*tip;b.vx=(side==='left'?1:-1)*(270-430*tip);
              }
            });
          });
          var speed=Math.hypot(b.vx,b.vy);if(speed>1150){b.vx*=1150/speed;b.vy*=1150/speed;}
          if(b.y>pinDrain){
            if(s.elapsed<s.safeUntil){var until=s.safeUntil;servePin(s);s.safeUntil=until;notice(s,'Ball gerettet');}
            else{host.lose('pinball','Kugel verloren');return;}
          }
        }
      }
      ['left','right'].forEach(function(side){s.flips[side]=Math.max(0,s.flips[side]-dt);});
      movePinCamera(s,dt);
    }
    function paintRoute(c,route,unlocked){
      var p=route.points;
      function railStroke(width,color){
        c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(p[0][0],p[0][1]);
        c.bezierCurveTo(p[1][0],p[1][1],p[2][0],p[2][1],p[3][0],p[3][1]);c.stroke();
      }
      var tint=unlocked?route.color:'#686583';
      railStroke(34,'#12172d');railStroke(28,tint);railStroke(21,route===pinRoutes[1]?'#665c95':'#354664');railStroke(9,route===pinRoutes[1]?'#8a81ba':'#516382');
      for(var i=1;i<15;i++){
        var u=i/15,pos=ridePoint(route,u),ahead=ridePoint(route,u+.005),a=Math.atan2(ahead[1]-pos[1],ahead[0]-pos[0])+Math.PI/2;
        line(c,pos[0]-12*Math.cos(a),pos[1]-12*Math.sin(a),pos[0]+12*Math.cos(a),pos[1]+12*Math.sin(a),2,tint);
      }
      oval(c,p[0][0],p[0][1],19,12,'#101b31');text(c,'▲',p[0][0],p[0][1]+5,14,tint);
    }
    function drawPin(s){
      var c=s.ctx;sky(s,'#101a35','#1f1839');c.save();c.translate(0,-s.camera);
      round(c,12,32,456,pinHeight-50,36,'#696888');round(c,19,39,442,pinHeight-64,31,'#282845');
      var wash=c.createLinearGradient(0,0,0,pinHeight);
      wash.addColorStop(0,'#372648');wash.addColorStop(.48,'#203950');wash.addColorStop(1,'#332444');
      round(c,25,45,430,pinHeight-78,26,wash);
      for(var i=0;i<180;i++)dot(c,32+i*191%417,60+i*193%1380,i%9===0?2:1,i%3===0?'#aaa8c3':'#697893');
      // Screen-printed planets, flight paths and brass rivets of the cabinet.
      [[204,1250,40],[253,752,55],[190,327,34]].forEach(function(planet,i){
        var x=planet[0],y=planet[1],r=planet[2];c.save();c.translate(x,y);c.rotate(-.28);
        var light=c.createLinearGradient(-r,-r,r,r);light.addColorStop(0,['#d59b77','#779498','#bb93aa'][i]);light.addColorStop(1,'#38364f');
        dot(c,0,0,r,light);c.save();c.beginPath();c.arc(0,0,r,0,7);c.clip();
        for(var k=0;k<6;k++)line(c,-r,-r+k*r*.39,r,-r+8+k*r*.39,3+k%3,'rgba(43,47,69,.23)');
        c.restore();c.strokeStyle='#c8a98c';c.lineWidth=3;c.beginPath();c.ellipse(0,0,r*1.47,r*.32,0,0,Math.PI);c.stroke();c.restore();
      });
      for(var i=0;i<24;i++){
        var py=62+i*60;
        [20,460].forEach(function(px){dot(c,px,py,3.2,'#c1b3a5');line(c,px-1,py+1,px+1,py-1,1,'#68627c');});
      }
      // Silkscreen art, deck legends and paired lane lamps.
      [[245,127,'NOVA'],[232,482,'ION STATION'],[239,1163,'ORBITAL EXPRESS']].forEach(function(v,i){
        oval(c,v[0],v[1],85,25,'#1c233d');line(c,v[0]-72,v[1]+16,v[0]+72,v[1]+16,2,['#ecb962','#ac9de4','#5fd2ca'][i]);
        text(c,v[2],v[0],v[1]+5,17,['#ffdc8b','#d2c5ff','#97eae1'][i]);
      });
      for(var i=0;i<3;i++){
        var x=183+57*i;dot(c,x,1102,11,'#151930');dot(c,x,1102,7,s.lamps[i]?['#ffbd68','#8eead6','#d6a4ff'][i]:'#565570');
      }
      pinRoutes.forEach(function(route,i){paintRoute(c,route,i!==3||s.lamps.every(Boolean));});
      pinRails.forEach(function(r){
        line(c,r[0],r[1]+4,r[2],r[3]+4,17,'#11172d');line(c,r[0],r[1],r[2],r[3],13,'#58658c');
        line(c,r[0],r[1]-3,r[2],r[3]-3,4,'#9ee0e4');
      });
      pinBumpers.forEach(function(p,i){
        var glow=s.flash[i]>s.elapsed,tint=['#f3ae63','#71d7cc','#bd9de8'][i%3];
        dot(c,p[0]+2,p[1]+5,28,'#141a2f');dot(c,p[0],p[1],26,'#71819b');
        dot(c,p[0],p[1]-2,22,glow?'#fff5cd':tint);dot(c,p[0],p[1]-2,15,'#444763');text(c,'✦',p[0],p[1]+5,21,glow?'#fff':tint);
      });
      decks.forEach(function(deck,i){['left','right'].forEach(function(side){
        var r=paddle(s,side,deck),tint=['#fc9897','#86dbda','#ffcc79'][i];
        line(c,r[0],r[1]+5,r[2],r[3]+5,21,'#13182f');line(c,r[0],r[1],r[2],r[3],20,tint);
        line(c,r[0],r[1]-2,r[2],r[3]-2,9,'#f6e8d5');dot(c,r[0],r[1],7,'#5b5671');dot(c,r[0]-1,r[1]-1,3,'#c2d0db');
      });});
      s.trail.forEach(function(p,i){dot(c,p[0],p[1],2+i*.48,'rgba(177,221,252,'+(.025+i*.016)+')');});
      var b=s.ball,shine=c.createRadialGradient(b.x-3,b.y-4,1,b.x+1,b.y+2,11);
      shine.addColorStop(0,'#fff');shine.addColorStop(.38,'#dfeaf4');shine.addColorStop(.7,'#8599b0');shine.addColorStop(1,'#435674');dot(c,b.x,b.y,10,shine);
      c.restore();banner(s);
    }
    var definitions={
      golf:{title:'Mini-Golf',fixedHeight:640,help:'Ziehe auf der Bahn zurück und lasse los. Die Linie zeigt das Ziel. Am Rechner: ← → zielen, ↑ ↓ für die Kraft, Leertaste schlägt.',init:function(s){s.hole=1;golfCourse(s);},update:updateGolf,draw:drawGolf,recover:function(s){s.strokes=0;},action:golfAction,pointer:golfPointer},
      grab:{title:'Schatzgreifer',fixedHeight:640,help:'Tippe zum Start. Tippe erneut oder drücke die Leertaste, wenn der Greifer auf einen Schatz zeigt. Fange Fische und den Schatz der Krabbe. Stiefel und Dosen kosten Punkte. Du hast drei aktive Minuten.',init:function(s){s.reef=1;s.angle=0;resetHook(s);fillSeabed(s);},update:updateGrab,draw:drawGrab,recover:resetHook,
        action:function(s,a){if(a!=='fire'||s.phase!=='swing')return;if(s.awaitingStart){begin('grab');return;}s.phase='out';}},
      pinball:{title:'Taschen-Flipper',help:'Tippe links oder rechts oder drücke die jeweilige Pfeiltaste. Die Startrampe bringt die Kugel ins Spiel. Alle drei Flipperpaare reagieren mit. Sammle drei Bumperfarben und triff oben den Hyperraum.',init:function(s){s.lamps=[false,false,false];s.flash=[];servePin(s);},update:updatePin,draw:drawPin,recover:servePin,
        action:function(s,a){if((a==='left'||a==='right')&&begin('pinball')&&!s.flips[a])s.flips[a]=.2;}},
      doodle:{title:'Doodle Jump',help:'Du springst automatisch. Halte links/rechts oder ziehe die Figur. Federn tragen dich höher.',init:initDoodle,update:updateDoodle,draw:drawDoodle,recover:recoverDoodle},
      tiles:{title:'2048',help:'Tippe zum Starten. Wische in eine Richtung. Gleiche Zahlen verschmelzen. Ein Versuch pro Spiel!',init:initTiles,update:updateTiles,draw:drawTiles},
      maze:{title:'Pac-Man',help:'Sammle alle Punkte. Wische oder nutze die Pfeile. Große Punkte lassen dich Geister fangen.',init:initMaze,update:updateMaze,draw:drawMaze,recover:recoverMaze},
      asteroid:{title:'Asteroids',help:'Halte und bewege deinen Finger im Spielfeld: Das Schiff dreht sich zum Finger und gibt Schub. Beim Loslassen gleitet es weiter. Es feuert automatisch.',init:initAsteroid,update:updateAsteroid,draw:drawAsteroid,recover:recoverAsteroid}
    };
    function action(kind,a,pressed){
      var s=g(kind);if(!s||s.pausedAt!=null||!s.active)return;
      if(definitions[kind].action){if(pressed!==false)definitions[kind].action(s,a);return;}
      if(pressed===false){if(kind==='doodle')s.axis=0;if(kind==='asteroid')s.keys[a]=false;return;}
      if((kind==='tiles'||kind==='maze')&&['left','right','up','down'].indexOf(a)<0)return;
      if(kind==='doodle'&&a!=='left'&&a!=='right')return;
      if(!begin(kind))return;
      if(kind==='tiles'){tilesAction(s,a);return;}
      if(kind==='maze'){var d={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[a];if(d)s.wanted=d;}
      if(kind==='doodle'&&(a==='left'||a==='right')){s.pointerX=null;s.axis=a==='left'?-1:1;}
      if(kind==='asteroid'&&Object.prototype.hasOwnProperty.call(s.keys,a))s.keys[a]=true;
    }
    return {kinds:KINDS,definitions:definitions,action:action,update:function(kind,dt){var s=g(kind);if(!s||!s.running||s.pausedAt!=null)return;
      if(kind==='golf'||kind==='pinball'){
        for(var left=dt;left>1e-8&&s.running;left-=1/120)definitions[kind].update(s,Math.min(left,1/120));
      }else definitions[kind].update(s,dt);},draw:function(kind){var s=g(kind);if(s){if(host.prepare)s.renderScale=host.prepare(s.canvas,s.ctx,480,viewHeight(s));definitions[kind].draw(s);}},resize:function(kind,oldHeight){var s=g(kind);if(!s)return;if(kind==='pinball')s.camera=clamp(s.ball.y-viewHeight(s)*.55,0,pinHeight-viewHeight(s));if(kind==='doodle')s.cameraY+=oldHeight-viewHeight(s);if(kind==='asteroid'){s.touchTarget=null;var ratio=viewHeight(s)/oldHeight;s.ship.y*=ratio;s.rocks.concat(s.shots,s.sparks).forEach(function(p){p.y*=ratio;});}}};
  }
  var api={create:create,mergeLine:mergeLine,slideBoard:slideBoard,canMove:canMove,kinds:KINDS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.VocabArcade=api;
})(typeof window!=='undefined'?window:this);
