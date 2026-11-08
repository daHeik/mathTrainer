(function(){
  'use strict';
  var DURATION=90;
  function easter(year){
    var a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),k=Math.floor((b-f+1)/3),h=(19*a+b-d-k+15)%30,i=Math.floor(c/4),l=c%4,m=(32+2*e+2*i-h-l)%7,n=Math.floor((a+11*h+22*m)/451),v=h+m-7*n+114;
    return new Date(year,Math.floor(v/31)-1,v%31+1);
  }
  function theme(date){
    var day=(date.getMonth()+1)*100+date.getDate(),holiday=null,egg=easter(date.getFullYear()),serial=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()),delta=(serial-Date.UTC(egg.getFullYear(),egg.getMonth(),egg.getDate()))/86400000;
    if(day>=1020&&day<1101)holiday='halloween';else if(day>=1201&&day<1228)holiday='christmas';else if(delta>=-7&&delta<=7)holiday='easter';
    return {season:day>=915&&day<1201?'autumn':day>=1201||day<401?'winter':day<701?'spring':'summer',holiday:holiday};
  }
  function create(random,date){return {kind:'chicken',active:true,running:false,pausedAt:null,rewardConsumed:false,elapsed:0,score:0,ammo:6,reloadUntil:0,nextSpawn:0,nextPond:7,nextPeek:4,targets:[],visitors:[],effects:[],random:random||Math.random,width:1000,minRadius:22,theme:theme(date||new Date())};}
  function obstacles(g,layer){return [{x:g.width*([.16,.40,.20][layer]),y:365+layer*64,r:39+layer*9,type:'tree'},{x:g.width*([.77,.58,.84][layer]),y:376+layer*64,r:42+layer*9,type:'barn'}];}
  function inside(o,x,y){return o.type==='tree'?Math.pow((x-o.x)/o.r,2)+Math.pow((y-(o.y-o.r)) /(o.r*1.35),2)<1||Math.abs(x-o.x)<7&&y>o.y-o.r&&y<o.y+35:Math.abs(x-o.x)<o.r&&y>o.y-o.r*1.9+Math.abs(x-o.x)*.8&&y<o.y+28;}
  function covered(g,t,x,y){for(var layer=t.layer;layer<3;layer++){if(obstacles(g,layer).some(function(o){return !(t.visitor==='peek'&&layer===t.layer&&o.type==='barn')&&inside(o,x,y);}))return true;}return false;}
  function visitorPop(g,t){var age=g.elapsed-t.born;if(age<0||age>=t.duration)return 0;if(t.visitor==='skater')return 1;return g.reduced?1:Math.max(0,Math.min(1,age/.25,(t.duration-age)/.3));}
  function pond(g){return {x:g.width*.08,y:535,rx:g.width*.11,ry:28};}
  function position(g,t){
    if(t.visitor){
      var age=g.elapsed-t.born,water=pond(g),pop=visitorPop(g,t);
      if(t.visitor==='peek'){var stall=obstacles(g,t.layer)[1];return {x:stall.x-11*t.direction,y:stall.y+28+(1-pop)*58,angle:0};}
      if(t.visitor==='skater'){var phase=age*1.8+t.phase;return {x:water.x+Math.sin(phase)*water.rx*.52,y:water.y-23+Math.sin(phase*2)*3,angle:Math.sin(phase)*.10,direction:Math.cos(phase)<0?-1:1};}
      return {x:Math.max(30,water.x),y:water.y+5+(1-pop)*60,angle:0};
    }
    var age=g.elapsed-t.born,phase=t.phase||0,freq=t.frequency||1,amp=t.amplitude||12,mode=t.flight||'cruise',speed=t.speed;
    var travelAge=age,hoverAt=t.hoverAt||4,hold=t.hold||1.8;
    if(mode==='hover')travelAge=age-Math.max(0,Math.min(hold,age-hoverAt));
    var pulse=t.pace||0,progress=speed*(travelAge+pulse*(Math.cos(phase)-Math.cos(travelAge*freq+phase))/freq);
    var x=(t.direction>0?-100+progress:g.width+100-progress)+(t.offsetX||0),y=t.baseY,angle=0;
    if(mode==='swoop'){y+=Math.sin(age*freq*.6+phase)*amp;angle=Math.cos(age*freq*.6+phase)*.3;}
    else if(mode==='flutter'){y+=Math.sin(age*freq*2+phase)*amp*.5+Math.sin(age*freq*.7+phase)*amp*.5;angle=Math.cos(age*freq*2+phase)*.16;}
    else if(mode==='zigzag'){y+=Math.asin(Math.sin(age*freq+phase))*amp*.65;angle=Math.cos(age*freq+phase)>.0?.22:-.22;}
    else if(mode==='balloon'){y+=Math.sin(age*freq*.45+phase)*amp;angle=Math.sin(age*freq*.6+phase)*.06;}
    else if(mode==='glide'){y+=Math.sin(age*freq*.45+phase)*amp+Math.sin(age*.3)*15;angle=Math.cos(age*freq*.45+phase)*.13;}
    else if(mode==='hover'){y+=Math.sin(age*freq*2+phase)*7;angle=Math.sin(age*freq+phase)*.12;}
    else {y+=Math.sin(age*freq+phase)*amp*.35;angle=Math.cos(age*freq+phase)*.06;}
    var loopAge=age-(t.loopAt||4),cycle=t.loopEvery||8;
    if(t.maneuver&&loopAge>=0&&loopAge%cycle<1.6){var loop=loopAge%cycle/1.6*Math.PI*2;x+=Math.sin(loop)*48;y-=(1-Math.cos(loop))*32;angle=loop;}
    return {x:x,y:Math.max(76,Math.min(514,y)),angle:angle};
  }
  function spawn(g){
    var r=g.random,layer=Math.floor(r()*3),size=24+r()*15,speed=50+r()*145,vehicle=r()<.24?['plane','balloon','glider'][Math.floor(r()*3)]:null;
    g.spawnCount=(g.spawnCount||0)+1;
    if(g.spawnCount>=(g.nextVehicle||3)){vehicle=['plane','balloon','glider'][(g.vehicleIndex||0)%3];g.vehicleIndex=(g.vehicleIndex||0)+1;g.nextVehicle=g.spawnCount+3+Math.floor(r()*3);}else vehicle=null;
    var flight=['cruise','swoop','flutter','zigzag','hover'][Math.floor(r()*5)];
    if(vehicle==='balloon'){flight='balloon';speed=34+r()*24;}else if(vehicle==='glider'){flight='glide';speed=60+r()*40;}else if(vehicle==='plane'){flight='swoop';speed=125+r()*65;}
    speed*=1.8;
    g.targets.push({born:g.elapsed,layer:layer,r:size*(.8+layer*.12),size:size,speed:speed,direction:r()<.5?1:-1,baseY:r()<.32?334+layer*62:130+r()*170,phase:r()*6.28,frequency:.65+r()*1.4,amplitude:15+r()*44,pace:vehicle==='balloon'?.15:r()*.55,hoverAt:2+r()*4,hold:1+r()*1.8,flight:flight,loopAt:3+r()*5,loopEvery:7+r()*5,maneuver:!vehicle&&r()<.25,vehicle:vehicle,character:Math.floor(r()*6),flap:2.2+r()*3.4,points:Math.round((18+(39-size)*1.5+speed*.18)/5)*5});
  }
  function visit(g,type){
    var r=g.random,kind=type==='pond'?(g.theme.season==='winter'?'skater':'diver'):'peek',duration=kind==='diver'?2:kind==='skater'?6:2.6+r()*.8;
    if(g.elapsed>DURATION-duration)return;
    g.visitors.push({visitor:kind,born:g.elapsed,duration:duration,layer:kind==='peek'?Math.floor(r()*3):3,r:kind==='peek'?18:21,size:28,speed:0,direction:r()<.5?1:-1,phase:r()*Math.PI*2,character:kind==='skater'?3:Math.floor(r()*6),flap:2.5,points:kind==='diver'?65:kind==='skater'?60:55});
  }
  // Hit the complete painted bird, including crest/bow, beak, tail and seasonal hat.
  // Coordinates are inverse transformed by the exact drawing pose before testing.
  function ellipseContains(x,y,cx,cy,rx,ry){return Math.pow((x-cx)/rx,2)+Math.pow((y-cy)/ry,2)<=1;}
  function polygonContains(x,y,points){var hit=false;for(var i=0,j=points.length-1;i<points.length;j=i++){var a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  function birdHit(g,t,x,y){
    if(t.visitor){
      if(g.elapsed<t.born||g.elapsed>=t.born+t.duration||visitorPop(g,t)<=0)return false;
      if(t.visitor==='diver'&&y>pond(g).y)return false;
      if(t.visitor==='peek'){var stall=obstacles(g,t.layer)[1],size=stall.r/40;if(x<stall.x-15*size||x>stall.x+15*size||y<stall.y-10*size||y>stall.y+28)return false;}
    }
    var p=position(g,t),angle=g.reduced?0:p.angle,dx=x-p.x,dy=y-p.y,scale=t.r/30;
    var bx=(dx*Math.cos(angle)+dy*Math.sin(angle))/scale*(p.direction||t.direction),by=(-dx*Math.sin(angle)+dy*Math.cos(angle))/scale;
    if(t.visitor==='skater'&&polygonContains(bx,by,[[-22,25],[27,25],[27,36],[-22,36]]))return true;
    if(t.visitor==='diver'&&polygonContains(bx,by,[[32,-19],[32,-63],[49,-63],[49,-51],[41,-51],[41,-19]]))return true;
    if(ellipseContains(bx,by,-38,-15,24,24)||polygonContains(bx,by,[[-21,15],[20,15],[21,34],[-22,34]])||ellipseContains(bx,by,0,0,32,25)||ellipseContains(bx,by,19,-22,19,22)||ellipseContains(bx,by,15,-43,18,12)||polygonContains(bx,by,[[-20,-10],[-58,-42],[-55,10],[-22,20]])||polygonContains(bx,by,[[30,-24],[49,-14],[31,-6]]))return true;
    if(t.character===1&&ellipseContains(bx,by,20,-48,21,12))return true;
    if(t.character===3&&polygonContains(bx,by,[[2,8],[-49,7],[-40,22],[8,18]]))return true;
    if(g.theme.holiday==='halloween'&&polygonContains(bx,by,[[-7,-34],[12,-77],[30,-39],[40,-32]]))return true;
    if(g.theme.holiday==='christmas'&&(polygonContains(bx,by,[[0,-34],[9,-69],[30,-68],[42,-34]])||ellipseContains(bx,by,34,-64,8,8)))return true;
    if(g.theme.holiday==='easter'&&(ellipseContains(bx,by,9,-58,7,23)||ellipseContains(bx,by,26,-57,7,23)))return true;
    if(t.vehicle==='plane'&&(ellipseContains(bx,by,0,21,57,15)||polygonContains(bx,by,[[-62,-9],[-41,-7],[-28,21],[-43,37],[-59,21]])||polygonContains(bx,by,[[-42,0],[20,0],[42,13],[-42,12]])||polygonContains(bx,by,[[-42,23],[12,23],[42,39],[-43,37]])))return true;
    if(t.vehicle==='balloon'&&(ellipseContains(bx,by,0,-86,40,50)||polygonContains(bx,by,[[-22,13],[22,13],[18,38],[-18,38]])))return true;
    if(t.vehicle==='glider'&&polygonContains(bx,by,[[-74,-47],[-51,-79],[-27,-92],[0,-97],[27,-92],[51,-79],[74,-47],[37,-68],[0,-77],[-37,-68]]))return true;
    return dx*dx+dy*dy<=g.minRadius*g.minRadius;
  }
  function resize(g,width){if(width===g.width)return;var factor=width/g.width;g.targets.forEach(function(t){var p=position(g,t);t.offsetX=(t.offsetX||0)+p.x*(factor-1)-(t.direction>0?0:width-g.width);});g.width=width;}
  function cowPose(g,index,reduced){
    var phase=g.elapsed*(.05+index*.011)+index;
    return {x:g.width*(.28+index*.10)+(reduced?0:Math.sin(phase)*g.width*.075),y:392+index*13,scale:.32+index*.06,direction:reduced?1:Math.cos(phase)<0?-1:1};
  }
  function advance(g,dt){
    if(!g.running||g.pausedAt!==null||!Number.isFinite(dt)||dt<=0)return false;
    var end=Math.min(DURATION,g.elapsed+dt);
    while(g.elapsed<end){g.elapsed=Math.min(end,g.elapsed+.05);
      g.visitors=g.visitors.filter(function(v){return g.elapsed<v.born+v.duration;});
      if(g.elapsed>=g.nextPond){visit(g,'pond');g.nextPond=g.elapsed+(g.theme.season==='winter'?6:2)+8+g.random()*7;}
      if(g.elapsed>=g.nextPeek){visit(g,'peek');g.nextPeek=g.elapsed+9+g.random()*7;}
      if(g.reloadUntil&&g.elapsed>=g.reloadUntil){g.ammo=6;g.reloadUntil=0;}if(g.elapsed>=g.nextSpawn){if(g.targets.length<(g.width<600?5:7))spawn(g);g.nextSpawn=g.elapsed+.9+g.random()*.6;}g.targets=g.targets.filter(function(t){var p=position(g,t);return g.elapsed-t.born<(g.width+300)/Math.max(20,t.speed*(1-(t.pace||0)))+4&&p.x>-170&&p.x<g.width+170;});}
    g.effects=g.effects.filter(function(e){return g.elapsed-e.at<.85;});
    if(g.elapsed>=DURATION){g.running=false;return true;}return false;
  }
  function reload(g){if(!g.running||g.pausedAt!==null||g.reloadUntil||g.ammo===6)return false;g.reloadUntil=g.elapsed+1;return true;}
  function shoot(g,x,y){
    if(!g.running||g.pausedAt!==null||g.reloadUntil||!g.ammo)return false;
    g.ammo--;var hit=null;
    var candidates=g.targets.concat(g.visitors);
    for(var layer=3;layer>=0&&!hit;layer--)for(var i=candidates.length-1;i>=0;i--){var t=candidates[i];if(t.layer===layer&&birdHit(g,t,x,y)&&!covered(g,t,x,y)){hit=t;break;}}
    if(hit){g.score+=hit.points;var collection=hit.visitor?g.visitors:g.targets;collection.splice(collection.indexOf(hit),1);g.effects.push({x:x,y:y,at:g.elapsed,points:hit.points});}else g.effects.push({x:x,y:y,at:g.elapsed,points:0});
    if(!g.ammo)reload(g);return !!hit;
  }
  function topFive(input){var seen={};return (Array.isArray(input)?input:[]).filter(function(e){if(!e||typeof e.id!=='string'||!/^chicken-[a-z0-9-]{1,64}$/.test(e.id)||seen[e.id]||!Number.isSafeInteger(e.score)||e.score<0||!Number.isFinite(e.at)||e.at<0||e.at>8640000000000000)return false;seen[e.id]=true;return true;}).map(function(e,i){return {id:e.id,score:e.score,at:e.at,order:i};}).sort(function(a,b){return b.score-a.score||b.at-a.at||a.order-b.order;}).slice(0,5).map(function(e){return {id:e.id,score:e.score,at:e.at};});}
  function draw(ctx,g,reduced){
    var w=g.width,time=g.elapsed,t=g.theme,winter=t.season==='winter',autumn=t.season==='autumn';
    var palette={autumn:{sky:'#96bfc9',haze:'#ffe8bb',far:'#b5b7a0',mid:'#9ba372',near:'#7d8955',leaf:'#cc8141',light:'#edb65f',dark:'#905838'},winter:{sky:'#91b5cc',haze:'#f9e4d2',far:'#d7e3e2',mid:'#b9d1d5',near:'#a6c3ca',leaf:'#cddfe2',light:'#f6faf5',dark:'#7c9b9e'},spring:{sky:'#93c9d3',haze:'#fff1d0',far:'#bdd0a2',mid:'#93b97c',near:'#719956',leaf:'#86b370',light:'#bed58c',dark:'#507e59'},summer:{sky:'#83c2d1',haze:'#fff0c5',far:'#bcc690',mid:'#9ab46c',near:'#77974e',leaf:'#729951',light:'#acc67a',dark:'#446d48'}}[t.season];
    var ink='#37463f';
    function grad(x,y,x2,y2,c1,c2){var v=ctx.createLinearGradient(x,y,x2,y2);v.addColorStop(0,c1);v.addColorStop(1,c2);return v;}
    function oval(x,y,rx,ry,fill,stroke,line){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line||1.5;ctx.stroke();}}
    function path(points,fill,stroke,line){ctx.beginPath();points.forEach(function(p,i){if(!i)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line||1.5;ctx.stroke();}}
    function line(points,color,width){ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.strokeStyle=color;ctx.lineWidth=width||1.5;ctx.stroke();}
    function roundRect(x,y,b,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,b,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
    function tree(x,y,s,far){
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(0,14,40,7,'#38584525');
      path([[-6,16],[-5,-58],[7,-58],[9,16]],grad(-4,0,10,0,'#99704c','#645641'));
      line([[2,-15],[-21,-48]],'#756045',5);line([[2,-36],[21,-70]],'#756045',4);
      [[-23,-60,28,29],[20,-62,30,33],[1,-86,33,31],[0,-52,36,26]].forEach(function(v,i){oval(v[0],v[1],v[2],v[3],grad(-25,-110,25,-30,i%2?palette.light:palette.leaf,palette.dark));});
      if(!far){for(var l=0;l<17;l++){var lx=Math.sin(l*2.4)*37,ly=-60+Math.cos(l*1.8)*29;oval(lx,ly,3+l%3,2,autumn?(l%2?'#f4c879':'#ab603c'):(winter?'#ffffff99':'#d2df9d88'));}line([[-2,6],[-1,-29]],'#c49b68',2);}
      if(winter){oval(1,-106,24,6,'#f9fbf6');oval(-25,-79,18,5,'#f9fbf6');oval(25,-85,16,5,'#f9fbf6');}ctx.restore();
    }
    function fir(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#8c7759';ctx.fillRect(-3,-12,6,24);for(var j=0;j<3;j++)path([[-25+j*5,-5-j*19],[0,-75],[25-j*5,-5-j*19]],winter?'#759698':palette.dark);if(winter)for(j=0;j<3;j++)path([[-18+j*4,-18-j*17],[0,-75],[18-j*4,-18-j*17],[0,-25-j*17]],'#e7f0ec');ctx.restore();}
    function cloud(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(0,11,51,12,'#627e8220');var cloudFill=grad(0,-29,0,20,'#fffdf2','#e3ece5');oval(-31,0,27,16,cloudFill);oval(-10,-13,26,24,cloudFill);oval(20,-8,31,22,cloudFill);oval(45,3,24,14,cloudFill);oval(2,8,53,14,cloudFill);ctx.restore();}
    function pumpkin(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(0,0,14,11,'#bd6839');oval(-6,-1,8,11,'#e99a43');oval(4,-1,8,12,'#f2ac4c');path([[-2,-11],[0,-18],[4,-17],[3,-10]],'#71864d');path([[-8,-2],[-4,-6],[-1,-2]],'#704c3b');path([[4,-2],[8,-6],[10,-2]],'#704c3b');ctx.restore();}
    function egg(x,y,s,color){ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(0,0,7,10,color,'#f8f2d6',1);line([[-6,0],[-3,-2],[0,1],[3,-1],[6,1]],'#fff4d1',2);ctx.restore();}
    function cow(x,y,s,index,direction){
      ctx.save();ctx.translate(x,y);ctx.scale(s*direction,s);oval(0,14,29,5,'#38584526');
      for(var leg=0;leg<4;leg++){var lx=-17+leg*11,step=reduced?0:Math.sin(time*(1.8+index*.3)+leg*2)*5;line([[lx,4],[lx+step,19]],'#786b56',5);line([[lx+step,17],[lx+step+4,18]],'#394a41',3);}
      oval(-2,-5,27,15,'#fff5df','#687568',1.2);oval(-11,-8,9,8,'#526053');oval(10,0,6,8,'#526053');
      oval(26,-9,10,13,'#fff5df','#687568',1.2);oval(30,-2,9,6,'#e5b3a1');oval(30,-14,1.6,1.8,'#35463d');path([[20,-20],[16,-28],[24,-22]],'#d9bb80');path([[31,-20],[34,-27],[36,-20]],'#d9bb80');oval(18,-14,6,3,'#f1ddbe');line([[-26,-6],[-34,1],[-32,7]],'#7a7358',2);oval(-32,8,3,4,'#4e6051');ctx.restore();
    }
    function windmill(){
      var x=w*.51,y=320,s=w<600?.62:.78;ctx.save();ctx.translate(x,y);ctx.scale(s,s);
      oval(0,9,36,6,'#53684d22');path([[-22,5],[-16,-73],[16,-73],[25,5]],grad(-25,-60,25,0,'#f8ebcd','#c4b58d'),'#8f9375');path([[-26,-73],[0,-100],[26,-73]],'#8d6c55','#6b6653');roundRect(-6,-22,12,28,5,'#716b51');roundRect(-5,-58,10,13,3,'#7a9e9d');
      ctx.translate(0,-66);ctx.rotate(reduced?.4:time*.3);for(var k=0;k<4;k++){ctx.save();ctx.rotate(k*Math.PI/2);path([[-3,0],[-5,-64],[8,-64],[8,-13]],'#f5e6bf','#8c9679',1);for(var q=15;q<65;q+=10)line([[-4,-q],[8,-q]],'#b7b89a',1);line([[2,-3],[2,-69]],'#787c60',3);ctx.restore();}oval(0,0,6,6,'#a58c63','#6b715b');ctx.restore();
    }
    function scenery(){
      ctx.fillStyle=grad(0,0,0,420,t.holiday==='halloween'?'#586579':palette.sky,palette.haze);ctx.fillRect(0,0,w,600);
      var glow=ctx.createRadialGradient(w*.80,95,3,w*.80,95,115);glow.addColorStop(0,'#fff5cebb');glow.addColorStop(1,'#fff5ce00');ctx.fillStyle=glow;ctx.fillRect(w*.8-115,0,230,230);oval(w*.8,95,28,28,'#fff3c1');
      for(var c=0;c<5;c++)cloud(((c*.26*w+(reduced?0:time*(3+c*.8)))%(w+180))-70,70+(c%3)*42,.65+(c%3)*.18);
      // Atmospheric ridges and a tiny treeline separate the horizon from the farm.
      ctx.beginPath();ctx.moveTo(0,310);ctx.bezierCurveTo(w*.2,215,w*.3,296,w*.45,258);ctx.bezierCurveTo(w*.65,218,w*.8,300,w,252);ctx.lineTo(w,600);ctx.lineTo(0,600);ctx.fillStyle=palette.far;ctx.fill();
      ctx.save();ctx.globalAlpha=.45;for(var woods=0;woods<22;woods++){var fx=w*.04+woods*w*.013,fy=318+Math.sin(woods*.6)*10;fir(fx,fy,.25+(woods%4)*.045);}ctx.restore();
      for(var grove=0;grove<5;grove++)tree(w*(.09+grove*.035),340+grove%2*5,.34+grove%3*.07,true);
      for(var layer=0;layer<3;layer++){
        ctx.save();ctx.beginPath();ctx.moveTo(0,600);ctx.lineTo(0,350+layer*65);for(var x=0;x<=w+20;x+=20)ctx.lineTo(x,350+layer*65+Math.sin(x/w*7+layer)*29);ctx.lineTo(w,600);ctx.closePath();ctx.fillStyle=grad(0,320+layer*65,0,600,[palette.far,palette.mid,palette.near][layer],winter?'#dce8e2':layer===2?'#647d49':palette.near);ctx.fill();ctx.clip();
        for(var row=0;row<7;row++){ctx.beginPath();ctx.moveTo(-20,390+layer*59+row*13);ctx.bezierCurveTo(w*.3,350+layer*67+row*14,w*.65,446+layer*32+row*14,w+20,375+layer*64+row*18);ctx.strokeStyle=winter?'#ffffff55':row%2?'#e5d29640':'#425c3820';ctx.lineWidth=layer+1;ctx.stroke();}
        if(layer===1){path([[w*.31,400],[w*.47,393],[w*.65,451],[w*.41,458]],winter?'#e9ece177':'#e1bc6577');for(var furrow=0;furrow<10;furrow++)line([[w*(.31+furrow*.017),400],[w*(.41+furrow*.024),458]],'#8a87452e',1);}
        ctx.restore();
      }
      // Winding field road with wheel ruts and a soft grassy verge.
      ctx.beginPath();ctx.moveTo(w*.52,343);ctx.bezierCurveTo(w*.42,390,w*.74,435,w*.50,473);ctx.bezierCurveTo(w*.37,500,w*.38,550,w*.49,600);ctx.lineTo(w*.30,600);ctx.bezierCurveTo(w*.21,534,w*.34,488,w*.46,460);ctx.bezierCurveTo(w*.65,423,w*.36,390,w*.50,343);ctx.closePath();ctx.fillStyle=winter?'#eaf0e7':'#d7bf8f';ctx.fill();
      for(var rut=0;rut<2;rut++){ctx.beginPath();ctx.moveTo(w*(.505+rut*.008),351);ctx.bezierCurveTo(w*.40,396,w*.72,435,w*(.47+rut*.02),469);ctx.bezierCurveTo(w*.31,516,w*(.26+rut*.10),556,w*(.34+rut*.11),600);ctx.strokeStyle=winter?'#c5d6d1':'#b19a6a66';ctx.lineWidth=2;ctx.stroke();}
      // Pond, reeds, a wooden fence and flowers are background art, never invisible cover.
      oval(w*.08,535,w*.11,28,grad(0,509,0,561,winter?'#d7eced':'#8abfc2',winter?'#a3c5cb':'#649c9e'),'#c0bb82',3);oval(w*.07,532,w*.075,15,null,'#e5f0d566',1);
      if(winter){var ice=pond(g);ctx.save();ctx.beginPath();ctx.ellipse(ice.x,ice.y,ice.rx,ice.ry,0,0,7);ctx.clip();line([[ice.x-ice.rx*.7,542],[ice.x-ice.rx*.2,535],[ice.x+ice.rx*.15,540],[ice.x+ice.rx*.7,529]],'#ffffff88',1.5);line([[ice.x-ice.rx*.2,535],[ice.x-ice.rx*.3,525]],'#ffffff88',1);oval(ice.x,ice.y,ice.rx*.65,12,null,'#f7fff388',1.5);ctx.restore();}
      for(var reed=0;reed<9;reed++){var rx=w*.025+reed*5;line([[rx,556],[rx+2,530-reed%3*5]],'#596f48',2);oval(rx+2,530-reed%3*5,2,5,'#9a8255');}
      for(var post=0;post<11;post++){var px=w*.57+post*w*.04,py=519+Math.sin(post*.3)*12;line([[px,py],[px,py-24]],'#958866',4);if(post)line([[px-w*.04,py-17],[px,py-17]],'#c9b387',3);}
      for(var grass=0;grass<42;grass++){var gx=(grass*71.7)%w,gy=482+(grass*37)%115;line([[gx-3,gy],[gx,gy-6],[gx+2,gy]],winter?'#edf1dc88':'#445d383e',1);if(!winter&&grass%3===0){oval(gx+1,gy-8,2.3,2.3,autumn?'#e3b268':grass%2?'#f1dc97':'#edd1cc');}}
      windmill();
      for(var ci=0;ci<3;ci++){var pose=cowPose(g,ci,reduced);cow(pose.x,pose.y,pose.scale,ci,pose.direction);}
      for(var leaf=0;leaf<8;leaf++){var lx=(leaf*w*.173+(reduced?0:time*(7+leaf%3)))%(w+30)-15,ly=195+leaf*41+Math.sin(time*.7+leaf)*12;if(winter)oval(lx,ly,2,2,'#fff9edbb');else if(autumn){ctx.save();ctx.translate(lx,ly);ctx.rotate(reduced?leaf:time*.5+leaf);oval(0,0,4,1.8,leaf%2?'#bf7b4499':'#d4aa5a99');ctx.restore();}}
      if(t.holiday==='halloween'){pumpkin(w*.41,480,.7);pumpkin(w*.46,488,.5);}
      if(t.holiday==='easter')for(var eg=0;eg<7;eg++)egg(w*(.11+eg*.12),532+eg%3*16,.6,['#e7b5c7','#e1ce8f','#b0c7de'][eg%3]);
      if(t.holiday==='christmas'){for(var gift=0;gift<3;gift++){roundRect(w*.42+gift*15,492-gift%2*5,13,13,2,['#c66d69','#789e88','#d8b367'][gift]);line([[w*.42+gift*15+6,491-gift%2*5],[w*.42+gift*15+6,505-gift%2*5]],'#fae5ad',2);}}
    }
    function bird(b){
      var p=position(g,b),variant=b.character||0,s=b.r/30,flap=reduced?0:Math.sin(time*(b.flap||3)*Math.PI*2+b.phase),body=[['#fff6da','#ddc995','#b08b53'],['#f4d39c','#d5a367','#a46c43'],['#e6ece1','#a5b7ad','#677e79'],['#b97b4d','#8e533c','#634d3c'],['#fff8e5','#ead9b6','#c3a572'],['#d9b69b','#b7856c','#7e5f52']][variant];
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(reduced?0:p.angle);ctx.scale(s*(p.direction||b.direction),s);ctx.lineJoin='round';ctx.lineCap='round';
      // Pale exterior rim and restrained ground shadow keep cream and dark birds readable.
      ctx.shadowColor='#fff8df';ctx.shadowBlur=4;ctx.shadowOffsetY=0;
      if(b.vehicle==='balloon'){
        oval(0,-86,38,48,grad(-30,-125,25,-40,'#f3b2ac','#bd6f83'),'#734f5f',1.5);ctx.save();ctx.beginPath();ctx.ellipse(0,-86,38,48,0,0,7);ctx.clip();oval(0,-86,21,48,'#f1d4a4');oval(0,-86,7,48,'#d8848e');ctx.restore();oval(-13,-110,8,14,'#fff0cf55');path([[-19,-46],[-12,-28],[12,-28],[19,-46]],'#cfa476','#806b54');line([[-24,-49],[-17,19]],'#8e7c61',1.5);line([[24,-49],[17,19]],'#8e7c61',1.5);
      }
      if(b.vehicle==='glider'){
        ctx.beginPath();ctx.moveTo(-72,-49);ctx.bezierCurveTo(-39,-110,39,-110,72,-49);ctx.quadraticCurveTo(0,-79,-72,-49);ctx.fillStyle=grad(0,-98,0,-49,'#e8b951','#cc7755');ctx.fill();ctx.strokeStyle='#8a7150';ctx.lineWidth=1.5;ctx.stroke();for(var rib=-2;rib<=2;rib++){line([[rib*24,-58-Math.cos(rib*.5)*16],[0,9]],'#806e5f88',1);}
      }
      // Three individually shaded tail feathers, rather than a single triangle.
      oval(-30,-4,14,13,body[2],ink,1.7);ctx.save();ctx.translate(-29,-9);ctx.rotate(-.7);oval(-5,-12,7,19,body[1],ink,1.5);ctx.rotate(-.32);oval(0,-15,6,20,body[2],ink,1.5);ctx.restore();
      if(!b.vehicle){line([[-4,18],[-10,29],[-18,30]],'#c89045',3);line([[8,17],[7,29],[16,31]],'#c89045',3);}
      oval(-2,0,31,24,grad(-13,-22,8,23,body[0],body[1]),ink,2);oval(3,10,21,10,body[0]+'88');
      // Feather scallops and a different flap rate for every chicken.
      ctx.save();ctx.translate(-9,-1);ctx.rotate(-.17-flap*.33);oval(-2,2,22,12,grad(0,-9,0,15,body[1],body[2]),ink,1.5);for(var f=0;f<3;f++)line([[-15+f*7,3],[-12+f*7,8]],body[0],1.4);ctx.restore();
      oval(17,-19,18,22,grad(7,-37,29,2,body[0],body[1]),ink,1.8);
      oval(7,-40,6,9,'#c46057',ink,1.2);oval(16,-45,6,10,'#d77a68',ink,1.2);oval(25,-41,5,8,'#e18c76',ink,1.2);oval(31,-5,5,7,'#d67e6d',ink,1);
      path([[31,-23],[47,-15],[32,-7]],grad(30,-24,46,-7,'#f4cc75','#d99a45'),ink,1.6);line([[33,-15],[43,-15]],'#aa783f',1);
      oval(25,-24,7,8,'#fffdf0',ink,1.2);oval(28,-24,3.2,4.4,'#344b44');oval(29,-26,1.2,1.6,'#ffffff');oval(29,-13,4,2.6,'#edb18d88');
      if(variant===2){line([[17,-34],[27,-36]],'#617d70',2.3);}else if(variant===4){line([[17,-35],[27,-32]],'#a48c67',1.6);}
      // Character accessories: a bow, a flower, aviator goggles, a scarf or a waistcoat.
      if(variant===1){path([[17,-46],[0,-57],[-2,-42],[17,-43]],'#c17391',ink,1);path([[18,-46],[38,-57],[40,-42],[18,-43]],'#df9db3',ink,1);oval(18,-46,4,5,'#f0c0bf',ink,1);}
      if(variant===4){for(var petal=0;petal<5;petal++)oval(8+Math.cos(petal*1.26)*6,-39+Math.sin(petal*1.26)*6,4,4,'#fff0d2');oval(8,-39,4,4,'#dfb65b');}
      if(variant===3){path([[4,8],[-18,8],[-47,10],[-39,21],[-14,16],[7,17]],'#6b9d9b',ink,1);line([[-35,12],[-23,12]],'#b1d2be',2);}
      if(variant===5){path([[-1,-9],[16,0],[12,20],[-5,21]],'#7e8f9c',ink,1);oval(8,8,1.7,1.7,'#f4d68b');oval(7,15,1.7,1.7,'#f4d68b');}
      if(variant===2||b.vehicle==='plane'){line([[5,-26],[36,-26]],'#8b6c4c',4);oval(21,-24,9,9,'#b7d7d488','#877551',2.5);oval(24,-27,3,4,'#fff9e5aa');}
      if(b.visitor==='diver'){
        // A broad turquoise diving mask, reflective glass and a bent snorkel.
        line([[3,-27],[36,-27]],'#568d8c',5);roundRect(12,-35,27,21,7,'#73bfc3','#355c5b');roundRect(16,-32,19,14,4,'#c9ece8bb','#def9ee');line([[18,-29],[25,-29]],'#fffaf0',2);
        line([[37,-20],[37,-57],[46,-57]],'#e5ba64',5);oval(46,-57,4,4,'#436c6b','#f4d48d',1.5);
      }
      if(b.visitor==='skater'){
        line([[-19,32],[-4,32],[0,28]],'#e8f0e6',3);line([[5,33],[20,33],[24,29]],'#e8f0e6',3);line([[-13,27],[-13,32]],'#657976',2);line([[12,28],[12,33]],'#657976',2);
      }
      if(t.holiday==='halloween'){path([[-5,-36],[12,-76],[28,-41],[37,-34]],grad(5,-73,26,-33,'#937aab','#5c537d'),ink,1.5);line([[1,-43],[27,-40]],'#d6a75f',4);oval(16,-56,2,2,'#f3d88c');}
      if(t.holiday==='christmas'){path([[0,-36],[9,-66],[28,-65],[39,-41]],'#c66a67',ink,1.5);oval(34,-64,6,6,'#fff5dd');line([[0,-35],[34,-35]],'#fff1d4',8);}
      if(t.holiday==='easter'){oval(9,-58,6,22,'#f4e3c9',ink,1.3);oval(26,-57,6,22,'#f4e3c9',ink,1.3);oval(9,-59,2.5,15,'#d4a2a5');oval(26,-58,2.5,15,'#d4a2a5');}
      if(b.vehicle==='plane'){
        // Little red biplane: struts, striped wings, wheels, rivets and a spinning propeller.
        line([[-26,10],[-23,35]],'#716859',3);line([[27,9],[31,35]],'#716859',3);oval(-19,39,6,6,'#535d56','#e5c894',2);oval(25,39,6,6,'#535d56','#e5c894',2);
        oval(-1,21,55,13,grad(0,9,0,34,'#e9a17c','#b86b52'),ink,1.8);path([[-44,19],[-60,-6],[-44,-4],[-31,22]],'#c5785f',ink,1.5);path([[-36,24],[10,24],[39,37],[-40,34]],'#e8bd6c',ink,1.5);path([[-39,2],[18,2],[39,11],[-39,10]],'#e8bd6c',ink,1.5);line([[-26,10],[-23,30]],'#8c7855',2);line([[24,10],[27,31]],'#8c7855',2);oval(49,20,6,10,'#cec9a5',ink,1.2);oval(56,20,2.5,reduced?19:13+Math.sin(time*36+b.phase)*9,'#eff2dfaa');for(var rivet=0;rivet<4;rivet++)oval(-19+rivet*12,23,1.2,1.2,'#f5ddb1');
      }
      if(b.vehicle==='balloon'){path([[-21,15],[21,15],[16,36],[-16,36]],grad(0,15,0,36,'#d6ad73','#a77b54'),ink,1.5);for(var weave=0;weave<4;weave++)line([[-18,20+weave*4],[18,20+weave*4]],'#8d6c452e',1);line([[-11,16],[-9,35]],'#f0c88d',2);line([[11,16],[9,35]],'#f0c88d',2);}
      ctx.restore();
    }
    function cover(o,layer){
      ctx.save();ctx.translate(o.x,o.y);var s=o.r/40;ctx.scale(s,s);
      if(o.type==='tree'){
        // Same crown ellipse and trunk as inside(); texture stays within that silhouette.
        oval(0,27,35,5,'#304b3528');ctx.fillStyle=grad(-7,0,7,0,'#aa8054','#6c5940');ctx.fillRect(-7/s,-40,14/s,40+35/s);
        oval(0,-40,40,54,grad(-32,-90,23,10,palette.light,palette.dark));
        ctx.save();ctx.beginPath();ctx.ellipse(0,-40,40,54,0,0,7);ctx.clip();for(var cluster=0;cluster<18;cluster++){var cx=Math.sin(cluster*2.4)*31,cy=-43+Math.cos(cluster*1.63)*43;oval(cx,cy,10+cluster%5,8+cluster%4,cluster%3===0?palette.light:cluster%3===1?palette.leaf:palette.dark);}
        for(var leaf=0;leaf<26;leaf++){var lx=Math.sin(leaf*2.399)*Math.sqrt(leaf/26)*39,ly=-40+Math.cos(leaf*2.399)*Math.sqrt(leaf/26)*52;oval(lx,ly,2.8,1.5,winter?'#fbfcf4aa':autumn?'#f3cb7a99':'#dae5a177');}ctx.restore();line([[0,25],[0,-18],[-13,-38]],'#806744',3);line([[0,-11],[16,-33]],'#806744',2);if(winter)oval(-5,-88,20,5,'#f9fcf3');
      }else{
        // Front, gable, shingles and siding all stay inside the shared cover polygon.
        path([[-40,28/s],[-40,-44],[0,-76],[40,-44],[40,28/s]],grad(-40,-60,40,30,'#c98c6c','#9e6151'),'#6f6553',1);
        ctx.save();ctx.beginPath();ctx.rect(-39,-43,78,43+28/s);ctx.clip();for(var plank=-34;plank<40;plank+=8)line([[plank,-43],[plank,28/s]],'#f1cf9a44',1);ctx.restore();
        path([[-40,-44],[0,-76],[40,-44]],grad(0,-76,0,-42,winter?'#fbf7e8':'#879491',winter?'#d3e2dd':'#566d69'),'#65756b',2);for(var shingle=0;shingle<4;shingle++)line([[-31+shingle*8,-49-shingle*6],[31-shingle*8,-49-shingle*6]],winter?'#dce7de':'#b6b8a266',1);
        roundRect(-15,-10,30,28/s+10,1,'#647f70','#f1ddb2');line([[-15,-10],[15,28/s]],'#f1ddb2',2);line([[15,-10],[-15,28/s]],'#f1ddb2',2);line([[0,-10],[0,28/s]],'#f1ddb2',2);oval(0,-32,8,8,'#8fb2ac','#f2deb4',2);line([[-6,-32],[6,-32]],'#f2deb4',1);line([[0,-38],[0,-26]],'#f2deb4',1);roundRect(16,-19,13,13,1,'#7d9f92','#f1ddb2');
        if(layer===2){roundRect(-26,-54,52,10,2,'#f2dfb5');ctx.font='bold 6px sans-serif';ctx.textAlign='center';ctx.fillStyle='#7d7055';ctx.fillText('HÜHNERHOF',0,-47);}
      }
      var peeker=o.type==='barn'?g.visitors.find(function(v){return v.visitor==='peek'&&v.layer===layer;}):null;
      if(peeker)roundRect(-15,-10,30,28/s+10,1,'#344e49','#f1ddb2');
      if(t.holiday==='halloween'){pumpkin(22,27,1);pumpkin(39,29,.65);}
      if(t.holiday==='christmas'){for(var bulb=0;bulb<6;bulb++)oval(-25+bulb*10,-34+Math.sin(bulb*.6)*5,2.3,2.3,bulb%2?'#f4d27b':'#d98777');}
      if(t.holiday==='easter'){egg(-23,29,.7,'#dfb1c8');egg(-33,30,.6,'#e2c67b');}ctx.restore();
      if(peeker){ctx.save();ctx.beginPath();ctx.rect(o.x-15*s,o.y-10*s,30*s,28+10*s);ctx.clip();bird(peeker);ctx.restore();}
    }
    ctx.clearRect(0,0,w,600);ctx.lineCap='round';ctx.lineJoin='round';scenery();
    // Haze between layers, darker near objects and crisp birds give depth without sacrificing contrast.
    for(var layer=0;layer<3;layer++){g.targets.forEach(function(b){if(b.layer===layer)bird(b);});obstacles(g,layer).forEach(function(o){cover(o,layer);});}
    // Pond guests sit in front of the bank; the waterline hides submerged feathers.
    g.visitors.forEach(function(v){if(v.visitor==='peek')return;var water=pond(g),p=position(g,v);ctx.save();if(v.visitor==='diver'){ctx.beginPath();ctx.rect(0,0,w,water.y);ctx.clip();}bird(v);ctx.restore();oval(p.x,water.y,Math.min(water.rx*.5,28),4,null,'#f1f6dfaa',1.5);if(v.visitor==='diver'){oval(p.x-6,water.y+8,2,2,'#eff8e7bb');oval(p.x+10,water.y+13,3,3,'#eff8e7aa');}});
    // A small painted wooden sign anchors the scene; avoid text over the flight lanes.
    ctx.save();ctx.globalAlpha=.86;roundRect(14,16,128,25,8,'#fff8dfcc');ctx.fillStyle='#526b60';ctx.font='600 10px sans-serif';ctx.textAlign='center';ctx.fillText({autumn:'HERBST AUF DEM HOF',winter:'WINTER AUF DEM HOF',spring:'FRÜHLING AUF DEM HOF',summer:'SOMMER AUF DEM HOF'}[t.season],78,32);ctx.restore();
    g.effects.forEach(function(e){var age=time-e.at;ctx.save();ctx.globalAlpha=Math.max(0,1-age/.85);ctx.textAlign='center';ctx.font='bold 20px sans-serif';ctx.lineWidth=4;ctx.strokeStyle='#455d51';ctx.fillStyle='#fff3bf';var label=e.points?'+'+e.points+' · Gack!':'Plopp!';ctx.strokeText(label,e.x,e.y-35-age*30);ctx.fillText(label,e.x,e.y-35-age*30);if(e.points)for(var j=0;j<14;j++){ctx.save();ctx.translate(e.x+Math.cos(j*2.4)*age*85,e.y+Math.sin(j*2.4)*age*75+age*age*30);ctx.rotate(j+age*3);ctx.fillStyle=['#f1ca6c','#d99bb4','#90c8b6','#f4ead0'][j%4];ctx.fillRect(-2,-2,4,7);ctx.restore();}ctx.restore();});
  }
  window.ChickenShooter={create:create,advance:advance,shoot:shoot,reload:reload,position:position,covered:covered,obstacles:obstacles,theme:theme,easter:easter,topFive:topFive,draw:draw,birdHit:birdHit,resize:resize,cowPose:cowPose,pond:pond,duration:DURATION};
})();
