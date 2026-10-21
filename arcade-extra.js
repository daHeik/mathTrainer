/* Four original Canvas implementations. No assets, dependencies or network. */
(function(global){
  'use strict';
  var KINDS=['doodle','tiles','maze','asteroid'];
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
        round(c,-17,2,34,29,12,'#b8d780');dot(c,-6,12,5,'#fff8de');dot(c,7,12,5,'#fff8de');dot(c,-5+s.axis,12,2,'#343749');dot(c,8+s.axis,12,2,'#343749');c.strokeStyle='#4b6047';c.lineWidth=2;c.beginPath();c.arc(1,19,5,0,Math.PI);c.stroke();path(c,[[-20,4],[0,-18+bob],[16,4]],'#674979');round(c,-22,2,42,4,2,'#efa957');c.restore();});
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
    function recoverTiles(s){
      var sorted=s.board.map(function(v,i){return {v:v,i:i};}).filter(function(a){return a.v>0;}).sort(function(a,b){return a.v-b.v;});
      sorted.slice(0,2).forEach(function(a){s.board[a.i]=0;});s.anim=0;s.pending=null;notice(s,'Zwei kleine Steine freigeräumt');
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
    var definitions={
      doodle:{title:'Doodle Jump',help:'Du springst automatisch. Halte links/rechts oder ziehe die Figur. Federn tragen dich höher.',init:initDoodle,update:updateDoodle,draw:drawDoodle,recover:recoverDoodle},
      tiles:{title:'2048',help:'Wische in eine Richtung. Gleiche Zahlen verschmelzen. Erreiche 2048!',init:initTiles,update:updateTiles,draw:drawTiles,recover:recoverTiles},
      maze:{title:'Pac-Man',help:'Sammle alle Punkte. Wische oder nutze die Pfeile. Große Punkte lassen dich Geister fangen.',init:initMaze,update:updateMaze,draw:drawMaze,recover:recoverMaze},
      asteroid:{title:'Asteroids',help:'Halte und bewege deinen Finger im Spielfeld: Das Schiff dreht sich zum Finger und gibt Schub. Beim Loslassen gleitet es weiter. Es feuert automatisch.',init:initAsteroid,update:updateAsteroid,draw:drawAsteroid,recover:recoverAsteroid}
    };
    function action(kind,a,pressed){
      var s=g(kind);if(!s||s.pausedAt!=null||!s.active)return;
      if(pressed===false){if(kind==='doodle')s.axis=0;if(kind==='asteroid')s.keys[a]=false;return;}
      if((kind==='tiles'||kind==='maze')&&['left','right','up','down'].indexOf(a)<0)return;
      if(kind==='doodle'&&a!=='left'&&a!=='right')return;
      if(!begin(kind))return;
      if(kind==='tiles'){tilesAction(s,a);return;}
      if(kind==='maze'){var d={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[a];if(d)s.wanted=d;}
      if(kind==='doodle'&&(a==='left'||a==='right')){s.pointerX=null;s.axis=a==='left'?-1:1;}
      if(kind==='asteroid'&&Object.prototype.hasOwnProperty.call(s.keys,a))s.keys[a]=true;
    }
    return {kinds:KINDS,definitions:definitions,action:action,update:function(kind,dt){var s=g(kind);if(s&&s.running&&s.pausedAt==null)definitions[kind].update(s,dt);},draw:function(kind){var s=g(kind);if(s){if(host.prepare)s.renderScale=host.prepare(s.canvas,s.ctx,480,viewHeight(s));definitions[kind].draw(s);}},resize:function(kind,oldHeight){var s=g(kind);if(!s)return;if(kind==='doodle')s.cameraY+=oldHeight-viewHeight(s);if(kind==='asteroid'){s.touchTarget=null;var ratio=viewHeight(s)/oldHeight;s.ship.y*=ratio;s.rocks.concat(s.shots,s.sparks).forEach(function(p){p.y*=ratio;});}}};
  }
  var api={create:create,mergeLine:mergeLine,slideBoard:slideBoard,canMove:canMove,kinds:KINDS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.VocabArcade=api;
})(typeof window!=='undefined'?window:this);
